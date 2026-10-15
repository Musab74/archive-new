import { z } from 'zod';
import { api } from '../client';
import { pageOf, StudyDetailSchema } from '../schemas';
import { downloadAdminFile } from './admin';

/**
 * 학습관리 (hrd_manager study.php + popups + batch scripts, menu B5) and 일자별 학습시간 관리 (study_time.php, menu B3)
 * — /admin/studies/manage, /admin/studies/:seq/*, /admin/studies/batch/*, /admin/studies/daily-time.
 */
type Q = Record<string, string | number | boolean | null | undefined>;
const optStr = z.string().nullable().optional();
const optNum = z.number().nullable().optional();
const OpenState = z.enum(['auto', 'granted', 'button']).nullable();

export const PreCellSchema = z.object({ label: z.string(), submitted: z.boolean(), date: optStr, showResume: z.boolean(), open: OpenState, grantExpiresAt: optStr });
export const PostCellSchema = z.object({ yn: z.enum(['Y', 'N']), date: optStr, open: OpenState, openReason: optStr, grantExpiresAt: optStr });
export type PreCell = z.infer<typeof PreCellSchema>;
export type PostCell = z.infer<typeof PostCellSchema>;

export const StudyManageRowSchema = z.object({
  studySeq: z.number(), id: z.string(), name: optStr, depart: optStr, serviceType: z.string(), serviceTypeLabel: z.string(), lectureCode: z.string(), courseName: z.string(), lectureStart: z.string(), lectureEnd: z.string(), termeIdx: optNum,
  seconds: z.number(), studyTimeLabel: z.string(), percent: z.number(), storedProgress: z.number(), passOk: z.string(), passOkLabel: z.string(), certificateLink: z.boolean(), studyEnd: z.string(),
  tutorName: optStr, salesName: optStr, salesTeam: optStr, companyCode: optStr, companyName: optStr, certDate: optStr, openChapter: optNum, inputDate: optStr, pre: PreCellSchema, post: PostCellSchema,
});
export type StudyManageRow = z.infer<typeof StudyManageRowSchema>;
export const StudyManagePageSchema = pageOf(StudyManageRowSchema).extend({ canWrite: z.boolean() });
export type StudyManagePage = z.infer<typeof StudyManagePageSchema>;

const Pick = z.object({ id: z.string(), name: z.string() });
export const StudyManageOptionsSchema = z.object({
  years: z.array(z.number()), thisYear: z.number(), packageCourses: z.array(z.object({ lectureCode: z.string(), name: z.string() })), tutors: z.array(Pick), salesStaff: z.array(Pick), periods: z.array(z.string()),
  pageSizes: z.array(z.number()), canWrite: z.boolean(), showTutorFilter: z.boolean(), canChangeServiceType: z.boolean(),
});
export type StudyManageOptions = z.infer<typeof StudyManageOptionsSchema>;

export const BatchKindSchema = z.enum(['term', 'openChapter', 'sales', 'serviceType']);
export type BatchKind = z.infer<typeof BatchKindSchema>;
export const BatchTargetsSchema = z.object({
  kind: BatchKindSchema, truncated: z.boolean(), cap: z.number(),
  items: z.array(z.object({ no: z.number(), studySeq: z.number(), serviceTypeLabel: z.string(), id: z.string(), name: optStr, period: z.string(), openChapter: optNum, courseName: optStr, storedProgress: z.number(), passOkLabel: z.string(), salesId: optStr, salesName: optStr })),
});
export type BatchTargets = z.infer<typeof BatchTargetsSchema>;
export const BatchResultSchema = z.object({ ok: z.boolean(), requested: z.number(), succeeded: z.number(), failed: z.number(), items: z.array(z.object({ seq: z.number(), ok: z.boolean(), message: z.string() })) });
export type BatchResult = z.infer<typeof BatchResultSchema>;
export const DeleteResultSchema = z.object({ ok: z.boolean(), requested: z.number(), deleted: z.number(), progressDeleted: z.number(), termsDeleted: z.number(), backedUp: z.number() });
export type DeleteResult = z.infer<typeof DeleteResultSchema>;
export const SendResultSchema = z.object({ ok: z.boolean(), code: z.string(), requested: z.number(), logged: z.number(), sent: z.number(), items: z.array(z.record(z.string(), z.unknown())).default([]) });
export type SendResult = z.infer<typeof SendResultSchema>;

