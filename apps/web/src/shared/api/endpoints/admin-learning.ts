import { z } from 'zod';
import { api } from '../client';
import { pageOf } from '../schemas';
import { downloadAdminFile } from './admin';

/** /admin/learning/* — 수강 관리 (hrd_manager study2 / study_end / study_ip / certification_list / negative_training / ai_log_roadmap_analysis / course_data / study_end2 / certificate_test). */
type Q = Record<string, string | number | boolean | null | undefined>;
const optStr = z.string().nullable().optional();
const optNum = z.number().nullable().optional();

export const LearningOptionsSchema = z.object({
  packageCourses: z.array(z.object({ lectureCode: z.string(), name: z.string() })), childCourses: z.array(z.object({ lectureCode: z.string(), name: z.string() })),
  tutors: z.array(z.object({ id: z.string(), name: z.string() })), years: z.array(z.number()), thisYear: z.number(), serviceTypes: z.array(z.object({ value: z.string(), label: z.string() })),
});
export type LearningOptions = z.infer<typeof LearningOptionsSchema>;
export const LearningTermsSchema = z.object({ year: z.number(), month: z.number().nullable(), companyCode: optStr, items: z.array(z.object({ start: z.string(), end: z.string(), label: z.string() })) });
export type LearningTerms = z.infer<typeof LearningTermsSchema>;
export const CompanyPickSchema = z.object({ items: z.array(z.object({ companyCode: z.string(), companyName: optStr })) });
export type CompanyPick = z.infer<typeof CompanyPickSchema>;

export const StudyHistoryRowSchema = z.object({ id: z.string(), name: optStr, studySeq: z.number(), lectureCode: z.string(), serviceType: optStr, serviceTypeLabel: z.string(), courseName: z.string(), companyName: optStr, progress: z.number(), seconds: z.number(), formatted: z.string(), startDate: optStr, endDate: optStr });
export type StudyHistoryRow = z.infer<typeof StudyHistoryRowSchema>;

export const ClosingRowSchema = z.object({
  lectureStart: z.string(), lectureEnd: z.string(), openChapter: optNum, companyCode: z.string(), companyName: optStr, lectureCode: z.string(), courseName: z.string(), serviceType: z.string(), serviceTypeLabel: z.string(),
  studyCount: z.number(), endedCount: z.number(), status: z.enum(['N', 'Y', 'P', '-']), processedBy: z.string(), processedAt: z.string(), certificatePrintOk: z.boolean(), courseExists: z.boolean(), depositStatus: z.enum(['P', 'C']), paymentSheetIdx: optNum,
});
export type ClosingRow = z.infer<typeof ClosingRowSchema>;
export const ClosingCompleteResultSchema = z.object({ ok: z.boolean(), studies: z.number(), ended: z.number(), studyEndInserted: z.number(), studyEndUpdated: z.number(), childrenEnded: z.number() });
export type ClosingCompleteResult = z.infer<typeof ClosingCompleteResultSchema>;
export const DepositResultSchema = z.object({ ok: z.boolean(), depositStatus: z.enum(['P', 'C']), paymentSheetIdx: z.number(), created: z.boolean() });
export const MailStubResultSchema = z.object({ ok: z.boolean(), code: z.string(), kind: z.string(), template: z.string(), to: z.string(), subject: z.string(), companyName: optStr, message: z.string() });
export type MailStubResult = z.infer<typeof MailStubResultSchema>;

export const CertificateItemSchema = z.object({ id: z.string(), studySeq: z.number(), name: optStr, birthDay: z.string(), companyName: z.string(), courseName: z.string(), lectureCode: optStr, contentsTime: z.union([z.string(), z.number()]).nullable().optional(), lectureStart: z.string(), lectureEnd: z.string(), periodLabel: z.string(), seconds: z.number(), hours: z.number() });
export const CertificateSheetSchema = z.object({ kind: z.enum(['completion', 'subject']), title: z.string(), siteName: z.string(), issueDate: z.string(), issueDateLabel: z.string(), body: z.array(z.string()), items: z.array(CertificateItemSchema) });
export type CertificateSheet = z.infer<typeof CertificateSheetSchema>;

