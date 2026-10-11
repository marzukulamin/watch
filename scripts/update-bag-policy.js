import { db, transaction, close } from '../server/db.js';

const description =
  'verse_bag in sessionStorage keeps product IDs, quantities and a checkout retry key in this tab across refreshes. It ends when the tab session closes, contains no account or payment details, and is not used for analytics. If browser storage is unavailable, the bag stays in memory until reload.';
try {
  await transaction(async (t) => {
    for (const slug of ['privacy', 'cookies']) {
      const row = await t.get('SELECT * FROM policies WHERE slug=?', [slug]);
      if (!row) continue;
      const sections = JSON.parse(row.sections_json);
      if (sections.some((section) => section.body.includes('verse_bag'))) continue;
      for (const section of sections)
        section.body = section.body.replace(
          'The shopping bag is kept only in memory for the current page session. ',
          '',
        );
      sections.push({ heading: 'Shopping bag storage', body: description });
      await t.run('UPDATE policies SET sections_json=?,version=?,updated_at=? WHERE id=?', [
        JSON.stringify(sections),
        '2026-10-11.1',
        new Date().toISOString(),
        row.id,
      ]);
    }
  });
  console.log('Shopping bag storage disclosures updated.');
} finally {
  await close();
}
