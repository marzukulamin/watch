import fs from 'node:fs/promises';
for (const version of ['watch-v2','outlet-v2']) {
  const file=new URL(`../docs/reference/omni-cloud-status-${version}.json`,import.meta.url);
  const report=JSON.parse(await fs.readFile(file,'utf8'));
  report.visually_inspected=true;
  report.inspection_result='approved';
  report.inspected_at=new Date().toISOString();
  report.review = version==='watch-v2'
    ? 'Inspected 16-frame contact sheet and full-resolution final frame: unbranded original watch, separated components, coherent assembly, frontal rotation and dial zoom. Predominantly right-origin components; some initial case positioning is on the left. No manufacturer lettering observed.'
    : 'Inspected 16-frame contact sheet, full-resolution opening and end frames: starting frame matches previous dial zoom, portal forms, dark/champagne boutique facade and watch windows construct, glass doors swing open and camera advances toward clean central black wall. No baked lettering observed.';
  const usage=report.usage;
  report.estimated_usage_cost_usd=(usage.total_input_tokens*1.5+(usage.total_thought_tokens||0)*9+(usage.output_tokens_by_modality?.find(x=>x.modality==='video')?.tokens||0)*17.5)/1e6;
  report.credit_coverage_verified=false;
  await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');
}
