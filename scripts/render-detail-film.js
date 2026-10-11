import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { db, close, root } from '../server/db.js';
const p = await db.get("SELECT id FROM products WHERE model='AR11746'");
const image = await db.get(
  'SELECT path,source_url FROM product_images WHERE product_id=? AND position=1',
  [p.id],
);
const source = path.join(root, 'public', image.path);
const output = path.join(root, 'public/media/verse-detail-film.mp4');
// A silent, seamless motion study of an existing catalogue photograph; not live footage.
const args = [
  '-y',
  '-hide_banner',
  '-loglevel',
  'error',
  '-loop',
  '1',
  '-i',
  source,
  '-vf',
  "scale=1600:1600,zoompan=z='1.05+0.035*(1-cos(2*PI*on/239))':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=240:s=960x960:fps=30",
  '-frames:v',
  '240',
  '-an',
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-crf',
  '25',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  output,
];
await new Promise((resolve, reject) => {
  const process = spawn('ffmpeg', args, { stdio: 'inherit', windowsHide: true });
  process.on('error', reject);
  process.on('exit', (code) => (code === 0 ? resolve() : reject(Error(`ffmpeg exited ${code}`))));
});
await fs.writeFile(
  path.join(root, 'docs/reference/detail-film-provenance.json'),
  JSON.stringify(
    {
      type: 'motion study from product photograph',
      product_id: p.id,
      source_url: image.source_url,
      output: '/media/verse-detail-film.mp4',
      duration_seconds: 8,
      audio: false,
    },
    null,
    2,
  ),
);
const content = await db.get("SELECT content_json FROM site_content WHERE section='story'");
const data = JSON.parse(content.content_json);
data.video = '/media/verse-detail-film.mp4';
await db.run("UPDATE site_content SET content_json=? WHERE section='story'", [
  JSON.stringify(data),
]);
console.log(`Local motion film: ${(await fs.stat(output)).size} bytes, 8 seconds, no audio.`);
await close();
