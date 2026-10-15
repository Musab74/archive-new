/**
 * 엑셀로 등록 (course_write_excel.php?ctype=R) — browser side: the 컨텐츠.xlsx template columns A..AD, pasted Excel rows / CSV → the
 * rows POST /admin/live-courses/excel expects. Like course_excel_upload.php the first row is the header and cells are read by column
 * position (A = 등급 … AD = 교육비용 대규모 1000인 이상). Pure functions; tested in src/test/content-archive-live.test.tsx.
 */
import { LIVE_EXCEL_KEYS, type LiveExcelKey } from '../../../../shared/api/endpoints/admin-content-archive';
import { parseDelimited } from '../companies/companyImport';
import { readXlsx, sheetRows } from '../companies/xlsxRead';

export const LIVE_EXCEL_LABELS: Record<LiveExcelKey, string> = {
  ClassGrade: '등급', LectureCode: '과정코드', PackageLectureCode: '패키지콘텐츠 과정코드', UseYN: '사이트노출', ContentsURLSelect: '컨텐츠 경로', HrdSeq: '원격훈련일련번호', Category1: '과정분류1', Category2: '과정분류2', ContentsName: '과정명',
  Keyword1: '난이도(직급)', Keyword2: '직무분야', Keyword3: '관심분야', Keyword4: '역량', Chapter: '차시수', ContentsTime: '교육시간', ContentsStart: '콘텐츠 시작일', ContentsEnd: '콘텐츠 종료일', UploadDate: '콘텐츠 업로드일',
  Professor: '교강사', PassTime: '수료기준', Mobile: '모바일지원', BookPrice: '교재비', PreviewImage: '과정이미지', Intro: '과정소개', EduTarget: '교육대상', EduGoal: '교육목표', Price: '교육비용 일반', Price01View: '교육비용 우선지원',
  Price02View: '교육비용 대규모 1000인 미만', Price03View: '교육비용 대규모 1000인 이상',
};
/** Yellow (필수) header columns of the template = the red 미입력 checks of course_excel_list.php. */
export const LIVE_EXCEL_REQUIRED = new Set<LiveExcelKey>(['ClassGrade', 'LectureCode', 'UseYN', 'ContentsURLSelect', 'Category1', 'Category2', 'ContentsName', 'Keyword1', 'Keyword2', 'Keyword3', 'Keyword4', 'Chapter', 'ContentsTime', 'ContentsStart', 'ContentsEnd', 'UploadDate', 'Mobile', 'Intro', 'EduTarget', 'EduGoal']);

/** Table (header row first) → upload rows. Fully empty lines are dropped; missing trailing cells become null. */
export function liveExcelRows(table: string[][]): Record<LiveExcelKey, string | null>[] {
  return table.slice(1).map((cells) => {
    const o = {} as Record<LiveExcelKey, string | null>;
    LIVE_EXCEL_KEYS.forEach((k, i) => { const v = (cells[i] ?? '').trim(); o[k] = v === '' ? null : v; });
    return o;
  }).filter((r) => Object.values(r).some((v) => v !== null));
}

export const parseLiveExcel = (text: string) => liveExcelRows(parseDelimited(text));

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** 양식 다운로드 / 샘플 다운로드 (CSV with BOM instead of ./sample/컨텐츠.xlsx). */
export function liveExcelTemplate(sample: boolean): string {
  const head = LIVE_EXCEL_KEYS.map((k) => `${LIVE_EXCEL_LABELS[k]}${LIVE_EXCEL_REQUIRED.has(k) ? '(필수)' : '(선택)'}`);
  const lines = [head.map(csvCell).join(',')];
  if (sample) {
    const ex: Record<LiveExcelKey, string> = {
      ClassGrade: 'A', LectureCode: 'LIVE0001', PackageLectureCode: '', UseYN: 'Y', ContentsURLSelect: 'A', HrdSeq: '', Category1: '1', Category2: '2', ContentsName: '실시간 특강 예시', Keyword1: '1', Keyword2: '2', Keyword3: '3,4', Keyword4: '5',
      Chapter: '1', ContentsTime: '60', ContentsStart: '2026-01-01', ContentsEnd: '2026-12-31', UploadDate: '2026-01-02', Professor: '홍길동', PassTime: '1', Mobile: 'Y', BookPrice: '0', PreviewImage: '', Intro: '과정 소개', EduTarget: '전 직원', EduGoal: '교육 목표',
      Price: '0', Price01View: '0', Price02View: '0', Price03View: '0',
    };
    lines.push(LIVE_EXCEL_KEYS.map((k) => csvCell(ex[k])).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Excel date serial (days since 1899-12-30, as PHPExcel getValue() returns for a date-formatted cell) → 'YYYY-MM-DD'; other text unchanged. */
export function excelSerialDate(v: string): string {
  if (!/^\d{5}(\.\d+)?$/.test(v)) return v;
  const n = Math.floor(Number(v));
  if (n < 20000 || n > 80000) return v; // 1954..2119 — anything else is not a date serial
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const DATE_COLS = (['ContentsStart', 'ContentsEnd', 'UploadDate'] as const).map((k) => LIVE_EXCEL_KEYS.indexOf(k));

/**
 * course_excel_upload.php with the real 컨텐츠.xlsx: PHPExcel reads the FIRST sheet, row 2..getHighestRow(), cells A..AD by position.
 * Returns the sheet as a table (header row first) for liveExcelRows; date-formatted cells (serials) become YYYY-MM-DD.
 */
export async function liveExcelTableFromXlsx(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const book = await readXlsx(data);
  const sheet = await book.sheet(0);
  if (!sheet) return [];
  return sheetRows(sheet, 1, LIVE_EXCEL_KEYS.length).map((cells, i) => (i === 0 ? cells : cells.map((c, j) => (DATE_COLS.includes(j) ? excelSerialDate(c.trim()) : c))));
}
