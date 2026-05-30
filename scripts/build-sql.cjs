const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scripts/image-data.json', 'utf8'));
let sql = '';
for (const row of data) {
  const images = row.images.map(u => `'${u.replace(/'/g, "''")}'`).join(', ');
  sql += `UPDATE products SET images = ARRAY[${images}], source_url = '${row.source.replace(/'/g, "''")}' WHERE id = '${row.id}';
`;
}
fs.writeFileSync('scripts/update-images.sql', sql);
console.log(`Wrote ${data.length} updates to scripts/update-images.sql`);
