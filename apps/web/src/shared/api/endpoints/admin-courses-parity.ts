import { z } from 'zod';
import { api } from '../client';
import { pageOf } from '../schemas';
import { downloadAdminFile } from './admin';

/**
 * 컨텐츠관리 (D1) parity endpoints — AdminCoursesController: /admin/courses, /admin/course-packages, /admin/contents,
 * /admin/categories, /admin/lists. Mirrors course.php / course_read.php / course_write.php, course_package*.php,
 * contents*.php, course_category*.php and main_contents*.php of hrd_manager.
 */
type Q = Record<string, string | number | boolean | null | undefined>;
const S = z.string().nullable().optional();
const N = z.number().nullable().optional();
const SN = z.union([z.string(), z.number()]).nullable().optional();

export const CpOkSchema = z.object({ ok: z.boolean() }).passthrough();
export type CpOk = z.infer<typeof CpOkSchema>;
const Option = z.object({ value: z.string(), label: z.string() });

export const CpCourseRowSchema = z.object({
  idx: z.number(), ctype: S, lectureCode: z.string(), name: S, useYN: S, useLabel: z.string(), hrdCode: S, category1: SN, category2: SN, keyword1: SN, keyword2: SN, contentsTime: S, chapter: S, chapterLabel: z.string(), chapterRows: z.number(),
  isPackage: z.boolean(), packageCodes: z.array(z.string()), packageLectureCode: S, packageCount: z.number(), packageRef: N, packageRefPad: z.string(), image: S, professor: S, price: z.number(), passTime: z.number(), regDate: S, views: z.number(), enrollments: z.number(),
  classGrade: S, classGradeLabel: z.string(), categoryName1: S, categoryName2: S, category: z.string(), hrdSeq: S, contentsStart: z.string(), uploadDate: z.string(), mobile: S, mobileLabel: z.string(), serviceType: S, serviceTypeLabel: z.string(),
});
export type CpCourseRow = z.infer<typeof CpCourseRowSchema>;

export const CpCourseDetailSchema = CpCourseRowSchema.extend({
  keyword3: S, keyword4: S, intro: S, eduTarget: S, eduGoal: S, contentsUrl: S, mobileUrl: S, contentsEnd: z.string(), legalEduReq: S, legalEduLabel: z.string(),
  prices: z.object({ normal: z.number(), priority: z.number(), large1: z.number(), large2: z.number() }),
  terms: z.array(z.object({ idx: z.number(), start: S, end: S, serviceType: SN, openYear: N, openTerme: N, openChapter: N })),
  deleted: z.boolean(), contentsUrlSelect: S, bookPrice: z.number(), attachFile: S, previewImage: S, bookImage: S, fileBase: z.string(),
  keyword1Name: S, keyword2Name: S, keyword3Ids: z.array(z.number()), keyword4Ids: z.array(z.number()), keyword3Names: z.array(z.string()), keyword4Names: z.array(z.string()),
  menuName: z.string(), testIdCount: z.number(), chapterMismatch: z.boolean(),
  packageCourses: z.array(z.object({ idx: z.number(), lectureCode: z.string(), name: S, serviceType: S, serviceTypeLabel: z.string(), chapter: S })),
});
export type CpCourseDetail = z.infer<typeof CpCourseDetailSchema>;

const NamedIdx = z.object({ idx: z.number(), name: S });
export const CpCourseMetaSchema = z.object({
  classGrades: z.array(Option), useYN: z.array(Option), serviceTypes: z.array(Option), ctypes: z.array(Option),
  categories: z.array(NamedIdx.extend({ children: z.array(NamedIdx) })),
  keyword1: z.array(NamedIdx.extend({ del: z.boolean(), useYN: S })), keyword2: z.array(NamedIdx.extend({ del: z.boolean(), useYN: S })), keyword3: z.array(NamedIdx), keyword4: z.array(NamedIdx), fileBase: z.string(),
});
export type CpCourseMeta = z.infer<typeof CpCourseMetaSchema>;

export const CpTestIdsSchema = z.object({ lectureCode: z.string(), items: z.array(z.object({ no: z.number(), id: z.string(), name: S, mobile: S, lectureStart: S, lectureEnd: S, lastLogin: S, regDate: S, useYN: S, useLabel: z.string() })) });
export type CpTestIds = z.infer<typeof CpTestIdsSchema>;

