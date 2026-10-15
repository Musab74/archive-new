/**
 * Legacy Excel reader for 사업주 엑셀 등록: .xls (BIFF8 / BIFF5 inside an OLE2 compound file) and the HTML-table ".xls" files many
 * systems export. company_excel_upload.php used PHPExcel_IOFactory::createReaderForFile(), which picks the reader from the file
 * CONTENT (Excel2007 / Excel5 / HTML / CSV), so the same sniffing is done here. Values only (setReadDataOnly): no styles, formulas
 * are not evaluated (the cached result is used, as the .xlsx reader does), numbers are printed without exponent noise.
 * Returns the same XlsxBook shape as readXlsx() so the import page treats every format alike.
 */
import { colName, readXlsx, type XlsxBook, type XlsxSheet } from './xlsxRead';

export type SpreadsheetKind = 'xlsx' | 'xls' | 'html' | 'text';

/** Which reader PHPExcel would have used: ZIP → Excel2007, OLE2 → Excel5, markup with a table → HTML, anything else → CSV text. */
export function sniffSpreadsheet(data: Uint8Array): SpreadsheetKind {
  if (data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) return 'xlsx';
  if (data.length >= 8 && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((b, i) => data[i] === b)) return 'xls';
  const head = decodeText(data.subarray(0, 4096)).toLowerCase();
  return /<table[\s>]/.test(head) || (/<html[\s>]/.test(head) && /<table[\s>]/.test(decodeText(data).toLowerCase())) ? 'html' : 'text';
}

/** Any supported workbook (.xlsx, .xls BIFF, HTML table). Throws XLS_NOT_SPREADSHEET for plain text (the caller parses it as CSV/TSV). */
export async function readSpreadsheet(data: ArrayBuffer | Uint8Array): Promise<XlsxBook> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const kind = sniffSpreadsheet(buf);
  if (kind === 'xlsx') return readXlsx(buf);
  if (kind === 'xls') return readXls(buf);
  if (kind === 'html') return readHtmlTable(decodeText(buf));
  throw new Error('XLS_NOT_SPREADSHEET');
}

/** UTF-8 first (BOM or valid sequence); EUC-KR (CP949) otherwise — the usual encoding of Korean HTML/CSV exports. */
export function decodeText(data: Uint8Array): string {
  const charset = /charset\s*=\s*["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(data.subarray(0, 2048)))?.[1]?.toLowerCase();
  if (charset && !/utf-?8/.test(charset)) { try { return new TextDecoder(charset).decode(data); } catch { /* unknown label: fall through */ } }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^﻿/, ''); }
  catch { try { return new TextDecoder('euc-kr').decode(data); } catch { return new TextDecoder('utf-8').decode(data); } }
}

// ------------------------------------------------------------------------------------------------ number / cell helpers

/** Numeric cell → text the way the .xlsx reader prints it (1234567890, 12.5, no float noise). */
export function xlsNumberText(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return n.toFixed(0);
  return String(Number(n.toPrecision(15)));
}

/** RK number (MS-XLS 2.5.217): bit0 = ÷100, bit1 = 30-bit signed integer, else the high 30 bits of an IEEE double. */
export function decodeRk(rk: number): number {
  const div100 = (rk & 1) === 1;
  let v: number;
  if (rk & 2) v = (rk >> 2);
  else { const dv = new DataView(new ArrayBuffer(8)); dv.setUint32(4, rk & 0xfffffffc, true); dv.setUint32(0, 0, true); v = dv.getFloat64(0, true); }
  return div100 ? v / 100 : v;
}

const BIFF_ERRORS: Record<number, string> = { 0x00: '#NULL!', 0x07: '#DIV/0!', 0x0f: '#VALUE!', 0x17: '#REF!', 0x1d: '#NAME?', 0x24: '#NUM!', 0x2a: '#N/A' };

