import fs from 'node:fs/promises';
import { db, close } from '../server/db.js';
const file = new URL('../docs/reference/omni-cloud-status.json', import.meta.url);
const report = JSON.parse(await fs.readFile(file, 'utf8'));
report.visually_inspected = true;
report.inspection_result =
  'Rejected for website use: generated SEIKO branding despite explicit no-brand prompt; no authenticity claim can be made. Contact sheet inspection also shows the crystal lifted twice during assembly.';
report.activated_on_website = false;
report.estimated_usage_cost_usd = 1.5243075;
await fs.writeFile(file, JSON.stringify(report, null, 2) + '\n');
const disclosure =
  'verse_intro_seen in sessionStorage remembers that the optional introduction has already played in this browser tab. It contains only 1, is not sent to the server, and ends when the tab session closes. It is used only for this presentation preference, never analytics or profiling.';
for (const slug of ['privacy', 'cookies']) {
  const row = await db.get('SELECT * FROM policies WHERE slug=?', [slug]);
  if (!row) continue;
  const sections = JSON.parse(row.sections_json);
  if (!sections.some((s) => s.heading === 'Cinematic introduction')) {
    sections.push({ heading: 'Cinematic introduction', body: disclosure });
    await db.run('UPDATE policies SET sections_json=?,version=?,updated_at=? WHERE id=?', [
      JSON.stringify(sections),
      '2026-10-09.2',
      new Date().toISOString(),
      row.id,
    ]);
  }
}
await close();
