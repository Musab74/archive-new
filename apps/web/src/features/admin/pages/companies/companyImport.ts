/**
 * 엑셀로 등록 — browser-side parsing of pasted Excel rows (TSV) or a CSV/TSV file into the rows POST /admin/companies/import expects.
 * Pure functions; tested in src/test/companyImport.test.ts.
 */

export const IMPORT_KEYS = ['CompanyName', 'CompanyID', 'CompanyScale', 'CompanyCode', 'HRD', 'Ceo', 'Zipcode', 'Address01', 'Address02', 'Uptae', 'Upjong', 'Tel', 'Email', 'EduManager', 'EduManagerPhone', 'EduManagerEmail', 'SalesManager', 'Remark', 'CyberEnabled', 'Tel2', 'Fax2', 'CSEnabled', 'HomePage'] as const;
export type ImportKey = (typeof IMPORT_KEYS)[number];
export type ImportRow = Record<ImportKey, string | null>;

/** Korean labels of the legacy 사업주정보.xlsx template (columns A..W, company_excel_upload.php) and a few common variants. */
export const HEADER_LABELS: Record<ImportKey, string> = {
  CompanyName: '회사명', CompanyID: '사업주아이디', CompanyScale: '회사규모', CompanyCode: '사업자등록번호', HRD: 'HRD번호', Ceo: '대표자명', Zipcode: '우편번호', Address01: '주소', Address02: '상세주소', Uptae: '업태', Upjong: '업종',
  Tel: '회사전화번호', Email: '이메일', EduManager: '교육담당자', EduManagerPhone: '교육담당자연락처', EduManagerEmail: '교육담당자이메일', SalesManager: '영업담당자ID', Remark: '메모', CyberEnabled: '사이버교육센터', Tel2: '고객센터번호', Fax2: '고객센터팩스번호', CSEnabled: '고객센터번호사용여부', HomePage: '기업관리코드',
};
const ALIASES: Record<string, ImportKey> = {
  회사명: 'CompanyName', 기업명: 'CompanyName', 사업주아이디: 'CompanyID', 사업주id: 'CompanyID', 사업주아이디id: 'CompanyID', 회사규모: 'CompanyScale', 규모: 'CompanyScale', 사업자등록번호: 'CompanyCode', 사업자번호: 'CompanyCode', hrd번호: 'HRD', hrd: 'HRD', 대표자명: 'Ceo', 대표자: 'Ceo', 우편번호: 'Zipcode', 주소: 'Address01', 상세주소: 'Address02', 나머지주소: 'Address02',
  업태: 'Uptae', 업종: 'Upjong', 회사전화번호: 'Tel', 대표전화번호: 'Tel', 전화번호: 'Tel', 이메일: 'Email', 세금계산서이메일: 'Email', 교육담당자: 'EduManager', 교육담당자명: 'EduManager', 교육담당자연락처: 'EduManagerPhone', 교육담당자휴대폰: 'EduManagerPhone', 교육담당자이메일: 'EduManagerEmail',
  영업담당자id: 'SalesManager', 영업담당자아이디: 'SalesManager', 영업담당자: 'SalesManager', 영업자id: 'SalesManager', 메모: 'Remark',
  // sample/사업주정보.xlsx header row (A..W)
  회사아이디: 'CompanyID', hrd코드: 'HRD', 회사주소: 'Address01', 종목: 'Upjong', 전자계산서이메일: 'Email', 회사교육담당자: 'EduManager', 회사교육담당자전화번호: 'EduManagerPhone', 회사교육담당자이메일: 'EduManagerEmail', 사이버교육센터: 'CyberEnabled', 사이버교육센터사용여부: 'CyberEnabled', 고객센터번호: 'Tel2', 고객센터전화번호: 'Tel2', 고객센터팩스번호: 'Fax2', 고객센터번호사용여부: 'CSEnabled', 고객센터전화번호사용여부: 'CSEnabled', 기업관리코드: 'HomePage', 홈페이지: 'HomePage',
};
for (const k of IMPORT_KEYS) ALIASES[k.toLowerCase()] = k;