export const CpChapterRowSchema = z.object({ chapterSeq: z.number(), chapterType: S, typeLabel: z.string(), order: z.number(), subIdx: SN, regDate: S, contentsIdx: N, gubun: S, title: S, listTitle: S, lectureTimeMin: N, deleted: z.boolean(), details: z.number(), subCount: S });
export type CpChapterRow = z.infer<typeof CpChapterRowSchema>;

export const CpPackageSearchSchema = z.object({ items: z.array(z.object({ idx: z.number(), lectureCode: z.string(), name: S, serviceType: S, serviceTypeLabel: z.string(), chapter: S })) });
export type CpPackageSearch = z.infer<typeof CpPackageSearchSchema>;
export const CpPackageImportSchema = z.object({ ok: z.boolean(), codes: z.array(z.string()), totalRows: z.number(), added: z.number(), deleted: z.number(), skipped: z.number(), errors: z.array(z.object({ row: z.number(), lectureCode: z.string(), message: z.string() })), count: z.number(), summary: z.string() });
export type CpPackageImport = z.infer<typeof CpPackageImportSchema>;

export const CpContentsRowSchema = z.object({ idx: z.number(), gubun: S, title: S, lectureTimeMin: N, regDate: S, detailCount: z.number(), usedIn: z.number(), size: z.object({ width: SN, height: SN }).optional() });
export type CpContentsRow = z.infer<typeof CpContentsRowSchema>;
export const CpContentsOptionsSchema = z.object({ gubuns: z.array(z.string()), contents: z.array(z.object({ no: z.number(), idx: z.number(), title: S, detailCount: z.number() })) });
export type CpContentsOptions = z.infer<typeof CpContentsOptionsSchema>;
export const CpContentsMetaSchema = z.object({ contentsTypes: z.array(Option), teachers: z.array(NamedIdx), servers: z.object({ flash: z.string(), movie: z.string(), mobile: z.string() }) });
export type CpContentsMeta = z.infer<typeof CpContentsMetaSchema>;
export const CpContentDetailRowSchema = z.object({
  seq: z.number(), type: S, typeLabel: z.string(), pages: S, mobilePages: S, urlSelect: S, urlSelectLabel: z.string(), url: S, url2: S, mobileUrl: S, mobileUrl2: S, question: S, examples: z.array(S), answer: S, comment: S, teacher: N, teacherName: S, useYN: S, useLabel: z.string(), order: z.number(), caption: S,
});
export type CpContentDetailRow = z.infer<typeof CpContentDetailRowSchema>;
export const CpContentSchema = z.object({
  idx: z.number(), gubun: S, title: S, lectureTimeMin: N, goal: S, trainingContents: S, activities: S, regDate: S, deleted: z.boolean(), size: z.object({ width: SN, height: SN }).optional(),
  details: z.array(CpContentDetailRowSchema), usedIn: z.array(z.object({ lectureCode: z.string(), chapterSeq: z.number(), order: z.number() })), nextDetailOrder: z.number(),
});
export type CpContent = z.infer<typeof CpContentSchema>;

const CatItem = z.object({ idx: z.number(), parent: z.number(), deep: z.number(), name: S, order: N, useYN: S });
export const CpCategoriesSchema = z.object({ categories: z.array(CatItem), tree: z.array(CatItem.extend({ children: z.array(CatItem) })), nextOrder: z.object({ root: z.number(), byParent: z.record(z.string(), z.number()) }) }).passthrough();
export type CpCategories = z.infer<typeof CpCategoriesSchema>;

export const CpListsOverviewSchema = z.object({ items: z.array(z.object({ gubun: z.string(), label: z.string(), title: z.string(), count: z.number() })) });
export type CpListsOverview = z.infer<typeof CpListsOverviewSchema>;
export const CpListItemSchema = z.object({ idx: z.number(), lectureCode: z.string(), order: z.number(), useYN: S, courseUseYN: S, courseUseLabel: z.string(), regDate: S, regId: S, name: S, ctype: S, serviceType: S, courseVisible: z.boolean() });
export type CpListItem = z.infer<typeof CpListItemSchema>;
export const CpListSchema = z.object({ gubun: z.string(), label: z.string(), title: z.string(), items: z.array(CpListItemSchema) });
export type CpList = z.infer<typeof CpListSchema>;
export const CpListCandidatesSchema = z.object({ items: z.array(z.object({ no: z.number(), idx: z.number(), lectureCode: z.string(), name: S, ctype: S })) });
export type CpListCandidates = z.infer<typeof CpListCandidatesSchema>;

