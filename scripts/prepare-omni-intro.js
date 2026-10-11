import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'public/media/intro');
const reference = path.join(root, 'docs/reference');
async function ffmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(Error(`ffmpeg exited ${code}`))));
  });
}
for (const version of ['watch-v3', 'outlet-v2']) {
  const report = JSON.parse(
    await fs.readFile(path.join(reference, `omni-cloud-status-${version}.json`), 'utf8'),
  );
  if (!report.visually_inspected || report.inspection_result !== 'approved')
    throw Error(`Inspect and approve ${version} before preparing production assets.`);
}
await fs.mkdir(output, { recursive: true });
const watch = path.join(reference, 'verse-assembly-omni.watch-v3-clean.mp4');
const outlet = path.join(reference, 'verse-assembly-omni.outlet-v2.mp4');
const master = path.join(reference, 'verse-watch-outlet-master.v2.mp4');
await ffmpeg([
  '-i',
  watch,
  '-i',
  outlet,
  '-filter_complex',
  '[0:v]setpts=PTS-STARTPTS,fps=24,setsar=1[a];[1:v]setpts=PTS-STARTPTS,fps=24,setsar=1[b];[a][b]concat=n=2:v=1:a=0,tpad=stop_mode=clone:stop_duration=2[v]',
  '-map',
  '[v]',
  '-an',
  '-c:v',
  'libx264',
  '-crf',
  '20',
  '-preset',
  'medium',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  master,
]);
await ffmpeg([
  '-i',
  master,
  '-vf',
  'scale=1920:1080',
  '-an',
  '-c:v',
  'libx264',
  '-crf',
  '23',
  '-preset',
  'medium',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  path.join(output, 'verse-watch-outlet-desktop.v2.mp4'),
]);
await ffmpeg([
  '-i',
  master,
  '-vf',
  'crop=608:1080:(iw-608)/2:0,scale=720:1280',
  '-an',
  '-c:v',
  'libx264',
  '-crf',
  '25',
  '-preset',
  'medium',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  path.join(output, 'verse-watch-outlet-mobile.v2.mp4'),
]);
await ffmpeg([
  '-ss',
  '15.5',
  '-i',
  master,
  '-frames:v',
  '1',
  path.join(output, 'verse-outlet-poster.v2.webp'),
]);
await ffmpeg([
  '-i',
  master,
  '-vf',
  'fps=1,scale=320:180,tile=6x3',
  '-frames:v',
  '1',
  path.join(reference, 'omni-v2-master-contact.jpg'),
]);
await ffmpeg([
  '-i',
  path.join(output, 'verse-watch-outlet-mobile.v2.mp4'),
  '-vf',
  'fps=1/3,scale=180:320,tile=6x1',
  '-frames:v',
  '1',
  path.join(reference, 'omni-v2-mobile-contact.jpg'),
]);
// Exact source symbol and locally installed Manrope, rendered as reliable branding layers.
const font = await fs.readFile(
  path.join(
    root,
    'node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
  ),
);
const logo = await fs.readFile(path.join(output, 'verse-symbol.png'));
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font.toString('base64')})}html,body{margin:0;width:100%;height:100%;background:transparent}.brand{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:30px;font-family:Manrope}.brand img{width:110px;height:88px;object-fit:contain;filter:brightness(0) invert(1)}.brand span{color:#d6b58a;letter-spacing:19px;font-size:54px;font-weight:400;padding-left:19px}</style><div class="brand"><img src="data:image/png;base64,${logo.toString('base64')}" alt=""><span>VERSE</span></div>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.locator('img').evaluate((img) => img.decode());
  await page.screenshot({
    path: path.join(reference, 'verse-brand-overlay.v2.png'),
    omitBackground: true,
  });
} finally {
  await browser.close();
}
await ffmpeg([
  '-f',
  'lavfi',
  '-i',
  'color=c=0x080605:s=1920x1080:r=24:d=1.5',
  '-i',
  master,
  '-loop',
  '1',
  '-i',
  path.join(reference, 'verse-brand-overlay.v2.png'),
  '-filter_complex',
  "[0:v][1:v]concat=n=2:v=1:a=0[film];[2:v]split=2[openingSource][endingSource];[openingSource]fade=t=in:st=0:d=0.6:alpha=1,fade=t=out:st=1.15:d=0.35:alpha=1[opening];[endingSource]fade=t=in:st=16:d=0.7:alpha=1[ending];[film][opening]overlay=0:0:enable='lt(t,1.5)'[withOpening];[withOpening][ending]overlay=0:0:enable='gte(t,16)'[branded]",
  '-map',
  '[branded]',
  '-t',
  '19.5',
  '-an',
  '-c:v',
  'libx264',
  '-crf',
  '22',
  '-preset',
  'medium',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  path.join(output, 'verse-full-intro.v2.mp4'),
]);
const assets = [];
for (const name of [
  'verse-watch-outlet-desktop.v2.mp4',
  'verse-watch-outlet-mobile.v2.mp4',
  'verse-full-intro.v2.mp4',
  'verse-outlet-poster.v2.webp',
])
  assets.push({
    path: `/media/intro/${name}`,
    bytes: (await fs.stat(path.join(output, name))).size,
  });
await fs.writeFile(
  path.join(reference, 'omni-v2-production.json'),
  JSON.stringify(
    {
      prepared_at: new Date().toISOString(),
      source_model: 'gemini-omni-1.1-flash-preview',
      story_seconds: 18,
      full_intro_seconds: 19.5,
      generated_content: 'Original watch and architectural concept',
      branding: 'Official source symbol and exact locally rendered Manrope wordmark',
      audio: false,
      assets,
      activated: false,
    },
    null,
    2,
  ),
);
console.log(
  'Production media prepared; inspect desktop/mobile versions before manifest activation.',
);