const SCALE_BY_LABEL: Record<string, string> = { 우선지원대상: 'C', '대규모1000인이상': 'A', '대규모1000인미만': 'B', a: 'A', b: 'B', c: 'C' };
export function scaleToCode(v: string | null | undefined): string | null {
  const key = String(v ?? '').replace(/\s+/g, '').toLowerCase();
  if (!key) return null;
  return SCALE_BY_LABEL[key] ?? String(v).trim().toUpperCase().slice(0, 1);
}

/** Minimal RFC 4180 / TSV parser: auto-detects the delimiter (tab wins when present in the first line), handles quoted cells, CRLF, and a BOM. */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  if (!src.trim()) return [];
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') { quoted = true; continue; }
    if (ch === delim) { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const normHeader = (h: string) => h.replace(/[\s_()\-/·.:]/g, '').replace(/\*/g, '').toLowerCase();

export interface MappedImport { rows: ImportRow[]; headerDetected: boolean; columns: ImportKey[]; unknownHeaders: string[] }

/**
 * Table → import rows. When the first row looks like a header (≥3 cells match a known label) it drives the mapping;
 * otherwise the legacy template order A..W is assumed. Empty cells become null; the scale label is mapped to its code.
 */
export function mapImportRows(table: string[][]): MappedImport {
  if (!table.length) return { rows: [], headerDetected: false, columns: [], unknownHeaders: [] };
  const first = table[0]!;
  const matched = first.map((h) => ALIASES[normHeader(h)] ?? null);
  const headerDetected = matched.filter(Boolean).length >= 3;
  const columns: (ImportKey | null)[] = headerDetected ? matched : [...IMPORT_KEYS];
  const unknownHeaders = headerDetected ? first.filter((h, i) => !matched[i] && h.trim() !== '') : [];
  const body = headerDetected ? table.slice(1) : table;
  const rows = body.map((cells) => {
    const r = Object.fromEntries(IMPORT_KEYS.map((k) => [k, null])) as ImportRow;
    columns.forEach((k, i) => { if (!k) return; const v = (cells[i] ?? '').trim(); if (v !== '') r[k] = v; });
    r.CompanyScale = scaleToCode(r.CompanyScale);
    return r;
  });
  return { rows, headerDetected, columns: columns.filter((c): c is ImportKey => !!c), unknownHeaders };
}

/** Header row (+ optional sample line) for the download button. */
export function buildTemplateCsv(withSample: boolean): string {
  const header = IMPORT_KEYS.map((k) => HEADER_LABELS[k]);
  const sample = ['(주)예시기업', 'example001', '우선지원대상', '1234567890', 'HRD-0001', '홍길동', '06236', '서울특별시 강남구 테헤란로 1', '2층', '서비스', '교육', '02-123-4567', 'tax@example.com', '김담당', '010-1234-5678', 'edu@example.com', 'B032', '메모', 'N', '02-123-4568', '02-123-4569', 'Y', 'example001'];
  const q = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + header.map(q).join(',') + '\r\n' + (withSample ? sample.map(q).join(',') + '\r\n' : '');
}

/** Trigger a client-side download of generated text. */
export function downloadText(name: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const href = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = href; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// ---------------------------------------------------------------------------------------------- .xlsx (company_excel_upload.php)

/** company_excel_upload.php: a file whose name contains 'HRD 훈련생 등록' is read from the 2nd sheet with a fixed cell map. */
export const isHrdTraineeFile = (name: string) => name.includes('HRD 훈련생 등록');

/** "HRD 훈련생 등록" cell map (B3 회사명, D3 사업자등록번호, B4 대표자, B7 주소, B6 업태, D6 업종, B5 전화, D9 세금계산서 이메일, B8/D8/B9 교육담당자, F3 영업자ID). */
export const HRD_TRAINEE_CELLS: Partial<Record<ImportKey, string>> = { CompanyName: 'B3', CompanyCode: 'D3', Ceo: 'B4', Address01: 'B7', Uptae: 'B6', Upjong: 'D6', Tel: 'B5', Email: 'D9', EduManager: 'B8', EduManagerPhone: 'D8', EduManagerEmail: 'B9', SalesManager: 'F3' };

const emptyRow = (): ImportRow => Object.fromEntries(IMPORT_KEYS.map((k) => [k, null])) as ImportRow;

/** First sheet, data from row 2, columns A..W in template order (the header row is ignored, as in the PHP loop). Blank rows are dropped. */
export function rowsFromTemplateGrid(grid: string[][]): MappedImport {
  const rows = grid.filter((cells) => cells.some((c) => String(c).trim() !== '')).map((cells) => {
    const r = emptyRow();
    IMPORT_KEYS.forEach((k, i) => { const v = String(cells[i] ?? '').trim(); if (v !== '') r[k] = v; });
    r.CompanyScale = scaleToCode(r.CompanyScale);
    return r;
  });
  return { rows, headerDetected: true, columns: [...IMPORT_KEYS], unknownHeaders: [] };
}

/** One company from the "HRD 훈련생 등록" sheet; the API fills CompanyID/HomePage/Remark (format=hrdTrainee). Missing 회사명 or 사업자번호 → no row (PHP). */
export function rowFromHrdTraineeCells(get: (ref: string) => string | undefined): MappedImport {
  const r = emptyRow();
  for (const [k, ref] of Object.entries(HRD_TRAINEE_CELLS) as [ImportKey, string][]) { const v = String(get(ref) ?? '').trim(); if (v !== '') r[k] = v; }
  r.CompanyScale = 'C'; r.Zipcode = '00000'; r.CyberEnabled = 'N'; r.CSEnabled = 'N';
  if (r.CompanyCode) r.CompanyCode = r.CompanyCode.replace(/[-\s]/g, '');
  const ok = !!r.CompanyName && !!r.CompanyCode;
  return { rows: ok ? [r] : [], headerDetected: true, columns: Object.keys(HRD_TRAINEE_CELLS) as ImportKey[], unknownHeaders: [] };
}

/** company_write_excel.php "업로드한 엑셀파일 데이터 확인" two header rows (rowspan 체크/번호 aside). */
export const PREVIEW_ROW1: [ImportKey, string][] = [['CompanyName', '회사명'], ['CompanyID', '회사 아이디'], ['CompanyScale', '회사 규모'], ['CompanyCode', '사업자번호'], ['HRD', 'HRD코드'], ['Ceo', '대표자'], ['Zipcode', '우편번호'], ['Address01', '회사 주소'], ['Address02', '상세 주소'], ['Uptae', '업태'], ['CyberEnabled', '사이버교육센터'], ['HomePage', '기업관리코드']];
export const PREVIEW_ROW2: [ImportKey, string][] = [['Tel', '회사 전화번호'], ['Email', '전자계산서 이메일'], ['EduManager', '회사 교육담당자'], ['EduManagerPhone', '회사 교육담당자 전화번호'], ['EduManagerEmail', '회사 교육담당자 이메일'], ['SalesManager', '영업자ID'], ['Remark', '메모'], ['Tel2', '고객센터 번호'], ['Fax2', '고객센터 팩스번호'], ['Upjong', '종목'], ['CSEnabled', '고객센터 사용여부']];

/** Draft kept in this browser so a reload does not lose the uploaded rows (the PHP kept them in CompanyExcelTemp per admin). */
export interface ImportDraft { rows: ImportRow[]; format: 'template' | 'hrdTrainee'; fileName: string | null; savedAt: string }
export const DRAFT_KEY = 'admin.companies.importDraft.v1';
export function loadDraft(): ImportDraft | null {
  try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return null; const d = JSON.parse(raw) as ImportDraft; return Array.isArray(d.rows) && d.rows.length ? d : null; } catch { return null; }
}
export function saveDraft(d: ImportDraft | null): void {
  try { if (d && d.rows.length) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable: the rows simply stay in memory */ }
}

/** "선택항목 삭제": drop the checked preview lines (1-based) from the batch. */
export function dropLines<T>(rows: T[], lines: Iterable<number>): T[] {
  const drop = new Set(lines);
  return rows.filter((_, i) => !drop.has(i + 1));
}