// ---------------------------------------------------------------- 엑셀로 등록 (ContentsExcelTemp / CourseExcelTemp / ChapterExcelTemp)
export const CpUploadResultSchema = z.object({ ok: z.boolean(), inserted: z.number(), ids: z.array(z.number()) });
export const CpRegResultSchema = z.object({ ok: z.boolean(), idx: z.number(), status: z.enum(['B', 'C']), label: z.string(), message: z.string().optional(), newIdx: z.number().optional() });
export type CpRegResult = z.infer<typeof CpRegResultSchema>;
export const CpContentsTempRowSchema = z.object({
  no: z.number(), idx: z.number(), gubun: z.string(), title: z.string(), lectureTime: z.number(), goal: z.string(), trainingContents: z.string(), activities: z.string(), contentsType: z.string(),
  pages: z.string(), mobilePages: z.string(), url: z.string(), mobileUrl: z.string(), regDate: S, missing: z.array(z.string()), errorCount: z.number(),
});
export type CpContentsTempRow = z.infer<typeof CpContentsTempRowSchema>;
export const CpContentsTempSchema = z.object({ items: z.array(CpContentsTempRowSchema), total: z.number(), errorCount: z.number() });
export const CpCourseTempRowSchema = z.object({
  no: z.number(), idx: z.number(), values: z.record(z.string(), z.union([z.string(), z.number()])), dates: z.object({ ContentsStart: z.string(), ContentsEnd: z.string(), UploadDate: z.string() }),
  missing: z.array(z.string()), blank: z.array(z.string()), duplicate: z.string().nullable(), errorCount: z.number(),
});
export type CpCourseTempRow = z.infer<typeof CpCourseTempRowSchema>;
export const CpCourseTempSchema = z.object({ ctype: z.string(), items: z.array(CpCourseTempRowSchema), total: z.number(), errorCount: z.number() });
export const CpChapterTempRowSchema = z.object({ no: z.number(), idx: z.number(), lectureCode: z.string(), chapterType: z.string(), subIdx: z.string(), orderByNum: z.number(), missing: z.array(z.string()), dupSub: z.string().nullable(), dupOrder: z.string().nullable(), errorCount: z.number() });
export type CpChapterTempRow = z.infer<typeof CpChapterTempRowSchema>;
export const CpChapterTempSchema = z.object({ items: z.array(CpChapterTempRowSchema), total: z.number(), errorCount: z.number() });
export const CpCourseFileSchema = z.object({ ok: z.boolean(), fileName: z.string(), realFileName: z.string() });
export const CpCourseFileDeleteSchema = z.object({ ok: z.boolean(), removed: z.boolean(), reason: z.string().optional() });
export type CpCourseFileSlot = 'attachFile' | 'PreviewImage' | 'BookImage';
const formOf = (file: File) => { const fd = new FormData(); fd.append('file', file, file.name); return fd; };

