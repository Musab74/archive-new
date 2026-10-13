#!/usr/bin/env node
/* Generates src/db/tables.ts from ../../old-schema.md (the schema contract). Run: node scripts/gen-db-types.cjs */
const fs = require('fs');
const path = require('path');
const md = fs.readFileSync(path.resolve(__dirname, '../../../../old-schema.md'), 'utf8');
const lines = md.split('\n');
const tables = {};
let cur = null;
for (const line of lines) {
  const h = line.match(/^### `([A-Za-z0-9_]+)`\s*$/);
  if (h) { cur = h[1]; tables[cur] = []; continue; }
  if (!cur) continue;
  const m = line.match(/^\| `([^`]+)` \| ([^|]+) \| ([YN]) \| ([^|]*) \| (.*)\|\s*$/);
  if (m) tables[cur].push({ col: m[1], type: m[2].trim(), nullable: m[3] === 'Y', key: m[4].trim(), comment: m[5].trim() });
}
const skip = /^(ArchiveQuestion_bak|ContentsDetail_2504|Course_2504|Course_2505|ProgressLogTest|ProgressTest|TEST$|example_table)/;
const junk = { Progress: new Set(['Trigger','sql_mode','SQL Original Statement','character_set_client','collation_connection','Database Collation','Created']), ProgressLog: new Set(['Column16']) };
function tsType(sqlType) {
  const t = sqlType.toLowerCase();
  if (/^(tinyint|smallint|mediumint|int|bigint|decimal|float|double|year)/.test(t)) return 'number';
  return 'string';
}
let out = `// AUTO-GENERATED from old-schema.md by scripts/gen-db-types.cjs — do not edit by hand.\n// Column names are the live hrdeArchive names (PascalCase). datetime/date columns are strings (mysql2 dateStrings).\n\n`;
const names = Object.keys(tables).filter((t) => !skip.test(t) && tables[t].length > 0).sort();
for (const t of names) {
  out += `export interface ${t}Row {\n`;
  for (const c of tables[t]) {
    if (junk[t] && junk[t].has(c.col)) continue;
    const name = /^[A-Za-z_][A-Za-z0-9_]*$/.test(c.col) ? c.col : `'${c.col}'`;
    const cm = c.comment ? ` /** ${c.comment.replace(/\*\//g, '* /').replace(/\s+/g, ' ')} */` : '';
    out += `  ${name}: ${tsType(c.type)}${c.nullable ? ' | null' : ''};${cm}\n`;
  }
  out += `}\n\n`;
}
out += `export interface DB {\n${names.map((t) => `  ${t}: ${t}Row;`).join('\n')}\n}\n\nexport const DB_TABLE_NAMES = [${names.map((t) => `'${t}'`).join(', ')}] as const;\n`;
fs.writeFileSync(path.resolve(__dirname, '../src/db/tables.ts'), out);
console.log(`generated ${names.length} tables -> src/db/tables.ts`);
