/**
 * 엑셀 일괄 수강등록 — browser-side mapping of pasted Excel rows (TSV) or a CSV/TSV file into the rows POST /admin/enrollments/import expects.
 * Same column order as the legacy sheet (lecture_reg_excel_upload.php columns A..U). Pure functions; tested in src/test/ruby-ops.test.tsx.
 */
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
