import fs from 'node:fs/promises';
const reference = new URL('../docs/reference/', import.meta.url);
let file = new URL('omni-cloud-status-watch-v3.json', reference);
let report = JSON.parse(await fs.readFile(file, 'utf8'));
report.visually_inspected = true;
report.inspection_result = 'approved';
report.inspected_asset = 'docs/reference/verse-assembly-omni.watch-v3-clean.mp4';
report.review =
  'Cloud edit retained tiny invented dial glyphs; local tracked OpenCV video inpainting removed them beside six. Inspected cleanup frames, assembly and closing shot. Raw cloud output retained.';
report.estimated_usage_cost_usd =
  (report.usage.total_input_tokens * 1.5) / 1e6 +
  (report.usage.total_thought_tokens * 9) / 1e6 +
  (report.usage.total_output_tokens * 17.5) / 1e6;
await fs.writeFile(file, JSON.stringify(report, null, 2));
file = new URL('omni-cloud-status-watch-v2.json', reference);
report = JSON.parse(await fs.readFile(file, 'utf8'));
report.inspection_result = 'superseded';
report.review =
  'Full-resolution inspection found tiny invented dial glyphs; superseded by cleaned watch-v3.';
await fs.writeFile(file, JSON.stringify(report, null, 2));