export const IpGroupRowSchema = z.object({ companyCode: z.string(), companyName: optStr, address01: optStr, address02: optStr, ip: z.string(), userCount: z.number(), recordCount: z.number(), courseCount: z.number(), avgProgress: z.number(), progressDiff: z.number(), firstStart: z.string(), lastEnd: z.string(), riskLabel: z.string(), riskLevel: z.enum(['danger', 'warn', 'caution']) });
export type IpGroupRow = z.infer<typeof IpGroupRowSchema>;
export const IpDetailRowSchema = z.object({ studySeq: z.number(), serviceType: optStr, id: z.string(), name: optStr, depart: optStr, companyCode: optStr, companyName: optStr, address01: optStr, address02: optStr, lectureCode: z.string(), courseName: z.string(), lectureStart: z.string(), lectureEnd: z.string(), tutorLimit: z.string(), progress: z.number(), passOk: z.boolean(), certCount: z.number(), studyEnd: z.boolean(), ip: optStr, tutorName: optStr, salesName: optStr, salesTeam: optStr, duplicate: z.boolean(), similarPattern: z.boolean() });
export type IpDetailRow = z.infer<typeof IpDetailRowSchema>;
export const IpMonitorSchema = z.discriminatedUnion('mode', [pageOf(IpGroupRowSchema).extend({ mode: z.literal('group') }), pageOf(IpDetailRowSchema).extend({ mode: z.literal('detail') })]);
export type IpMonitor = z.infer<typeof IpMonitorSchema>;
export const IpGroupMembersSchema = z.object({ companyCode: z.string(), ip: z.string(), items: z.array(z.object({ studySeq: z.number(), id: z.string(), name: optStr, depart: optStr, salesName: optStr, salesTeam: optStr, lectureCode: z.string(), courseName: z.string(), lectureStart: z.string(), lectureEnd: z.string(), progress: z.number(), passOk: z.boolean(), certCount: z.number() })) });
export type IpGroupMembers = z.infer<typeof IpGroupMembersSchema>;
export const IpChaptersSchema = z.object({ studySeq: z.number(), id: z.string(), lectureCode: z.string(), courseName: z.string(), lectureStart: z.string(), lectureEnd: z.string(), storedProgress: z.number(), passOk: z.boolean(), items: z.array(z.object({ contentsIdx: z.number(), chapterNumber: optStr, title: optStr, progress: z.number(), seconds: z.number(), formatted: z.string(), ip: optStr, at: optStr })), chapterCount: z.number(), totalSeconds: z.number(), totalFormatted: z.string() });
export type IpChapters = z.infer<typeof IpChaptersSchema>;

export const IdentityRowSchema = z.object({ seq: z.number(), id: z.string(), companyName: optStr, name: optStr, courseName: optStr, lectureCode: optStr, studySeq: optNum, certifiedAt: optStr, sentAt: optStr, ok: z.boolean(), ip: optStr });
export type IdentityRow = z.infer<typeof IdentityRowSchema>;

export const NegativeRowSchema = z.object({ idx: z.number(), companyCode: z.string(), companyName: optStr, content: z.string(), regDate: optStr });
export type NegativeRow = z.infer<typeof NegativeRowSchema>;

export const AiRowSchema = z.object({ id: z.string(), name: optStr, courseNames: optStr, companyName: optStr, progress: z.number(), progressLabel: z.string(), seconds: z.number(), studyTimeLabel: z.string(), lectureStart: optStr, lectureEnd: optStr, totalStudyCount: z.number(), completedCount: z.number(), completion: z.enum(['수료', '미수료', '-']) });
export type AiRow = z.infer<typeof AiRowSchema>;
export const AiSummarySchema = z.object({ totalUsers: z.number(), totalCourses: z.number(), completedCount: z.number(), totalStudies: z.number(), generalAvgProgress: z.number(), avgProgress: z.number(), filteredUsersWithCourses: z.number(), progressBuckets: z.object({ high: z.number(), medium: z.number(), low: z.number() }), statusBuckets: z.object({ completed: z.number(), notCompleted: z.number() }) });
export const AiPageSchema = pageOf(AiRowSchema).extend({ summary: AiSummarySchema });
export type AiPage = z.infer<typeof AiPageSchema>;