class SheetBuilder {
  cells = new Map<string, string>(); maxRow = 0; maxCol = 0;
  set(row0: number, col0: number, value: string) {
    if (value === '') return;
    this.cells.set(`${colName(col0 + 1)}${row0 + 1}`, value);
    this.maxRow = Math.max(this.maxRow, row0 + 1); this.maxCol = Math.max(this.maxCol, col0 + 1);
  }
  build(name: string): XlsxSheet { return { name, cells: this.cells, maxRow: this.maxRow, maxCol: this.maxCol }; }
}

// ------------------------------------------------------------------------------------------------ OLE2 compound file

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

interface DirEntry { name: string; type: number; start: number; size: number }

/** MS-CFB reader: FAT (via header + DIFAT), directory, mini stream. Returns the bytes of a named stream. */
function compoundFile(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sectorSize = 1 << dv.getUint16(0x1e, true);
  const miniSectorSize = 1 << dv.getUint16(0x20, true);
  const numFat = dv.getUint32(0x2c, true);
  const firstDir = dv.getUint32(0x30, true);
  const cutoff = dv.getUint32(0x38, true);
  const firstMiniFat = dv.getUint32(0x3c, true);
  const firstDifat = dv.getUint32(0x44, true);
  if (sectorSize !== 512 && sectorSize !== 4096) throw new Error('XLS_BAD_HEADER');
  const off = (sid: number) => (sid + 1) * sectorSize; // sector 0 follows the header sector (512 bytes in v3, padded to 4096 in v4)

  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < numFat; i++) { const s = dv.getUint32(0x4c + i * 4, true); if (s !== FREESECT) fatSectors.push(s); }
  let difat = firstDifat; let guard = 0;
  while (difat !== ENDOFCHAIN && difat !== FREESECT && fatSectors.length < numFat && guard++ < 10_000) {
    const base = off(difat); const per = sectorSize / 4 - 1;
    for (let i = 0; i < per && fatSectors.length < numFat; i++) { const s = dv.getUint32(base + i * 4, true); if (s !== FREESECT) fatSectors.push(s); }
    difat = dv.getUint32(base + per * 4, true);
  }
  const fat: number[] = [];
  for (const s of fatSectors) { const base = off(s); if (base + sectorSize > buf.length) throw new Error('XLS_TRUNCATED'); for (let i = 0; i < sectorSize / 4; i++) fat.push(dv.getUint32(base + i * 4, true)); }

  const chain = (start: number, next: number[]): number[] => {
    const out: number[] = []; const seen = new Set<number>();
    for (let s = start; s !== ENDOFCHAIN && s !== FREESECT && s < next.length; s = next[s]!) { if (seen.has(s)) throw new Error('XLS_BAD_CHAIN'); seen.add(s); out.push(s); }
    return out;
  };
  const readChain = (start: number, size?: number): Uint8Array => {
    const sids = chain(start, fat);
    const out = new Uint8Array(sids.length * sectorSize);
    sids.forEach((sid, i) => out.set(buf.subarray(off(sid), off(sid) + sectorSize), i * sectorSize));
    return size === undefined ? out : out.subarray(0, Math.min(size, out.length));
  };

  const dirBytes = readChain(firstDir);
  const ddv = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);
  const entries: DirEntry[] = [];
  for (let p = 0; p + 128 <= dirBytes.length; p += 128) {
    const nameLen = ddv.getUint16(p + 0x40, true);
    const type = dirBytes[p + 0x42]!;
    if (!type) continue;
    const name = new TextDecoder('utf-16le').decode(dirBytes.subarray(p, p + Math.max(0, Math.min(64, nameLen) - 2)));
    entries.push({ name, type, start: ddv.getUint32(p + 0x74, true), size: ddv.getUint32(p + 0x78, true) });
  }
  const root = entries.find((e) => e.type === 5);
  let miniStream: Uint8Array | null = null; let miniFat: number[] | null = null;
  const readMini = (start: number, size: number): Uint8Array => {
    if (!root) throw new Error('XLS_NO_ROOT');
    miniStream ??= readChain(root.start, root.size);
    if (!miniFat) { const b = readChain(firstMiniFat); const v = new DataView(b.buffer, b.byteOffset, b.byteLength); miniFat = Array.from({ length: b.length / 4 }, (_, i) => v.getUint32(i * 4, true)); }
    const sids = chain(start, miniFat);
    const out = new Uint8Array(sids.length * miniSectorSize);
    sids.forEach((sid, i) => out.set(miniStream!.subarray(sid * miniSectorSize, (sid + 1) * miniSectorSize), i * miniSectorSize));
    return out.subarray(0, size);
  };
  return {
    stream(names: string[]): Uint8Array | null {
      const e = entries.find((x) => x.type === 2 && names.some((n) => n.toLowerCase() === x.name.toLowerCase()));
      if (!e) return null;
      return e.size < cutoff ? readMini(e.start, e.size) : readChain(e.start, e.size);
    },
  };
}

