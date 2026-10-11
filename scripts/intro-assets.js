import fs from 'node:fs/promises';
import sharp from 'sharp';
const directory = new URL('../public/media/intro/', import.meta.url);
await fs.mkdir(directory, { recursive: true });
const source =
  'https://versebd.com/cdn/shop/files/Asset_1_4x_2a5e7103-31af-4b49-a56a-878adbdd875b.png?v=1789484921&width=500';
const response = await fetch(source);
if (!response.ok) throw Error(`Official logo download failed (${response.status})`);
await sharp(Buffer.from(await response.arrayBuffer()))
  .trim()
  .resize({ width: 250, withoutEnlargement: true })
  .png()
  .toFile(new URL('verse-symbol.png', directory).pathname.replace(/^\/(\w:)/, '$1'));
await fs.writeFile(
  new URL('../docs/reference/intro-brand-provenance.json', import.meta.url),
  JSON.stringify(
    {
      source_url: source,
      fetched_at: new Date().toISOString(),
      official_symbol: 'public/media/intro/verse-symbol.png',
      note: 'Official source silhouette, trimmed and resized only. Colour treatment is frontend CSS.',
    },
    null,
    2,
  ),
);
console.log('Saved official source logo.');
