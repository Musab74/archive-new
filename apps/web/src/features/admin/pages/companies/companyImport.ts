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
  영업담당자id: 'SalesManager', 영업담당자아이디: 'SalesManager', 영업담당자: 'SalesManager', 메모: 'Remark', 사이버교육센터: 'CyberEnabled', 사이버교육센터사용여부: 'CyberEnabled', 고객센터번호: 'Tel2', 고객센터전화번호: 'Tel2', 고객센터팩스번호: 'Fax2', 고객센터번호사용여부: 'CSEnabled', 고객센터전화번호사용여부: 'CSEnabled', 기업관리코드: 'HomePage', 홈페이지: 'HomePage',
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
