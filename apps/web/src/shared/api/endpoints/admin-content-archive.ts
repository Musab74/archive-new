import { z } from 'zod';
import { api } from '../client';
import { pageOf } from '../schemas';
import { downloadAdminFile } from './admin';
import { CpChapterRowSchema, CpCourseDetailSchema, CpCourseMetaSchema, CpTestIdsSchema } from './admin-courses-parity';

/**
 * 컨텐츠관리 (역량진단 문항관리 D3 · 역량진단관리 D4 · 만족도조사 D5) + 아카이브 (실시간 강의실 E1 · 컨텐츠 키워드 E4 · 관심강의/과정조회 E6).
 * Backed by AdminContentArchiveController (/admin/archive-questions, /admin/ability-results, /admin/satisfaction-results,
 * /admin/content-keywords, /admin/course-likes, /admin/course-views, /admin/live-courses).
 */
type Q = Record<string, string | number | boolean | null | undefined>;
const S = z.string().nullable().optional();
const N = z.number().nullable().optional();

export const OkSchema = z.object({ ok: z.boolean() }).passthrough();
export type Ok = z.infer<typeof OkSchema>;
const Option = z.object({ value: z.string(), label: z.string() });

export const ArchiveQuestionRowSchema = z.object({
  idx: z.number().int(), aType: S, typeLabel: z.string(), aDepth: S, depthLabel: z.string(), aGroup: S, groupLabel: z.string(), groupFormLabel: z.string().optional(), aOrder: N, aBind: S, bindLabel: z.string(), aValue: S, aValueDetail: S, regDate: S, modDate: S,
});
export type ArchiveQuestionRow = z.infer<typeof ArchiveQuestionRowSchema>;
export const QuestionMetaSchema = z.object({ depths: z.array(Option), groups: z.array(Option), listGroups: z.array(Option), types: z.array(Option), binds: z.array(Option), values: z.array(Option) });
export type QuestionMeta = z.infer<typeof QuestionMetaSchema>;
export const QuestionDetailSchema = z.object({ question: ArchiveQuestionRowSchema, answers: z.number().int() });
export type QuestionDetail = z.infer<typeof QuestionDetailSchema>;

export const DateRangeSchema = z.object({ start: z.string(), end: z.string(), capped: z.boolean(), maxDays: z.number().int() });
export type DateRange = z.infer<typeof DateRangeSchema>;
export const AbilityResultRowSchema = z.object({
  idx: z.number().int(), id: z.string(), name: S, studySeq: N, studyTimeSec: N, studyTimeLabel: z.string(), aDepth: S, depthLabel: z.string(), aGroup: S, groupLabel: z.string(), aType: S, prepost: z.string(), aBind: S, bindLabel: z.string(),
  questionIdx: N, question: S, aOrder: N, aValue: S, selected: z.string(), regDate: S,
});
export type AbilityResultRow = z.infer<typeof AbilityResultRowSchema>;
export const AbilityResultsPageSchema = pageOf(AbilityResultRowSchema).extend({ range: DateRangeSchema });
export type AbilityResultsPage = z.infer<typeof AbilityResultsPageSchema>;
export const SatisfactionRowSchema = z.object({ idx: z.number().int(), id: z.string(), name: S, aOrder: N, question: S, aValue: S, score: z.number(), stars: z.string(), regDate: S });
export type SatisfactionRow = z.infer<typeof SatisfactionRowSchema>;
export const SatisfactionPageSchema = pageOf(SatisfactionRowSchema).extend({ range: DateRangeSchema });
export type SatisfactionPage = z.infer<typeof SatisfactionPageSchema>;

export const KeywordCategorySchema = z.object({ category: z.string(), label: z.string(), count: z.number().int(), activeCount: z.number().int() });
export type KeywordCategory = z.infer<typeof KeywordCategorySchema>;
export const KeywordRowSchema = z.object({ idx: z.number().int(), category: z.string(), categoryLabel: z.string(), keyword: z.string(), useYN: S, useLabel: z.string(), order: N, jobCate: S, regDate: S, regId: S, mdfDate: S, mdfId: S });
export type KeywordRow = z.infer<typeof KeywordRowSchema>;
export const KeywordListSchema = z.object({ category: z.string(), label: z.string(), items: z.array(KeywordRowSchema) });
export type KeywordList = z.infer<typeof KeywordListSchema>;