export const CompletionRowSchema = z.object({ progressIdx: z.number(), id: z.string(), name: optStr, studySeq: z.number(), companyCode: optStr, companyName: optStr, category1: optStr, keyword2Name: optStr, ncsCode: z.string(), serviceType: optStr, serviceTypeLabel: z.string(), lectureCode: z.string(), courseName: z.string(), contentsTime: optNum, studyMinutes: z.number(), rate: z.number(), lectureStart: optStr, lectureEnd: optStr, openChapter: optNum });
export type CompletionRow = z.infer<typeof CompletionRowSchema>;

export const SubjectCertRowSchema = z.object({ lectureStart: z.string(), lectureEnd: z.string(), companyCode: optStr, companyName: optStr, studySeq: z.number(), lectureCode: z.string(), courseName: z.string(), ctype: optStr, ctypeLabel: z.string(), name: optStr, id: z.string(), storedProgress: z.number(), passOk: z.boolean(), certOk: z.boolean() });
export type SubjectCertRow = z.infer<typeof SubjectCertRowSchema>;

export const CertSampleSchema = z.object({ kind: z.string(), found: z.boolean(), seq: optNum, companyCode: optStr, companyName: optStr, lectureStart: optStr, lectureEnd: optStr, lectureCode: optStr, id: optStr });
export type CertSample = z.infer<typeof CertSampleSchema>;
const OkSchema = z.object({ ok: z.boolean() }).passthrough();

export interface Page<T> { items: T[]; page: number; size: number; total: number }