export const adminCoursesParityApi = {
  // course.php / course_package.php / course_read.php / course_write.php
  courses: (query: Q, signal?: AbortSignal) => api.get('/admin/courses', { query, schema: pageOf(CpCourseRowSchema), signal }),
  downloadCoursesCsv: (query: Q) => downloadAdminFile('/admin/courses/export', query, 'courses.csv'),
  courseMeta: (signal?: AbortSignal) => api.get('/admin/courses/meta', { schema: CpCourseMetaSchema, signal }),
  course: (idx: number, signal?: AbortSignal) => api.get(`/admin/courses/${idx}`, { schema: CpCourseDetailSchema, signal }),
  createCourse: (body: Record<string, unknown>) => api.post('/admin/courses', body, { schema: CpOkSchema }),
  patchCourse: (idx: number, body: Record<string, unknown>) => api.patch(`/admin/courses/${idx}`, body, { schema: CpOkSchema }),
  deleteCourse: (idx: number) => api.delete(`/admin/courses/${idx}`, { schema: CpOkSchema }),
  testIds: (idx: number, signal?: AbortSignal) => api.get(`/admin/courses/${idx}/test-ids`, { schema: CpTestIdsSchema, signal }),

  // 차시 구성
  chapters: (lectureCode: string, signal?: AbortSignal) => api.get(`/admin/courses/${encodeURIComponent(lectureCode)}/chapters`, { schema: z.array(CpChapterRowSchema), signal }),
  createChapter: (lectureCode: string, body: { ContentIdx: number; OrderByNum: number }) => api.post(`/admin/courses/${encodeURIComponent(lectureCode)}/chapters`, body, { schema: CpOkSchema }),
  batchChapters: (lectureCode: string, Gubun: string) => api.post(`/admin/courses/${encodeURIComponent(lectureCode)}/chapters/batch`, { Gubun }, { schema: CpOkSchema }),
  orderChapters: (lectureCode: string, seqs: number[]) => api.put(`/admin/courses/${encodeURIComponent(lectureCode)}/chapters/order`, { seqs }, { schema: CpOkSchema }),
  patchChapter: (lectureCode: string, seq: number, body: { ContentIdx: number; OrderByNum: number }) => api.patch(`/admin/courses/${encodeURIComponent(lectureCode)}/chapters/${seq}`, body, { schema: CpOkSchema }),
  deleteChapter: (lectureCode: string, seq: number) => api.delete(`/admin/courses/${encodeURIComponent(lectureCode)}/chapters/${seq}`, { schema: CpOkSchema }),

  // 패키지컨텐츠관리
  searchPackageCourses: (name: string, signal?: AbortSignal) => api.get('/admin/course-packages/search', { query: { name }, schema: CpPackageSearchSchema, signal }),
  createPackage: (body: { LectureCode: string; UseYN: 'Y' | 'N'; HrdCode?: string; ContentsName: string }) => api.post('/admin/course-packages', body, { schema: CpOkSchema }),
  patchPackage: (idx: number, body: { UseYN?: 'Y' | 'N'; HrdCode?: string; ContentsName?: string }) => api.patch(`/admin/course-packages/${idx}`, body, { schema: CpOkSchema }),
  putPackageCodes: (idx: number, lectureCodes: string[]) => api.put(`/admin/course-packages/${idx}/lecture-codes`, { lectureCodes }, { schema: CpOkSchema }),
  importPackage: (idx: number, rows: { lectureCode: string; serviceType: string; chapter: string; delete: string }[]) => api.post(`/admin/course-packages/${idx}/import`, { rows }, { schema: CpPackageImportSchema }),
  downloadPackageCsv: (idx: number) => downloadAdminFile(`/admin/course-packages/${idx}/export`, {}, 'package.csv'),

  // 기초차시 관리
  contents: (query: Q, signal?: AbortSignal) => api.get('/admin/contents', { query, schema: pageOf(CpContentsRowSchema), signal }),
  downloadContentsCsv: (query: Q) => downloadAdminFile('/admin/contents/export', query, 'contents.csv'),
  contentsOptions: (query: Q, signal?: AbortSignal) => api.get('/admin/contents/options', { query, schema: CpContentsOptionsSchema, signal }),
  contentsMeta: (signal?: AbortSignal) => api.get('/admin/contents/meta', { schema: CpContentsMetaSchema, signal }),
  content: (idx: number, signal?: AbortSignal) => api.get(`/admin/contents/${idx}`, { schema: CpContentSchema, signal }),
  createContent: (body: Record<string, unknown>) => api.post('/admin/contents', body, { schema: CpOkSchema }),
  patchContent: (idx: number, body: Record<string, unknown>) => api.patch(`/admin/contents/${idx}`, body, { schema: CpOkSchema }),
  deleteContent: (idx: number) => api.delete(`/admin/contents/${idx}`, { schema: CpOkSchema }),
  createDetail: (idx: number, body: Record<string, unknown>) => api.post(`/admin/contents/${idx}/details`, body, { schema: CpOkSchema }),
  putDetail: (idx: number, seq: number, body: Record<string, unknown>) => api.put(`/admin/contents/${idx}/details/${seq}`, body, { schema: CpOkSchema }),
  deleteDetail: (idx: number, seq: number) => api.delete(`/admin/contents/${idx}/details/${seq}`, { schema: CpOkSchema }),

  // 과정 카테고리
  categories: (signal?: AbortSignal) => api.get('/admin/categories', { schema: CpCategoriesSchema, signal }),
  createCategory: (body: { ParentCategory: number; Deep: number; CategoryName: string; OrderByNum: number; UseYN: 'Y' | 'N' }) => api.post('/admin/categories', body, { schema: CpOkSchema }),
  patchCategory: (idx: number, body: { CategoryName?: string; OrderByNum?: number; UseYN?: 'Y' | 'N' }) => api.patch(`/admin/categories/${idx}`, body, { schema: CpOkSchema }),
  deleteCategory: (idx: number) => api.delete(`/admin/categories/${idx}`, { schema: CpOkSchema }),

  // PICK/TOP/NEW
  listsOverview: (signal?: AbortSignal) => api.get('/admin/lists', { schema: CpListsOverviewSchema, signal }),
  list: (gubun: string, signal?: AbortSignal) => api.get(`/admin/lists/${gubun}`, { schema: CpListSchema, signal }),
  listCandidates: (gubun: string, signal?: AbortSignal) => api.get(`/admin/lists/${gubun}/candidates`, { schema: CpListCandidatesSchema, signal }),
  addToList: (gubun: string, lectureCode: string) => api.post(`/admin/lists/${gubun}`, { lectureCode }, { schema: CpOkSchema }),
  orderList: (gubun: string, ids: number[]) => api.put(`/admin/lists/${gubun}/order`, { ids }, { schema: CpOkSchema }),
  removeFromList: (gubun: string, idx: number) => api.delete(`/admin/lists/${gubun}/${idx}`, { schema: CpOkSchema }),

  // 패키지 엑셀 파일 (course_package_excel_upload.php)
  importPackageFile: (idx: number, file: File) => api.post(`/admin/course-packages/${idx}/import-file`, formOf(file), { schema: CpPackageImportSchema }),

  // 엑셀로 기초차시 등록 (contents_excel*.php)
  contentsTemp: (signal?: AbortSignal) => api.get('/admin/contents/excel-temp', { schema: CpContentsTempSchema, signal }),
  uploadContentsTemp: (file: File) => api.post('/admin/contents/excel-temp/upload', formOf(file), { schema: CpUploadResultSchema }),
  patchContentsTemp: (idx: number, body: Record<string, unknown>) => api.patch(`/admin/contents/excel-temp/${idx}`, body, { schema: CpOkSchema }),
  deleteContentsTemp: (ids: number[]) => api.post('/admin/contents/excel-temp/delete', { ids }, { schema: CpOkSchema }),
  registerContentsTemp: (idx: number) => api.post(`/admin/contents/excel-temp/${idx}/register`, {}, { schema: CpRegResultSchema }),

  // 컨텐츠 엑셀 등록 (course_*excel*.php)
  courseTemp: (ctype: string, signal?: AbortSignal) => api.get('/admin/courses/excel-temp', { query: { ctype }, schema: CpCourseTempSchema, signal }),
  uploadCourseTemp: (ctype: string, file: File) => api.post(`/admin/courses/excel-temp/upload?ctype=${encodeURIComponent(ctype)}`, formOf(file), { schema: CpUploadResultSchema }),
  patchCourseTemp: (idx: number, body: Record<string, unknown>) => api.patch(`/admin/courses/excel-temp/${idx}`, body, { schema: CpOkSchema }),
  deleteCourseTemp: (ids: number[]) => api.post('/admin/courses/excel-temp/delete', { ids }, { schema: CpOkSchema }),
  registerCourseTemp: (idx: number, ctype: string) => api.post(`/admin/courses/excel-temp/${idx}/register?ctype=${encodeURIComponent(ctype)}`, {}, { schema: CpRegResultSchema }),

  // 차시 엑셀 등록 (chapter_*excel*.php)
  chapterTemp: (signal?: AbortSignal) => api.get('/admin/chapters/excel-temp', { schema: CpChapterTempSchema, signal }),
  uploadChapterTemp: (file: File) => api.post('/admin/chapters/excel-temp/upload', formOf(file), { schema: CpUploadResultSchema }),
  patchChapterTemp: (idx: number, body: Record<string, unknown>) => api.patch(`/admin/chapters/excel-temp/${idx}`, body, { schema: CpOkSchema }),
  deleteChapterTemp: (ids: number[]) => api.post('/admin/chapters/excel-temp/delete', { ids }, { schema: CpOkSchema }),
  registerChapterTemp: (idx: number) => api.post(`/admin/chapters/excel-temp/${idx}/register`, {}, { schema: CpRegResultSchema }),

  // 학습자료 / 과정 이미지 / 교재 이미지 (upload_file_ok.php / file_delete.php / direct_download.php)
  uploadCourseFile: (kind: 'text' | 'img', file: File) => api.post(`/admin/courses/files/upload?kind=${kind}`, formOf(file), { schema: CpCourseFileSchema }),
  deleteCourseFile: (fileName: string, idx?: number) => api.delete(`/admin/courses/files/${encodeURIComponent(fileName)}${idx ? `?idx=${idx}` : ''}`, { schema: CpCourseFileDeleteSchema }),
  downloadCourseFile: (idx: number, slot: CpCourseFileSlot, fallback: string) => downloadAdminFile(`/admin/courses/${idx}/files/${slot}`, {}, fallback),
};
