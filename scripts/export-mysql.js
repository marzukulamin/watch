import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
// Lengths keep utf8mb4 unique keys under InnoDB's index limit. JSON is TEXT for compatibility.
const output = source
  .replace(/^--.*$/gm, '')
  .replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX')
  .replace(/\bINTEGER PRIMARY KEY\b/g, 'INT PRIMARY KEY AUTO_INCREMENT')
  .replace(/token_hash TEXT PRIMARY KEY/g, 'token_hash VARCHAR(64) PRIMARY KEY')
  .replace(/\bINTEGER\b/g, 'INT')
  .replace(/\bTEXT\b/g, 'VARCHAR(255)')
  .replace(
    /(description|sections_json|content_json|address|registered_address|full_name|source_url|decision_note|note) VARCHAR\(255\)/g,
    '$1 TEXT',
  )
  .replace(/day VARCHAR\(255\)/g, 'day VARCHAR(10)')
  .replace(/route VARCHAR\(255\)/g, 'route VARCHAR(160)')
  .replace(/\);/g, ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;');
// Table engine suffix is only for CREATE TABLE, never CREATE INDEX.
let clean = output.replace(
  /(CREATE INDEX[^;]+) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;/g,
  '$1;',
);
// MySQL ignores inline REFERENCES. Emit explicit foreign-key constraints instead.
clean = clean.replace(
  /(CREATE TABLE IF NOT EXISTS \w+ \()(.*?)(\) ENGINE=InnoDB)/gs,
  (_, start, body, end) => {
    const constraints = [];
    const fields = body.replace(
      /(\w+) INT( NOT NULL)? REFERENCES (\w+)\(id\)/g,
      (_, column, required, target) => {
        constraints.push(`FOREIGN KEY (${column}) REFERENCES ${target}(id)`);
        return `${column} INT${required || ''}`;
      },
    );
    return (
      start +
      fields.trimEnd() +
      (constraints.length ? ',\n ' + constraints.join(',\n ') : '') +
      '\n' +
      end
    );
  },
);
await fs.writeFile(
  new URL('../database/mysql-schema.sql', import.meta.url),
  '-- Import into an empty verse database with phpMyAdmin. MySQL 8.0+ / MariaDB 10.6+.\n' + clean,
);
console.log('MySQL schema generated');