// ------------------------------------------------------------------------------------------------ BIFF records

interface Rec { type: number; data: Uint8Array; offset: number }

function records(stream: Uint8Array, from = 0): Rec[] {
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const out: Rec[] = [];
  let depth = 0;
  for (let p = from; p + 4 <= stream.length;) {
    const type = dv.getUint16(p, true); const len = dv.getUint16(p + 2, true);
    out.push({ type, data: stream.subarray(p + 4, p + 4 + len), offset: p });
    p += 4 + len;
    if (type === 0x0809) depth++;
    if (type === 0x000a && --depth <= 0) break; // EOF of this substream (an embedded chart has its own BOF/EOF pair)
  }
  return out;
}

/** Reads across a record and its CONTINUE records; a split character run restarts with a 1-byte encoding flag (MS-XLS 2.5.293). */
class SegReader {
  private i = 0; private p = 0;
  constructor(private readonly segs: Uint8Array[]) {}
  private ensure() { while (this.i < this.segs.length && this.p >= this.segs[this.i]!.length) { this.i++; this.p = 0; } if (this.i >= this.segs.length) throw new Error('XLS_SHORT_RECORD'); }
  u8(): number { this.ensure(); return this.segs[this.i]![this.p++]!; }
  u16(): number { return this.u8() | (this.u8() << 8); }
  u32(): number { return (this.u16() | (this.u16() << 16)) >>> 0; }
  skip(n: number) { for (let k = 0; k < n; k++) this.u8(); }
  get done() { return this.i >= this.segs.length || (this.i === this.segs.length - 1 && this.p >= this.segs[this.i]!.length); }
  chars(cch: number, high: boolean): string {
    let out = ''; let left = cch; let hi = high;
    while (left > 0) {
      if (this.i < this.segs.length && this.p >= this.segs[this.i]!.length) { this.i++; this.p = 0; if (this.i >= this.segs.length) break; hi = (this.segs[this.i]![this.p++]! & 1) === 1; continue; }
      if (this.i >= this.segs.length) break;
      const seg = this.segs[this.i]!;
      const fit = Math.min(left, Math.floor((seg.length - this.p) / (hi ? 2 : 1)));
      if (fit <= 0) { this.p = seg.length; continue; }
      const bytes = seg.subarray(this.p, this.p + fit * (hi ? 2 : 1));
      out += hi ? new TextDecoder('utf-16le').decode(bytes) : Array.from(bytes, (b) => String.fromCharCode(b)).join('');
      this.p += bytes.length; left -= fit;
    }
    return out;
  }
  /** XLUnicodeRichExtendedString (SST entries). */
  richString(): string {
    const cch = this.u16(); const flags = this.u8();
    const runs = flags & 0x08 ? this.u16() : 0; const ext = flags & 0x04 ? this.u32() : 0;
    const s = this.chars(cch, (flags & 1) === 1);
    this.skip(runs * 4 + ext);
    return s;
  }
}