export const CourseLikeRowSchema = z.object({ idx: z.number().int(), id: z.string(), name: S, category1: S, category2: S, category: z.string(), lectureCode: S, courseName: S, regDate: S });
export type CourseLikeRow = z.infer<typeof CourseLikeRowSchema>;
export const CourseViewRowSchema = z.object({ idx: z.number().int(), lectureCode: S, category1: S, category2: S, category: z.string(), keyword2: S, keyword2Name: S, courseName: S, count: z.number(), ctype: S, useYN: S, del: S });
export type CourseViewRow = z.infer<typeof CourseViewRowSchema>;
export const CourseViewOptionsSchema = z.object({ category1: z.array(z.object({ idx: z.number().int(), name: z.string() })), category2: z.array(z.object({ idx: z.number().int(), parent: z.number().int(), name: z.string() })), keyword2: z.array(z.object({ idx: z.number().int(), name: z.string(), del: z.boolean().optional() })) });
export type CourseViewOptions = z.infer<typeof CourseViewOptionsSchema>;

export const LiveCourseRowSchema = z.object({
  idx: z.number().int(), lectureCode: S, classGrade: S, classGradeLabel: z.string(), courseName: S, category: z.string(), chapter: S, chapterLabel: z.string(), contentsTime: S, packageLectureCode: S, hrdSeq: S, contentsStart: S, uploadDate: S,
  mobile: S, mobileLabel: z.string(), useYN: S, useLabel: z.string(), professor: S, regDate: S,
});
export type LiveCourseRow = z.infer<typeof LiveCourseRowSchema>;

/** course_write.php?ctype=R options: the course form lists + the NCS select and whether Course.NcsCode exists. */
export const LiveMetaSchema = CpCourseMetaSchema.extend({ ncsCodes: z.array(Option), ncsColumn: z.boolean() });
export type LiveMeta = z.infer<typeof LiveMetaSchema>;
export const LiveCourseDetailSchema = CpCourseDetailSchema.extend({ ncsCode: S });
export type LiveCourseDetail = z.infer<typeof LiveCourseDetailSchema>;
export const LiveTestIdsSchema = CpTestIdsSchema;

/** CourseExcelTemp row (course_excel_list.php) — the 30 template cells keep their column names. */
const Cell = z.union([z.string(), z.number()]).nullable().optional();
export const LIVE_EXCEL_KEYS = [
  'ClassGrade', 'LectureCode', 'PackageLectureCode', 'UseYN', 'ContentsURLSelect', 'HrdSeq', 'Category1', 'Category2', 'ContentsName', 'Keyword1', 'Keyword2', 'Keyword3', 'Keyword4', 'Chapter', 'ContentsTime',
  'ContentsStart', 'ContentsEnd', 'UploadDate', 'Professor', 'PassTime', 'Mobile', 'BookPrice', 'PreviewImage', 'Intro', 'EduTarget', 'EduGoal', 'Price', 'Price01View', 'Price02View', 'Price03View',
] as const;
export type LiveExcelKey = (typeof LIVE_EXCEL_KEYS)[number];
export const LiveExcelRowSchema = z.object({ idx: z.number().int(), ctype: S, ServiceType: S, hrdCode: S, ...Object.fromEntries(LIVE_EXCEL_KEYS.map((k) => [k, Cell])) as Record<LiveExcelKey, typeof Cell> }).passthrough();
export type LiveExcelRow = z.infer<typeof LiveExcelRowSchema>;
export const LiveExcelListItemSchema = LiveExcelRowSchema.extend({ no: z.number().int(), missing: z.record(z.string(), z.enum(['error', 'optional'])), duplicate: z.enum(['course', 'temp']).nullable(), errors: z.array(z.string()), errorCount: z.number().int(), status: z.string() });
export type LiveExcelListItem = z.infer<typeof LiveExcelListItemSchema>;
export const LiveExcelListSchema = z.object({ items: z.array(LiveExcelListItemSchema), total: z.number().int(), errorCount: z.number().int() });
export type LiveExcelList = z.infer<typeof LiveExcelListSchema>;

