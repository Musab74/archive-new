/**
 * Minimal .xlsx reader for 사업주 엑셀 등록 (replaces PHPExcel_IOFactory in company_excel_upload.php, read-only, values only).
 * An .xlsx is a ZIP of XML parts: we read the central directory, inflate the parts we need with the platform
 * DecompressionStream('deflate-raw'), and parse workbook / shared strings / one worksheet with DOMParser.
 * No formulas are evaluated (cached values are used, like PHPExcel setReadDataOnly + getValue()). Legacy .xls (BIFF / HTML) is read by xlsRead.ts.
 */

export interface XlsxSheet { name: string; cells: Map<string, string>; maxRow: number; maxCol: number }
export interface XlsxBook { sheetNames: string[]; sheet: (index: number) => Promise<XlsxSheet | null> }

const td = new TextDecoder('utf-8');

interface ZipEntry { name: string; method: number; compSize: number; localOffset: number }

function zipEntries(buf: Uint8Array): Map<string, ZipEntry> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('XLSX_NOT_ZIP');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('XLSX_BAD_DIRECTORY');
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true); const extraLen = dv.getUint16(p + 30, true); const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = td.decode(buf.subarray(p + 46, p + 46 + nameLen));
    out.set(name, { name, method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (!DS) throw new Error('XLSX_NO_INFLATE');
  const src = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(data); c.close(); } });
  const reader = src.pipeThrough(new DS('deflate-raw')).getReader();
  const parts: Uint8Array[] = []; let len = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); len += value.length; }
  const out = new Uint8Array(len); let o = 0;
  for (const part of parts) { out.set(part, o); o += part.length; }
  return out;
}

async function readPart(buf: Uint8Array, entries: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const e = entries.get(name) ?? [...entries.values()].find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!e) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lp = e.localOffset;
  if (dv.getUint32(lp, true) !== 0x04034b50) throw new Error('XLSX_BAD_ENTRY');
  const start = lp + 30 + dv.getUint16(lp + 26, true) + dv.getUint16(lp + 28, true);
  const raw = buf.subarray(start, start + e.compSize);
  const bytes = e.method === 0 ? raw : e.method === 8 ? await inflateRaw(raw) : null;
  if (!bytes) throw new Error('XLSX_UNSUPPORTED_COMPRESSION');
  return td.decode(bytes);
}

const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml');
const byTag = (root: Document | Element, tag: string) => Array.from(root.getElementsByTagName('*')).filter((el) => el.localName === tag);
const kids = (el: Element, tag: string) => Array.from(el.children).filter((c) => c.localName === tag);

/** Text of an <si>/<is> element: every <t> except the phonetic guide runs (<rPh>). */
function richText(el: Element): string {
  return byTag(el, 't').filter((t) => !(t.parentElement && t.parentElement.localName === 'rPh')).map((t) => t.textContent ?? '').join('');
}

/** "AB12" → [col 28, row 12] (1-based). */
export function cellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]!.toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[2]) };
}
export function colName(col: number): string {
  let s = ''; let c = col;
  while (c > 0) { const r = (c - 1) % 26; s = String.fromCharCode(65 + r) + s; c = Math.floor((c - 1) / 26); }
  return s;
}

/** Numeric cell → text without exponent / float noise for integers (1234567890, 06236 stored as number → "6236" like PHPExcel). */
function numberText(v: string): string {
  if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v)) return v;
  const num = Number(v);
  if (!Number.isFinite(num)) return v;
  if (Number.isInteger(num) && Math.abs(num) < 1e21) return num.toFixed(0);
  return String(Number(num.toPrecision(15)));
}

export async function readXlsx(data: ArrayBuffer | Uint8Array): Promise<XlsxBook> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const entries = zipEntries(buf);
  const wbText = await readPart(buf, entries, 'xl/workbook.xml');
  if (!wbText) throw new Error('XLSX_NO_WORKBOOK');
  const relsText = await readPart(buf, entries, 'xl/_rels/workbook.xml.rels');
  const rels = new Map<string, string>();
  if (relsText) for (const r of byTag(xml(relsText), 'Relationship')) rels.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');
  const sheets = byTag(xml(wbText), 'sheet').map((s, i) => {
    const rid = s.getAttribute('r:id') ?? Array.from(s.attributes).find((a) => a.localName === 'id')?.value ?? '';
    const target = rels.get(rid) ?? `worksheets/sheet${i + 1}.xml`;
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    return { name: s.getAttribute('name') ?? `Sheet${i + 1}`, path };
  });
  let shared: string[] | null = null;
  const sharedStrings = async () => {
    if (shared) return shared;
    const t = await readPart(buf, entries, 'xl/sharedStrings.xml');
    shared = t ? byTag(xml(t), 'si').map(richText) : [];
    return shared;
  };
  return {
    sheetNames: sheets.map((s) => s.name),
    sheet: async (index: number) => {
      const meta = sheets[index];
      if (!meta) return null;
      const text = await readPart(buf, entries, meta.path);
      if (!text) return null;
      const sst = await sharedStrings();
      const cells = new Map<string, string>(); let maxRow = 0; let maxCol = 0;
      for (const c of byTag(xml(text), 'c')) {
        const ref = c.getAttribute('r') ?? ''; const pos = cellRef(ref);
        if (!pos) continue;
        const t = c.getAttribute('t') ?? 'n';
        const v = kids(c, 'v')[0]?.textContent ?? '';
        let value: string;
        if (t === 's') value = sst[Number(v)] ?? '';
        else if (t === 'inlineStr') value = kids(c, 'is')[0] ? richText(kids(c, 'is')[0]!) : '';
        else if (t === 'b') value = v === '1' ? 'TRUE' : v === '0' ? 'FALSE' : v;
        else if (t === 'str' || t === 'e') value = v;
        else value = numberText(v);
        if (value === '') continue;
        cells.set(ref.toUpperCase(), value);
        maxRow = Math.max(maxRow, pos.row); maxCol = Math.max(maxCol, pos.col);
      }
      return { name: meta.name, cells, maxRow, maxCol };
    },
  };
}

/** Rows rowFrom..maxRow as arrays over columns A..(colCount) — the PHP loop `for ($i = 2; $i <= $maxRow; $i++) getCell('A'.$i)…`. */
export function sheetRows(sheet: XlsxSheet, rowFrom: number, colCount: number): string[][] {
  const out: string[][] = [];
  for (let r = rowFrom; r <= sheet.maxRow; r++) out.push(Array.from({ length: colCount }, (_, i) => sheet.cells.get(`${colName(i + 1)}${r}`) ?? ''));
  return out;
}
