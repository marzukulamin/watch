import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root = path.resolve(import.meta.dirname, '..');
const source = JSON.parse(
  await fs.readFile(path.join(root, 'docs/reference/products-source.json'), 'utf8'),
);
const chosen = source.products
  .filter(
    (p) =>
      /Timex Marlin|Casio Vintage AQ-230|Fossil Campbell|Emporio Armani Dario|Emporio Armani World Explorer|Casio LTP-1234|Seiko.*Presage|Orient.*Bambino/.test(
        p.title,
      ) && !/Double A|Triple A|Replica|\bAA\b|\bAAA\b/i.test(p.title),
  )
  .slice(0, 20);
await fs.mkdir(path.join(root, 'public/media/products'), { recursive: true });
const manifest = [];
for (const p of chosen) {
  const images = [];
  for (const [i, img] of p.images.slice(0, 3).entries()) {
    const name = `${p.id}-${i}.webp`;
    const target = path.join(root, 'public/media/products', name);
    if (
      !(await fs
        .access(target)
        .then(() => true)
        .catch(() => false))
    ) {
      const response = await fetch(img.src);
      if (!response.ok) throw Error(`Image download ${response.status}`);
      await sharp(Buffer.from(await response.arrayBuffer()))
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(target);
    }
    images.push({ path: `/media/products/${name}`, source_url: img.src });
  }
  manifest.push({ ...p, local_images: images });
  console.log(`Saved: ${p.title.split('|')[0]}`);
}
await fs.writeFile(
  path.join(root, 'database/catalog-source.json'),
  JSON.stringify(
    {
      fetched_at: new Date().toISOString(),
      source_url: 'https://versebd.com/products.json?limit=250',
      products: manifest,
    },
    null,
    2,
  ),
);
const home = await fetch('https://versebd.com/').then((r) => r.text());
await fs.writeFile(path.join(root, 'docs/reference/home-source.html'), home);
console.log(
  'Video candidates:',
  [...new Set(home.match(/https:[^"\s<>]+\.mp4[^"\s<>]*/g) || [])].slice(0, 8),
);
