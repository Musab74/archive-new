/**
 * 엑셀 일괄 수강등록 — browser-side mapping of pasted Excel rows (TSV) or a CSV/TSV file into the rows POST /admin/enrollments/import expects.
 * Same column order as the legacy sheet (lecture_reg_excel_upload.php columns A..U). Pure functions; tested in src/test/ruby-ops.test.tsx.
 */
import type { EnrollImportPlanRow, EnrollImportResult } from '../../../../shared/api/endpoints/admin-ruby-ops';
export { parseDelimited, downloadText } from '../companies/companyImport';

export const ENROLL_KEYS = ['LectureCode', 'ContentsName', 'Tutor', 'Name', 'ResNo', 'Mobile', 'Email', 'CompanyCode', 'CompanyName', 'Depart', 'LectureStart', 'LectureEnd', 'ServiceType', 'UserID', 'Pwd', 'nwIno', 'trneeSe', 'IrglbrSe', 'OpenChapter', 'SalesID', 'EduManager'] as const;
export type EnrollKey = (typeof ENROLL_KEYS)[number];
export type EnrollRow = Record<EnrollKey, string | null>;

/** Korean header labels (the comments of lecture_reg_excel_upload.php), used for the template and header detection. */
export const ENROLL_LABELS: Record<EnrollKey, string> = {
  LectureCode: '강의코드', ContentsName: '과정명', Tutor: '첨삭강사', Name: '성명', ResNo: '주민번호', Mobile: '휴대폰', Email: '이메일', CompanyCode: '사업자번호', CompanyName: '기업명', Depart: '부서',
  LectureStart: '수강시작일', LectureEnd: '수강종료일', ServiceType: '서비스구분', UserID: '수강생아이디', Pwd: '비밀번호', nwIno: '비용수급사업장', trneeSe: '훈련생구분', IrglbrSe: '비정규직구분', OpenChapter: '실시회차', SalesID: '영업담당자아이디', EduManager: '교육담당자여부',
};
const ALIASES: Record<string, EnrollKey> = {
  강의코드: 'LectureCode', 과정코드: 'LectureCode', 과정명: 'ContentsName', 강의명: 'ContentsName', 첨삭강사: 'Tutor', 강사: 'Tutor', 성명: 'Name', 이름: 'Name', 주민번호: 'ResNo', 주민등록번호: 'ResNo', 휴대폰: 'Mobile', 휴대폰번호: 'Mobile', 연락처: 'Mobile', 이메일: 'Email',
  사업자번호: 'CompanyCode', 사업자등록번호: 'CompanyCode', 기업명: 'CompanyName', 회사명: 'CompanyName', 부서: 'Depart', 부서명: 'Depart', 수강시작일: 'LectureStart', 시작일: 'LectureStart', 수강시작: 'LectureStart', 수강종료일: 'LectureEnd', 종료일: 'LectureEnd', 수강종료: 'LectureEnd',
  서비스구분: 'ServiceType', 구분: 'ServiceType', 수강생아이디: 'UserID', 아이디: 'UserID', 비밀번호: 'Pwd', 비용수급사업장: 'nwIno', 훈련생구분: 'trneeSe', 비정규직구분: 'IrglbrSe', 실시회차: 'OpenChapter', 회차: 'OpenChapter', 영업담당자아이디: 'SalesID', 영업자아이디: 'SalesID', 영업담당자: 'SalesID', 교육담당자여부: 'EduManager', 교육담당자: 'EduManager',
};
for (const k of ENROLL_KEYS) ALIASES[k.toLowerCase()] = k;
const normHeader = (h: string) => h.replace(/[\s_()\-/·.:*]/g, '').toLowerCase();

export interface MappedEnrollImport { rows: EnrollRow[]; headerDetected: boolean; columns: EnrollKey[]; unknownHeaders: string[] }