export const adminContentArchiveApi = {
  // D3 역량진단 문항관리
  questions: (query: Q, signal?: AbortSignal) => api.get('/admin/archive-questions', { query, schema: pageOf(ArchiveQuestionRowSchema), signal }),
  questionMeta: (signal?: AbortSignal) => api.get('/admin/archive-questions/meta', { schema: QuestionMetaSchema, signal }),
  question: (idx: number, signal?: AbortSignal) => api.get(`/admin/archive-questions/${idx}`, { schema: QuestionDetailSchema, signal }),
  createQuestion: (body: Record<string, unknown>) => api.post('/admin/archive-questions', body, { schema: OkSchema }),
  patchQuestion: (idx: number, body: Record<string, unknown>) => api.patch(`/admin/archive-questions/${idx}`, body, { schema: OkSchema }),
  deleteQuestion: (idx: number, force: boolean) => api.delete(`/admin/archive-questions/${idx}`, { query: force ? { force: 1 } : {}, schema: OkSchema }),

  // D4 역량진단관리 / D5 만족도조사
  abilityResults: (query: Q, signal?: AbortSignal) => api.get('/admin/ability-results', { query, schema: AbilityResultsPageSchema, signal }),
  downloadAbilityCsv: (query: Q) => downloadAdminFile('/admin/ability-results/export', query, 'ability.csv'),
  satisfactionResults: (query: Q, signal?: AbortSignal) => api.get('/admin/satisfaction-results', { query, schema: SatisfactionPageSchema, signal }),
  downloadSatisfactionCsv: (query: Q) => downloadAdminFile('/admin/satisfaction-results/export', query, 'satisfaction.csv'),

  // E4 컨텐츠 키워드 관리
  keywordCategories: (signal?: AbortSignal) => api.get('/admin/content-keywords/categories', { schema: z.object({ items: z.array(KeywordCategorySchema) }), signal }),
  keywords: (category: string, signal?: AbortSignal) => api.get('/admin/content-keywords', { query: { category }, schema: KeywordListSchema, signal }),
  createKeyword: (body: { Category: string; Keyword: string; UseYN?: 'Y' | 'N' }) => api.post('/admin/content-keywords', body, { schema: OkSchema }),
  patchKeyword: (idx: number, body: { Keyword?: string; UseYN?: 'Y' | 'N' }) => api.patch(`/admin/content-keywords/${idx}`, body, { schema: OkSchema }),
  deleteKeyword: (idx: number) => api.delete(`/admin/content-keywords/${idx}`, { schema: OkSchema }),
  reorderKeywords: (category: string, order: number[]) => api.put('/admin/content-keywords/order', { category, order }, { schema: OkSchema }),

  // E6 관심강의 관리 / 과정조회 관리
  likes: (query: Q, signal?: AbortSignal) => api.get('/admin/course-likes', { query, schema: pageOf(CourseLikeRowSchema), signal }),
  downloadLikesCsv: (query: Q) => downloadAdminFile('/admin/course-likes/export', query, 'course_likes.csv'),
  views: (query: Q, signal?: AbortSignal) => api.get('/admin/course-views', { query, schema: pageOf(CourseViewRowSchema), signal }),
  viewOptions: (signal?: AbortSignal) => api.get('/admin/course-views/options', { schema: CourseViewOptionsSchema, signal }),
  downloadViewsCsv: (query: Q) => downloadAdminFile('/admin/course-views/export', query, 'course_views.csv'),

  // E1 실시간 강의실 관리 (MariaDB part)
  liveCourses: (query: Q, signal?: AbortSignal) => api.get('/admin/live-courses', { query, schema: pageOf(LiveCourseRowSchema), signal }),
  downloadLiveCoursesCsv: (query: Q) => downloadAdminFile('/admin/live-courses/export', query, 'live_courses.csv'),
  liveMeta: (signal?: AbortSignal) => api.get('/admin/live-courses/meta', { schema: LiveMetaSchema, signal }),
  liveCourse: (idx: number, signal?: AbortSignal) => api.get(`/admin/live-courses/${idx}`, { schema: LiveCourseDetailSchema, signal }),
  createLiveCourse: (body: Record<string, unknown>) => api.post('/admin/live-courses', body, { schema: OkSchema }),
  patchLiveCourse: (idx: number, body: Record<string, unknown>) => api.patch(`/admin/live-courses/${idx}`, body, { schema: OkSchema }),
  deleteLiveCourse: (idx: number) => api.delete(`/admin/live-courses/${idx}`, { schema: OkSchema }),
  /** course_read_list.php rows for a live course (E grants; same shape as the D1 chapters API). */
  liveChapters: (idx: number, signal?: AbortSignal) => api.get(`/admin/live-courses/${idx}/chapters`, { schema: z.array(CpChapterRowSchema), signal }),
  liveTestIds: (idx: number, signal?: AbortSignal) => api.get(`/admin/live-courses/${idx}/test-ids`, { schema: LiveTestIdsSchema, signal }),
  // 엑셀로 등록 (CourseExcelTemp, Ctype R)
  liveExcelList: (signal?: AbortSignal) => api.get('/admin/live-courses/excel', { schema: LiveExcelListSchema, signal }),
  uploadLiveExcel: (rows: Record<string, string | null>[]) => api.post('/admin/live-courses/excel', { rows }, { schema: OkSchema }),
  liveExcelRow: (idx: number, signal?: AbortSignal) => api.get(`/admin/live-courses/excel/${idx}`, { schema: LiveExcelRowSchema, signal }),
  patchLiveExcel: (idx: number, body: Record<string, string | number | null>) => api.patch(`/admin/live-courses/excel/${idx}`, body, { schema: OkSchema }),
  deleteLiveExcel: (ids: number[]) => api.post('/admin/live-courses/excel/delete', { ids }, { schema: OkSchema }),
  registerLiveExcel: (idx: number) => api.post(`/admin/live-courses/excel/${idx}/register`, {}, { schema: OkSchema }),
};