// ---- detail (progress_info_pop.php) — GET /admin/studies/:seq with the parity fields
export const LearningRowSchema = z.object({ no: z.number(), serviceTypeLabel: z.string(), courseName: optStr, contentsTitle: optStr, lectureCode: z.string(), chapterNo: z.number(), chapterSeq: z.number(), rowStudySeq: z.number(), progress: z.number(), seconds: z.number(), studyTimeLabel: z.string(), lectureTimeMin: optNum, startDate: optStr, endDate: optStr });
export type LearningRow = z.infer<typeof LearningRowSchema>;
export const StudyParityDetailSchema = StudyDetailSchema.extend({
  depart: optStr, tutorId: optStr, tutorName: optStr, salesName: optStr, salesTeam: optStr, openChapter: optNum, serviceTypeLabel: z.string().optional(), passOkLabel: z.string().optional(), certificateLink: z.boolean().optional(),
  certDates: z.array(z.string()).default([]), lectureReStudy: optStr, survey: optStr, studyKey: optStr, inputId: optStr, packageYN: optStr, packageLectureCode: optStr,
  progressHeader: z.object({ seconds: z.number(), label: z.string(), percent: z.number() }).optional(),
  learning: z.object({ isPackage: z.boolean(), items: z.array(LearningRowSchema), sum: z.object({ chapters: z.number(), seconds: z.number(), label: z.string(), criterionSeconds: z.number(), met: z.boolean(), judge: z.string() }) }).optional(),
  assessment: z.object({ pre: PreCellSchema, post: PostCellSchema, isCurrent: z.boolean(), counts: z.object({ commonAnswered: z.number(), commonRequired: z.number(), roleAnswered: z.number(), roleRequired: z.number(), postScore: z.number() }) }).nullable().optional(),
  scores: z.object({ midScore: optNum, midStatus: optStr, testScore: optNum, testStatus: optStr, reportScore: optNum, reportStatus: optStr, totalScore: optNum }).optional(),
  canWrite: z.boolean().optional(),
});
export type StudyParityDetail = z.infer<typeof StudyParityDetailSchema>;

export const ChapterTicksSchema = z.object({ mode: z.literal('ticks'), chapterNo: z.number(), sameCount: z.number(), items: z.array(z.object({ no: z.number(), idx: z.number(), progress: z.number(), studyTime: z.number(), studyTimeLabel: z.string(), delta: z.number(), positionSec: optNum, ip: optStr, at: z.string(), lastStudy: optStr, sameMinute: z.boolean() })) });
export const ChapterSummarySchema = z.object({ mode: z.literal('chapters'), sumSeconds: z.number(), items: z.array(z.object({ no: z.number(), chapterSeq: z.number(), chapterNo: z.number(), progress: z.number(), seconds: z.number(), studyTimeLabel: z.string(), startAt: optStr, lastAt: optStr })) });
export const ChapterLogSchema = z.discriminatedUnion('mode', [ChapterTicksSchema, ChapterSummarySchema]);
export type ChapterLog = z.infer<typeof ChapterLogSchema>;
export const DayTimeSchema = z.object({ studySeq: z.number(), date: z.string(), id: z.string(), name: optStr, companyName: optStr, companyCode: optStr, seconds: z.number(), label: z.string() });
export type DayTime = z.infer<typeof DayTimeSchema>;
export const CertificateInfoSchema = z.object({ studySeq: z.number(), id: z.string(), name: optStr, birthDay: optStr, companyName: z.string(), companyCode: optStr, courseName: optStr, lectureStart: z.string(), lectureEnd: z.string(), periodLabel: z.string() });
export type CertificateInfo = z.infer<typeof CertificateInfoSchema>;
export const PreResumeSchema = z.object({ studySeq: z.number(), id: z.string(), name: optStr, label: z.string(), commonAnswered: z.number(), commonRequired: z.number(), roleAnswered: z.number(), roleRequired: z.number(), stepLabel: z.string(), stepDetail: z.string() });
export type PreResume = z.infer<typeof PreResumeSchema>;
export const GrantInfoSchema = z.object({ studySeq: z.number(), id: z.string(), name: optStr, type: z.enum(['PRE', 'POST']), typeLabel: z.string(), sessionLabel: z.string(), canIssue: z.boolean(), errors: z.array(z.string()), activeGrant: z.object({ idx: z.number(), adminId: z.string(), expiresAt: z.string() }).nullable() });
export type GrantInfo = z.infer<typeof GrantInfoSchema>;
export const GrantResultSchema = z.object({ ok: z.boolean(), existing: z.boolean(), grantIdx: z.number(), expiresAt: z.string(), sessionLabel: z.string(), message: z.string() });
export type GrantResult = z.infer<typeof GrantResultSchema>;

// ---- 일자별 학습시간 관리
export const DailyTimeRowSchema = z.object({
  studyDate: z.string(), id: z.string(), name: optStr, companyName: optStr, lectureCode: optStr, openChapter: optStr, lecturePeriod: optStr, studyEnd: optStr, tutor: optStr, salesId: optStr,
  attendPass: optStr, attendLabel: z.string(), hours15Ok: z.boolean(), hours15Label: z.string(), hours15NeedSec: z.number(), totalCreditedSec: z.number(), totalCreditedLabel: z.string(),
  seconds: z.number(), secondsLabel: z.string(), creditedSec: z.number(), creditedLabel: z.string(), excessSec: z.number(), excessLabel: z.string(), status: z.enum(['ok', 'cap', 'over']), statusLabel: z.string(), logSpanSec: z.number(),
});
export type DailyTimeRow = z.infer<typeof DailyTimeRowSchema>;
export const DailyTimePageSchema = pageOf(DailyTimeRowSchema).extend({
  period: z.object({ start: z.string(), end: z.string(), label: z.string() }), order: z.string(), stats: z.object({ total: z.number(), ge8: z.number(), cap: z.number(), over: z.number() }), summaryLabel: z.string(),
  pagePeople: z.object({ people: z.number(), ok15: z.number() }), rule: z.string(),
});
export type DailyTimePage = z.infer<typeof DailyTimePageSchema>;