/** Table → import rows; a header row (≥3 known labels) drives the mapping, otherwise the legacy A..U order is assumed. Empty cells → null. */
export function mapEnrollRows(table: string[][]): MappedEnrollImport {
  if (!table.length) return { rows: [], headerDetected: false, columns: [], unknownHeaders: [] };
  const first = table[0]!;
  const matched = first.map((h) => ALIASES[normHeader(h)] ?? null);
  const headerDetected = matched.filter(Boolean).length >= 3;
  const columns: (EnrollKey | null)[] = headerDetected ? matched : [...ENROLL_KEYS];
  const unknownHeaders = headerDetected ? first.filter((h, i) => !matched[i] && h.trim() !== '') : [];
  const body = headerDetected ? table.slice(1) : table;
  const rows = body.map((cells) => {
    const r = Object.fromEntries(ENROLL_KEYS.map((k) => [k, null])) as EnrollRow;
    columns.forEach((k, i) => { if (!k) return; const v = (cells[i] ?? '').trim(); if (v !== '') r[k] = v; });
    return r;
  });
  return { rows, headerDetected, columns: columns.filter((c): c is EnrollKey => !!c), unknownHeaders };
}

/**
 * Uploaded sheet (lecture_reg_excel_upload.php reads from row 2): row 1 is always the header row and is skipped. When it carries the
 * legacy labels the columns are mapped by name, otherwise by the A..U position. Rows without any value are dropped.
 */
export function mapEnrollFileTable(table: string[][]): MappedEnrollImport {
  if (!table.length) return { rows: [], headerDetected: false, columns: [], unknownHeaders: [] };
  const first = table[0]!;
  const matched = first.map((h) => ALIASES[normHeader(h)] ?? null);
  const headerDetected = matched.filter(Boolean).length >= 3;
  const m = headerDetected ? mapEnrollRows(table) : mapEnrollRows(table.slice(1));
  return { ...m, rows: m.rows.filter((r) => Object.values(r).some((v) => v !== null)), headerDetected };
}

/** $TRNEE_SE_array / $IRGLBR_SE_array labels (include_function_cron.php) for the 훈련생구분 / 비정규직구분 columns. */
export const TRNEE_SE_LABELS: Record<string, string> = { '002': '구직자', '003': '채용예정자', '006': '전직/이직예정자', '007': '자사근로자', '008': '타사근로자', '013': '일용근로자', '983': '취득예정자(일용포함)', '984': '고용유지훈련', '985': '적용제외근로자' };
export const IRGLBR_SE_LABELS: Record<string, string> = { '000': '비정규직해당없음', '012': '파견근로자', '013': '일용근로자', '014': '기간제근로자', '020': '단기간근로자', '021': '무급휴업/휴직자', '022': '임의가입자영업자', '987': '분류불능' };
/** $ServiceType2_array */
export const SERVICE_TYPE2_LABELS: Record<string, string> = { A: '패키지', X: '이러닝', Y: '숏폼', Z: '마이크로닝', W: '비환급' };

/** ID_Validity() + hanCheck() of hrd_manager/include/function.js: 4–20 characters, letters and digits only. Returns the alert or null. */
export function idValidityError(v: string): string | null {
  if (v.length < 4 || v.length > 20) return '아이디는 4자이상 20자 이내로 입력하세요.';
  if (!/^[A-Za-z0-9]+$/.test(v)) return '아이디는 영문/숫자만 입력 가능합니다.';
  return null;
}

/**
 * lecture_reg_edit.php LectureEditSubmitOk(): the alerts, in the PHP order. Returns the first message or null.
 */
export function editRowError(r: EnrollRow): string | null {
  const v = (k: EnrollKey) => String(r[k] ?? '').trim();
  if (!v('Tutor')) return '첨삭강사 아이디를 입력하세요.';
  if (!v('Name')) return '수강생 이름을 입력하세요.';
  if (!v('ResNo')) return '주민등록번호를 입력하세요.';
  if (!v('Mobile')) return '휴대폰을 입력하세요.';
  if (!v('CompanyCode')) return '사업자번호를 입력하세요.';
  if (!v('LectureStart') || !v('LectureEnd')) return '수강 기간을 입력하세요.';
  if (!v('SalesID')) return '영업담당자 아이디를 입력하세요.';
  if (v('UserID')) { const e = idValidityError(v('UserID')); if (e) return e; }
  if (v('OpenChapter') && !/^\d+$/.test(v('OpenChapter'))) return '실시회차는 숫자만 입력하세요.';
  return null;
}