export const adminLearningApi = {
  options: (signal?: AbortSignal) => api.get<LearningOptions>('/admin/learning/options', { schema: LearningOptionsSchema, signal }),
  terms: (query: Q, signal?: AbortSignal) => api.get<LearningTerms>('/admin/learning/terms', { query, schema: LearningTermsSchema, signal }),
  companies: (q: string, signal?: AbortSignal) => api.get<CompanyPick>('/admin/learning/companies', { query: { q }, schema: CompanyPickSchema, signal }),

  // 학습내역관리 (B5)
  history: (query: Q, signal?: AbortSignal) => api.get<Page<StudyHistoryRow>>('/admin/learning/history', { query, schema: pageOf(StudyHistoryRowSchema), signal }),
  downloadHistoryCsv: (query: Q) => downloadAdminFile('/admin/learning/history/export', query, 'study_history.csv'),

  // 수강마감 (B6)
  closings: (query: Q, signal?: AbortSignal) => api.get<Page<ClosingRow>>('/admin/learning/closings', { query, schema: pageOf(ClosingRowSchema), signal }),
  completeClosing: (body: { companyCode: string; lectureStart: string; lectureEnd: string }) => api.post<ClosingCompleteResult>('/admin/learning/closings/complete', body, { schema: ClosingCompleteResultSchema }),
  setDepositStatus: (body: { companyCode: string; lectureStart: string; lectureEnd: string; depositStatus: 'P' | 'C' }) => api.post<z.infer<typeof DepositResultSchema>>('/admin/learning/closings/deposit-status', body, { schema: DepositResultSchema }),
  sendCertMail: (body: Record<string, unknown>) => api.post<MailStubResult>('/admin/learning/closings/cert-mail', body, { schema: MailStubResultSchema }),
  sendReportMail: (body: Record<string, unknown>) => api.post<MailStubResult>('/admin/learning/closings/report-mail', body, { schema: MailStubResultSchema }),
  closingCertificates: (query: Q, signal?: AbortSignal) => api.get<CertificateSheet>('/admin/learning/closings/certificates', { query, schema: CertificateSheetSchema, signal }),

  // IP모니터링 (B1)
  ipMonitor: (query: Q, signal?: AbortSignal) => api.get<IpMonitor>('/admin/learning/ip-monitor', { query, schema: IpMonitorSchema, signal }),
  ipGroup: (companyCode: string, ip: string, signal?: AbortSignal) => api.get<IpGroupMembers>('/admin/learning/ip-monitor/group', { query: { companyCode, ip }, schema: IpGroupMembersSchema, signal }),
  ipChapters: (seq: number, signal?: AbortSignal) => api.get<IpChapters>(`/admin/learning/ip-monitor/${seq}/chapters`, { schema: IpChaptersSchema, signal }),
  downloadIpCsv: (query: Q) => downloadAdminFile('/admin/learning/ip-monitor/export', query, 'ip_monitor.csv'),

  // 본인인증 모니터링 (B2)
  identityChecks: (query: Q, signal?: AbortSignal) => api.get<Page<IdentityRow>>('/admin/learning/identity-checks', { query, schema: pageOf(IdentityRowSchema), signal }),
  downloadIdentityCsv: (query: Q) => downloadAdminFile('/admin/learning/identity-checks/export', query, 'identity_checks.csv'),

  // 리포트 부정훈련 (B4)
  negatives: (query: Q, signal?: AbortSignal) => api.get<Page<NegativeRow>>('/admin/learning/negative-trainings', { query, schema: pageOf(NegativeRowSchema), signal }),
  negative: (idx: number, signal?: AbortSignal) => api.get<NegativeRow>(`/admin/learning/negative-trainings/${idx}`, { schema: NegativeRowSchema, signal }),
  createNegative: (body: { CompanyCode: string; Content: string }) => api.post<{ ok: boolean; idx?: number }>('/admin/learning/negative-trainings', body, { schema: OkSchema }),
  patchNegative: (idx: number, body: { Content: string }) => api.patch<{ ok: boolean }>(`/admin/learning/negative-trainings/${idx}`, body, { schema: OkSchema }),
  deleteNegative: (idx: number) => api.delete<{ ok: boolean }>(`/admin/learning/negative-trainings/${idx}`, { schema: OkSchema }),

  // AI 로그·로드맵 분석 (B9)
  aiAnalysis: (query: Q, signal?: AbortSignal) => api.get<AiPage>('/admin/learning/ai-analysis', { query, schema: AiPageSchema, signal }),
  downloadAiCsv: (query: Q) => downloadAdminFile('/admin/learning/ai-analysis/export', query, 'ai_analysis.csv'),

  // 과정 이수데이터 관리 (B7)
  completionData: (query: Q, signal?: AbortSignal) => api.get<Page<CompletionRow>>('/admin/learning/completion-data', { query, schema: pageOf(CompletionRowSchema), signal }),
  downloadCompletionCsv: (query: Q) => downloadAdminFile('/admin/learning/completion-data/export', query, 'completion_data.csv'),

  // 과목별 이수증 (B8)
  subjectCertificates: (query: Q, signal?: AbortSignal) => api.get<Page<SubjectCertRow>>('/admin/learning/subject-certificates', { query, schema: pageOf(SubjectCertRowSchema), signal }),
  downloadSubjectCsv: (query: Q) => downloadAdminFile('/admin/learning/subject-certificates/export', query, 'subject_certificates.csv'),
  subjectCertificatePrint: (query: Q, signal?: AbortSignal) => api.get<CertificateSheet>('/admin/learning/subject-certificates/print', { query, schema: CertificateSheetSchema, signal }),

  // 수료증/이수증 테스트
  certificateSample: (kind: 'latest_seq' | 'latest_study_end' | 'latest_progress100', signal?: AbortSignal) => api.get<CertSample>('/admin/learning/certificate-samples', { query: { kind }, schema: CertSampleSchema, signal }),
};
