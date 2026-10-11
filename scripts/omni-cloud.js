// Development-only Google Cloud connection. Never imported by the browser or web server.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const project = process.env.GOOGLE_CLOUD_PROJECT || 'jerserio-project';
const model = 'gemini-omni-1.1-flash-preview';
const cli = process.env.GCLOUD_EXECUTABLE || 'E:/Google cloud CLI/google-cloud-sdk/bin/gcloud.ps1';
const args = process.argv.slice(2);
const generate = args.includes('--generate');
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const version = option('version', 'v1');
if (!/^[a-z0-9-]{1,32}$/.test(version)) throw Error('Invalid version name');
const reportPath = path.join(
  root,
  `docs/reference/omni-cloud-status${version === 'v1' ? '' : '-' + version}.json`,
);
const budget = Number(args.find((a) => a.startsWith('--max-estimated-usd='))?.split('=')[1] || 0);
const seconds = Number(option('duration', '10'));
if (!Number.isInteger(seconds) || seconds < 3 || seconds > 10)
  throw Error('Duration must be 3–10 seconds');
const resolution = '1080p';
const videoEstimate = (seconds * 8688 * 17.5) / 1e6;
const outputPath = path.join(root, `docs/reference/verse-assembly-omni.${version}.mp4`);
function projectFile(value) {
  const target = path.resolve(root, value);
  if (!target.startsWith(root + path.sep))
    throw Error('Asset paths must be within the Watch project');
  return target;
}
const promptPath = projectFile(option('prompt', 'docs/INTRO-PROMPT.txt'));
const imageOption = option('image', '');
const imagePath = imageOption ? projectFile(imageOption) : null;
const videoOption = option('video', '');
const videoPath = videoOption ? projectFile(videoOption) : null;
if (imagePath && videoPath) throw Error('Use one reference type per request.');
if (generate) {
  const alreadyExists = await fs
    .access(outputPath)
    .then(() => true)
    .catch(() => false);
  if (alreadyExists)
    throw Error(
      `Version ${version} already exists. No Cloud request made. Inspect the current film before planning a new version.`,
    );
}
if (!/^[a-z][a-z0-9-]{4,62}$/.test(project)) throw Error('Invalid Google Cloud project ID');
if (generate && budget < videoEstimate + 0.2)
  throw Error(
    `Pass --max-estimated-usd=2 or higher. Video output estimate $${videoEstimate.toFixed(4)}, plus input and reasoning. This guard is an estimate, not a Cloud billing cap.`,
  );
const tokenResult =
  process.platform === 'win32'
    ? spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `& '${cli.replaceAll("'", "''")}' auth print-access-token`,
        ],
        { encoding: 'utf8', windowsHide: true },
      )
    : spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' });
if (tokenResult.status !== 0 || !tokenResult.stdout.trim())
  throw Error('Google Cloud login unavailable. Run gcloud auth login locally.');
const token = tokenResult.stdout.trim();
const headers = {
  Authorization: `Bearer ${token}`,
  'x-goog-user-project': project,
  'Content-Type': 'application/json',
};
const base = 'https://aiplatform.googleapis.com';
async function request(url, body) {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(body?.response_format ? 600000 : 60000),
  });
  const json = await r.json();
  if (!r.ok) throw Error(`${r.status}: ${json.error?.message || 'Cloud API request failed'}`);
  return json;
}
const report = {
  checked_at: new Date().toISOString(),
  project,
  model,
  location: 'global',
  authentication: 'existing gcloud OAuth; token held in memory only',
  generation_requested: generate,
  video_output_estimate_usd: videoEstimate,
  credit_balance_verified: false,
  version,
};
try {
  const metadata = await request(`${base}/v1/publishers/google/models/${model}`);
  report.model = metadata.name;
  report.launch_stage = metadata.launchStage;
  const counted = await request(
    `${base}/v1/projects/${project}/locations/global/publishers/google/models/${model}:countTokens`,
    { contents: [{ role: 'user', parts: [{ text: 'Connection check' }] }] },
  );
  report.authentication_verified = true;
  report.count_tokens = counted.totalTokens;
  console.log(`Connected: ${project} / ${model} / global. Token count ${counted.totalTokens}.`);
  if (generate) {
    const prompt = await fs.readFile(promptPath, 'utf8');
    const input = [{ type: 'text', text: prompt }];
    if (imagePath)
      input.push({
        type: 'image',
        mime_type: imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg',
        data: (await fs.readFile(imagePath)).toString('base64'),
      });
    if (videoPath)
      input.push({
        type: 'video',
        mime_type: 'video/mp4',
        data: (await fs.readFile(videoPath)).toString('base64'),
      });
    console.log(
      `Submitting ONE ${seconds}s ${resolution} generation. Output estimate $${videoEstimate.toFixed(4)} plus input/reasoning. Credit eligibility is controlled by Google Cloud Billing.`,
    );
    const interaction = await request(
      `${base}/v1beta1/projects/${project}/locations/global/interactions`,
      {
        model,
        store: false,
        input,
        response_format: [
          {
            type: 'video',
            ...(videoPath ? {} : { aspect_ratio: '16:9' }),
            resolution,
            duration: `${seconds}s`,
          },
        ],
        generation_config: {
          video_config: {
            task: videoPath ? 'edit' : imagePath ? 'image_to_video' : 'text_to_video',
          },
        },
      },
    );
    report.interaction_id = interaction.id;
    report.status = interaction.status;
    report.usage = interaction.usage;
    const video = interaction.steps
      ?.filter((s) => s.type === 'model_output')
      .flatMap((s) => s.content || [])
      .find((c) => c.type === 'video');
    if (!video?.data)
      throw Error(
        video?.uri
          ? `Video returned a URI instead of local bytes. Retrieve from Cloud manually: ${video.uri}`
          : 'No inline video output returned; no media created.',
      );
    const target = outputPath;
    try {
      await fs.access(target);
      throw Error(`Version ${version} already exists. Refusing to overwrite.`);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    await fs.writeFile(target, Buffer.from(video.data, 'base64'));
    report.local_asset = path.relative(root, target).replaceAll('\\', '/');
    report.visually_inspected = false;
    console.log(`Saved ${report.local_asset}; inspection required before publishing.`);
  }
} catch (e) {
  report.blocker = e.message;
  process.exitCode = 1;
  console.error(e.message);
}
if (!generate) {
  const previous = await fs
    .readFile(reportPath, 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  if (previous?.generation_requested) {
    previous.latest_connection_check = report;
    await fs.writeFile(reportPath, JSON.stringify(previous, null, 2) + '\n');
  } else await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
} else await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