export const CompanyPickSchema = z.object({ items: z.array(z.object({ companyCode: z.string(), companyName: optStr })) });
export type CompanyPick = z.infer<typeof CompanyPickSchema>;

export const adminStudiesParityApi = {
  manage: (query: Q, signal?: AbortSignal) => api.get<StudyManagePage>('/admin/studies/manage', { query, schema: StudyManagePageSchema, signal }),
  manageOptions: (signal?: AbortSignal) => api.get<StudyManageOptions>('/admin/studies/manage/options', { schema: StudyManageOptionsSchema, signal }),
  downloadManageCsv: (query: Q) => downloadAdminFile('/admin/studies/manage/export', query, 'study_manage.csv'),
  downloadProgressLogCsv: (seqs: number[]) => downloadAdminFile('/admin/studies/progress-log/export', { seqs: seqs.join('|') }, 'progress_log.csv'),
  /** study_progress_excel.php — one member's per-course 진도율 / 수강시간 / 학습시작일 / 학습종료일. */
  downloadProgressExcel: (id: string) => downloadAdminFile('/admin/studies/progress-excel', { id }, 'study_progress.csv'),
  batchTargets: (query: Q, signal?: AbortSignal) => api.get<BatchTargets>('/admin/studies/batch/targets', { query, schema: BatchTargetsSchema, signal }),
  deleteStudies: (seqs: number[]) => api.post<DeleteResult>('/admin/studies/delete', { seqs }, { schema: DeleteResultSchema }),
  changeLectureTerm: (seqs: number[], period: string) => api.post<BatchResult>('/admin/studies/batch/lecture-term', { seqs, period }, { schema: BatchResultSchema }),
  changeOpenChapter: (seqs: number[], openChapter: number) => api.post<BatchResult>('/admin/studies/batch/open-chapter', { seqs, openChapter }, { schema: BatchResultSchema }),
  changeSales: (seqs: number[], salesId: string) => api.post<BatchResult>('/admin/studies/batch/sales', { seqs, salesId }, { schema: BatchResultSchema }),
  changeServiceType: (seqs: number[], serviceType: 'A' | 'W') => api.post<BatchResult>('/admin/studies/batch/service-type', { seqs, serviceType }, { schema: BatchResultSchema }),
  sendStartKakao: (seqs: number[]) => api.post<SendResult>('/admin/studies/send/start-kakao', { seqs }, { schema: SendResultSchema }),
  sendEduManagerMail: (seqs: number[]) => api.post<SendResult>('/admin/studies/send/edu-manager-mail', { seqs }, { schema: SendResultSchema }),

  detail: (seq: number, signal?: AbortSignal) => api.get<StudyParityDetail>(`/admin/studies/${seq}`, { schema: StudyParityDetailSchema, signal }),
  chapterLog: (seq: number, query: { lectureCode: string; studySeq?: number; chapterSeq?: number }, signal?: AbortSignal) => api.get<ChapterLog>(`/admin/studies/${seq}/chapter-log`, { query, schema: ChapterLogSchema, signal }),
  dayTime: (seq: number, date: string | undefined, signal?: AbortSignal) => api.get<DayTime>(`/admin/studies/${seq}/day-time`, { query: { date }, schema: DayTimeSchema, signal }),
  certificate: (seq: number, signal?: AbortSignal) => api.get<CertificateInfo>(`/admin/studies/${seq}/certificate`, { schema: CertificateInfoSchema, signal }),
  preResume: (seq: number, signal?: AbortSignal) => api.get<PreResume>(`/admin/studies/${seq}/pre-resume`, { schema: PreResumeSchema, signal }),
  grantInfo: (seq: number, type: 'PRE' | 'POST', signal?: AbortSignal) => api.get<GrantInfo>(`/admin/studies/${seq}/assessment-grant`, { query: { type }, schema: GrantInfoSchema, signal }),
  grantCreate: (seq: number, body: { type: 'PRE' | 'POST'; operatorName: string; reason: string }) => api.post<GrantResult>(`/admin/studies/${seq}/assessment-grant`, body, { schema: GrantResultSchema }),

  companies: (q: string, signal?: AbortSignal) => api.get<CompanyPick>('/admin/studies/companies', { query: { q }, schema: CompanyPickSchema, signal }),
  dailyTime: (query: Q, signal?: AbortSignal) => api.get<DailyTimePage>('/admin/studies/daily-time', { query, schema: DailyTimePageSchema, signal }),
  downloadDailyTimeCsv: (query: Q, sheet: 'daily' | 'person') => downloadAdminFile('/admin/studies/daily-time/export', { ...query, sheet }, sheet === 'person' ? 'study_time_15h.csv' : 'study_time.csv'),
};