/** Header row (+ optional sample) for the template download. */
export function buildEnrollTemplateCsv(withSample: boolean): string {
  const header = ENROLL_KEYS.map((k) => ENROLL_LABELS[k]);
  const sample = ['ARC2026', '2026 아카이브', '', '홍길동', '900101-1234567', '010-1234-5678', 'hong@example.com', '1234567890', '테스트기업', '개발팀', '2026-03-01', '2026-05-31', 'A', '', '1111', '', '007', '000', '1', 'B032', 'N'];
  const q = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + header.map(q).join(',') + '\r\n' + (withSample ? sample.map(q).join(',') + '\r\n' : '');
}

/** "900101-1234567" → "900101-1******" for the on-screen preview (the API never echoes the number). */
export function maskResNo(v: string | null | undefined): string {
  const s = String(v ?? '').replace(/\s+/g, '');
  if (!s) return '';
  const digits = s.replace(/-/g, '');
  return digits.length >= 7 ? `${digits.slice(0, 6)}-${digits.slice(6, 7)}******` : `${s.slice(0, 6)}…`;
}

// ---------------------------------------------------------------- 수강 등록하기 — one row per request (lecture_reg_complete.php)

type Applied = NonNullable<EnrollImportResult['applied']>;
/** A row as the console shows it after one row-by-row request (its own sheet line, "엑셀 N번" label). */
const atLine = (r: EnrollImportPlanRow, line: number): EnrollImportPlanRow => ({ ...r, line, rowLabel: !r.rowLabel || /^엑셀 \d+번$/.test(r.rowLabel) ? (r.userId && !r.generatedId ? r.userId : r.name || `엑셀 ${line}번`) : r.rowLabel });

/**
 * LectureRegistSubmitOk() of the PHP page: registers the checked batch ROW BY ROW — each 'enroll' row is sent alone
 * (POST /admin/enrollments/import, mode commit, firstLine = its sheet line) and its 상태 changes 대기 → 처리중 → 등록/오류
 * as soon as that row's request returns, like the per-idx lecture_reg_complete.php calls. Error rows of the check are never
 * sent (they stay 오류). A failed request marks that row 오류 and the loop continues with the next row.
 * Returns the batch in the commit shape (summary of the check + summed `applied`).
 */
export async function registerRowByRow(opts: {
  plan: EnrollImportResult;
  rows: EnrollRow[];
  send: (row: EnrollRow, line: number) => Promise<EnrollImportResult>;
  onRow: (line: number, state: 'processing' | EnrollImportPlanRow) => void;
  errorText?: (err: unknown) => string;
}): Promise<EnrollImportResult> {
  const { plan, rows, send, onRow } = opts;
  const applied: Applied = { enrolled: 0, membersCreated: 0, membersUpdated: 0, termsCreated: 0, skipped: plan.summary.error + plan.summary.skip, failed: 0, studySeqs: [] };
  const out = plan.rows.map((r) => ({ ...r }));
  for (let i = 0; i < out.length; i++) {
    const p = out[i]!;
    if (p.action !== 'enroll') continue;
    const input = rows[p.line - 1];
    if (!input) continue;
    onRow(p.line, 'processing');
    let next: EnrollImportPlanRow;
    try {
      const res = await send(input, p.line);
      const got = res.rows[0];
      next = got ? atLine(got, p.line) : { ...p, action: 'error', status: 'error', errors: [...p.errors, '응답에 결과 행이 없습니다.'] };
      const a = res.applied;
      if (a) {
        applied.enrolled += a.enrolled; applied.membersCreated += a.membersCreated; applied.membersUpdated += a.membersUpdated; applied.termsCreated += a.termsCreated;
        applied.failed += a.failed; applied.studySeqs.push(...a.studySeqs);
      }
      // the row failed the re-check at registration time (e.g. a study created meanwhile) — counted as an error, not a skip
      if (next.status === 'error' && !(a?.failed)) applied.failed++;
    } catch (err) {
      next = { ...p, action: 'error', status: 'error', errors: [...p.errors, opts.errorText ? opts.errorText(err) : '등록 요청이 실패했습니다.'] };
      applied.failed++;
    }
    out[i] = next;
    onRow(p.line, next);
  }
  return { mode: 'commit', summary: plan.summary, rows: out, applied };
}