/** BIFF5 strings are 8-bit in the workbook code page (CODEPAGE record). */
function codepageDecoder(cp: number): TextDecoder {
  const label = cp === 949 ? 'euc-kr' : cp === 932 ? 'shift_jis' : cp === 936 ? 'gbk' : cp === 950 ? 'big5' : cp === 1200 ? 'utf-16le' : cp === 65001 ? 'utf-8' : cp >= 1250 && cp <= 1258 ? `windows-${cp}` : 'windows-1252';
  try { return new TextDecoder(label); } catch { return new TextDecoder('windows-1252'); }
}

/** .xls (BIFF8; BIFF5 too) → XlsxBook. Encrypted workbooks (FILEPASS) are refused like an unreadable file. */
export function readXls(data: ArrayBuffer | Uint8Array): XlsxBook {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const wb = compoundFile(buf).stream(['Workbook', 'Book']);
  if (!wb) throw new Error('XLS_NO_WORKBOOK');
  const globals = records(wb);
  const bof = globals[0];
  if (!bof || (bof.type !== 0x0809 && bof.type !== 0x0409)) throw new Error('XLS_NOT_BIFF');
  const biff8 = new DataView(bof.data.buffer, bof.data.byteOffset, bof.data.byteLength).getUint16(0, true) >= 0x0600;
  let codepage = 1252;
  const sheets: { name: string; pos: number }[] = [];
  let sst: string[] = [];
  for (let k = 0; k < globals.length; k++) {
    const r = globals[k]!;
    const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
    if (r.type === 0x002f) throw new Error('XLS_ENCRYPTED');
    if (r.type === 0x0042 && r.data.length >= 2) codepage = dv.getUint16(0, true);
    if (r.type === 0x0085 && r.data.length >= 7) {
      const pos = dv.getUint32(0, true); const sheetType = r.data[5]!;
      const cch = r.data[6]!;
      let name: string;
      if (biff8) { const high = (r.data[7]! & 1) === 1; name = new SegReader([r.data.subarray(8)]).chars(cch, high); }
      else name = codepageDecoder(codepage).decode(r.data.subarray(7, 7 + cch));
      if (sheetType === 0) sheets.push({ name, pos }); // worksheets only (no chart / macro sheets)
    }
    if (r.type === 0x00fc && biff8) {
      const segs = [r.data.subarray(8)];
      while (globals[k + 1]?.type === 0x003c) segs.push(globals[++k]!.data);
      const unique = dv.getUint32(4, true);
      const rd = new SegReader(segs);
      sst = [];
      for (let n = 0; n < unique && !rd.done; n++) sst.push(rd.richString());
    }
  }
  const dec = codepageDecoder(codepage);
  /** LABEL / STRING payload: BIFF8 XLUnicodeString (cch u16 + flags), BIFF5 byte string (u16 length). */
  const shortString = (segs: Uint8Array[]): string => {
    const rd = new SegReader(segs);
    const cch = rd.u16();
    if (!biff8) { const first = segs[0]!; return dec.decode(first.subarray(2, 2 + cch)); }
    const flags = rd.u8();
    return rd.chars(cch, (flags & 1) === 1);
  };
  const cache = new Map<number, XlsxSheet>();
  return {
    sheetNames: sheets.map((s) => s.name),
    sheet: async (index: number) => {
      const meta = sheets[index];
      if (!meta) return null;
      const hit = cache.get(index); if (hit) return hit;
      const recs = records(wb, meta.pos);
      const out = new SheetBuilder();
      let pendingFormula: { row: number; col: number } | null = null;
      for (let k = 0; k < recs.length; k++) {
        const r = recs[k]!;
        const d = r.data; const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
        const withContinues = () => { const segs = [d]; while (recs[k + 1]?.type === 0x003c) segs.push(recs[++k]!.data); return segs; };
        switch (r.type) {
          case 0x00fd: if (d.length >= 10) out.set(dv.getUint16(0, true), dv.getUint16(2, true), sst[dv.getUint32(6, true)] ?? ''); break; // LABELSST
          case 0x0204: case 0x00d6: { // LABEL / RSTRING
            const segs = withContinues(); const row = dv.getUint16(0, true); const col = dv.getUint16(2, true);
            out.set(row, col, shortString([segs[0]!.subarray(6), ...segs.slice(1)]));
            break;
          }
          case 0x0203: if (d.length >= 14) out.set(dv.getUint16(0, true), dv.getUint16(2, true), xlsNumberText(dv.getFloat64(6, true))); break; // NUMBER
          case 0x027e: if (d.length >= 10) out.set(dv.getUint16(0, true), dv.getUint16(2, true), xlsNumberText(decodeRk(dv.getUint32(6, true)))); break; // RK
          case 0x00bd: { // MULRK
            const row = dv.getUint16(0, true); const first = dv.getUint16(2, true); const n = Math.floor((d.length - 6) / 6);
            for (let j = 0; j < n; j++) out.set(row, first + j, xlsNumberText(decodeRk(dv.getUint32(4 + j * 6 + 2, true))));
            break;
          }
          case 0x0205: { // BOOLERR
            if (d.length < 8) break;
            const v = d[6]!; const isErr = d[7] === 1;
            out.set(dv.getUint16(0, true), dv.getUint16(2, true), isErr ? BIFF_ERRORS[v] ?? '#ERR' : v ? 'TRUE' : 'FALSE');
            break;
          }
          case 0x0006: { // FORMULA: cached result
            if (d.length < 14) break;
            const row = dv.getUint16(0, true); const col = dv.getUint16(2, true);
            if (dv.getUint16(12, true) === 0xffff) {
              const t = d[6]!;
              if (t === 0) pendingFormula = { row, col };
              else if (t === 1) out.set(row, col, d[8] ? 'TRUE' : 'FALSE');
              else if (t === 2) out.set(row, col, BIFF_ERRORS[d[8]!] ?? '#ERR');
            } else out.set(row, col, xlsNumberText(dv.getFloat64(6, true)));
            break;
          }
          case 0x0207: { // STRING (result of the preceding string formula)
            const segs = withContinues();
            if (pendingFormula) { out.set(pendingFormula.row, pendingFormula.col, shortString(segs)); pendingFormula = null; }
            break;
          }
          default: break;
        }
      }
      const sheet = out.build(meta.name);
      cache.set(index, sheet);
      return sheet;
    },
  };
}

// ------------------------------------------------------------------------------------------------ HTML table ".xls"

/** PHPExcel_Reader_HTML: one sheet; every <tr> is a row, <td>/<th> cells with colspan advancing the column (rowspan reserves the cells below). */
export function readHtmlTable(html: string): XlsxBook {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = new SheetBuilder();
  const taken = new Set<string>();
  let row = 0;
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    let col = 0;
    for (const cell of Array.from(tr.children).filter((c) => c.localName === 'td' || c.localName === 'th')) {
      while (taken.has(`${row}:${col}`)) col++;
      const text = (cell.textContent ?? '').replace(/ /g, ' ').trim();
      out.set(row, col, text);
      const span = Math.max(1, Number(cell.getAttribute('colspan')) || 1); const rows = Math.max(1, Number(cell.getAttribute('rowspan')) || 1);
      for (let r = 1; r < rows; r++) for (let c = 0; c < span; c++) taken.add(`${row + r}:${col + c}`);
      col += span;
    }
    row++;
  }
  const sheet = out.build('Sheet1');
  return { sheetNames: ['Sheet1'], sheet: async (index: number) => (index === 0 ? sheet : null) };
}
