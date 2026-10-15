import { z } from 'zod';
import { API_BASE, AppError, api, refreshAdminAccessToken } from '../client';
import { adminTokenStore } from '../../auth/adminTokenStore';
import { pageOf } from '../schemas';
import { downloadAdminFile } from './admin';
import { MemberInquirySchema, MemberParityDetailSchema, type MemberInquiry, type MemberParityDetail } from './admin-members-parity';

/** /admin/learning/* — 수강 관리 (hrd_manager study2 / study_end / study_ip / certification_list / negative_training / ai_log_roadmap_analysis / course_data / study_end2 / certificate_test). */
type Q = Record<string, string | number | boolean | null | undefined>;
const optStr = z.string().nullable().optional();
const optNum = z.number().nullable().optional();

export const LearningOptionsSchema = z.object({
  packageCourses: z.array(z.object({ lectureCode: z.string(), name: z.string() })), childCourses: z.array(z.object({ lectureCode: z.string(), name: z.string() })),
  tutors: z.array(z.object({ id: z.string(), name: z.string() })), years: z.array(z.number()), thisYear: z.number(), serviceTypes: z.array(z.object({ value: z.string(), label: z.string() })),
  subjectCourses: z.array(z.object({ lectureCode: z.string(), name: z.string() })).optional(),
});
export type LearningOptions = z.infer<typeof LearningOptionsSchema>;
export const LearningTermsSchema = z.object({ year: z.number(), month: z.number().nullable(), companyCode: optStr, items: z.array(z.object({ start: z.string(), end: z.string(), label: z.string() })) });
export type LearningTerms = z.infer<typeof LearningTermsSchema>;
export const CompanyPickSchema = z.object({ items: z.array(z.object({ companyCode: z.string(), companyName: optStr })), truncated: z.boolean().optional() });
export const TermCompaniesSchema = z.object({ lectureStart: z.string(), lectureEnd: z.string(), items: z.array(z.object({ companyCode: z.string(), companyName: optStr, label: z.string() })) });
export type TermCompanies = z.infer<typeof TermCompaniesSchema>;
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
export const MailStubResultSchema = z.object({ ok: z.boolean(), code: z.string(), kind: z.string(), template: z.string(), to: z.string(), subject: z.string(), companyName: optStr, message: z.string(), html: z.string().optional(), links: z.array(z.object({ label: z.string(), url: z.string() })).optional(), tokenSigned: z.boolean().optional() });
export type MailStubResult = z.infer<typeof MailStubResultSchema>;

export const CertificateItemSchema = z.object({ id: z.string(), studySeq: z.number(), name: optStr, birthDay: z.string(), companyName: z.string(), courseName: z.string(), lectureCode: optStr, contentsTime: z.union([z.string(), z.number()]).nullable().optional(), lectureStart: z.string(), lectureEnd: z.string(), periodLabel: z.string(), seconds: z.number(), hours: z.number() });
export const CertificateSheetSchema = z.object({
  kind: z.enum(['completion', 'subject']), title: z.string(), siteName: z.string(), issueDate: z.string(), issueDateLabel: z.string(), body: z.array(z.string()), items: z.array(CertificateItemSchema),
  showContentsTime: z.boolean().optional(), fileName: z.string().optional(), passOk: z.boolean().optional(), found: z.boolean().optional(),
  diag: z.object({ totalStudy: z.number(), passedStudy: z.number(), messages: z.array(z.string()) }).optional(),
});
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
export const AiSummarySchema = z.object({ computedAt: z.string().optional(), totalUsers: z.number(), totalCourses: z.number(), completedCount: z.number(), totalStudies: z.number(), generalAvgProgress: z.number(), avgProgress: z.number(), filteredUsersWithCourses: z.number(), progressBuckets: z.object({ high: z.number(), medium: z.number(), low: z.number() }), statusBuckets: z.object({ completed: z.number(), notCompleted: z.number() }) });
export const AiPageSchema = pageOf(AiRowSchema).extend({ summary: AiSummarySchema });
export type AiPage = z.infer<typeof AiPageSchema>;

export const CompletionRowSchema = z.object({ progressIdx: z.number(), id: z.string(), name: optStr, studySeq: z.number(), companyCode: optStr, companyName: optStr, category1: optStr, keyword2Name: optStr, ncsCode: z.string(), serviceType: optStr, serviceTypeLabel: z.string(), lectureCode: z.string(), courseName: z.string(), contentsTime: optNum, studyMinutes: z.number(), rate: z.number(), lectureStart: optStr, lectureEnd: optStr, openChapter: optNum });
export type CompletionRow = z.infer<typeof CompletionRowSchema>;

export const SubjectCertRowSchema = z.object({ lectureStart: z.string(), lectureEnd: z.string(), companyCode: optStr, companyName: optStr, studySeq: z.number(), lectureCode: z.string(), courseName: z.string(), ctype: optStr, ctypeLabel: z.string(), name: optStr, id: z.string(), storedProgress: z.number(), passOk: z.boolean(), certOk: z.boolean(),
  groupIndex: z.number().optional(), groupNo: z.number().optional(), groupFirst: z.boolean().optional(), groupSize: z.number().optional() });
export type SubjectCertRow = z.infer<typeof SubjectCertRowSchema>;

export const CertSampleSchema = z.object({ kind: z.string(), found: z.boolean(), seq: optNum, companyCode: optStr, companyName: optStr, lectureStart: optStr, lectureEnd: optStr, lectureCode: optStr, id: optStr });
export type CertSample = z.infer<typeof CertSampleSchema>;
const OkSchema = z.object({ ok: z.boolean() }).passthrough();

export interface Page<T> { items: T[]; page: number; size: number; total: number }

// ---- parity additions (2026-10-15)
export const CourseInfoSchema = z.object({
  idx: optNum, lectureCode: z.string(), menuName: z.string(), classGradeLabel: z.string(), useYNLabel: z.string(), contentsUrlSelect: optStr, packageLectureCode: optStr, hrdSeq: z.union([z.string(), z.number()]).nullable().optional(),
  categoryName1: optStr, categoryName2: optStr, serviceTypeLabel: z.string(), contentsTime: z.union([z.string(), z.number()]).nullable().optional(), contentsName: optStr, viewCount: z.number(),
  keyword1Name: optStr, keyword2Name: optStr, keyword3: optStr, keyword4: optStr, chapterLabel: z.string(), contentsStart: optStr, contentsEnd: optStr, uploadDate: optStr,
  professor: optStr, passTime: z.union([z.string(), z.number()]).nullable().optional(), mobileLabel: z.string(), bookPrice: z.string(), price: z.string(), price01View: z.string(), price02View: z.string(), price03View: z.string(),
  bookIntro: optStr, attachFile: optStr, previewImage: optStr, bookImage: optStr, intro: optStr, eduTarget: optStr, eduGoal: optStr,
});
export type CourseInfo = z.infer<typeof CourseInfoSchema>;

export const ReceiptSchema = z.object({
  title: z.string(), companyLabel: z.string(), header: z.array(z.string()),
  items: z.array(z.object({ no: z.number(), studySeq: z.number(), course: z.string(), period: z.string(), companyName: z.string(), name: z.string(), birthDay: z.string(), fee: z.string(), selfPay: z.string() })),
  totalLabel: z.string(), totalFee: z.string(), totalSelfPay: z.string(), certifyText: z.string(), date: z.string(), siteName: z.string(), fileName: z.string(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

const Trainee = z.object({ id: z.string(), name: optStr, totalStudyTime: z.number(), progress: z.number(), passOk: z.boolean() }).passthrough();
export const ReportSchema = z.object({
  reportType: z.enum(['training_progress', 'education_results']), version: z.enum(['v1', 'v2']), today: z.string(),
  meta: z.object({ companyCode: z.string(), companyName: z.string(), lectureCode: z.string(), courseName: z.string(), trainingStart: z.string(), trainingEnd: z.string(), trainingPeriod: z.string(), trainingYear: z.string() }),
  trainees: z.array(Trainee),
  summary: z.object({ totalTrainees: z.number(), completedCount: z.number(), inProgressCount: z.number(), notStartedCount: z.number(), avgProgressRate: z.number(), avgStudyTimeSeconds: z.number(), avgStudyHours: z.number(), avgStudyMinutes: z.number(), participationRate: z.number(), completionRatePercent: z.number(), avgSatisfaction: z.number(), satisfactionRespondents: z.number(), reParticipationRate: z.number() }),
  competence: z.object({ c1: z.number(), c2: z.number(), j1: z.number(), j2: z.number(), l1: z.number(), l2: z.number(), overallBefore: z.number(), overallAfter: z.number(), overallChange: z.number() }),
  monthly: z.array(z.object({ month: z.string(), avgTime: z.number() })),
  v1: z.object({
    title: z.string(), receiptDate: z.string(), submitDate: z.string(), statusLabels: z.array(z.string()), statusPercents: z.array(z.number()),
    competenceRows: z.array(z.object({ label: z.string(), before: z.number(), after: z.number(), change: z.string() })),
    trainees: z.array(z.object({ no: z.number(), id: z.string(), name: z.string(), progress: z.number(), commonScore: z.number(), jobScore: z.number(), leadershipScore: z.number(), satisfaction: z.string(), status: z.string() })),
    authorName: z.string(), authorDept: z.string(), submitOrg: z.string(), aiSections: z.array(z.string()),
  }),
  v2: z.object({
    copy: z.object({ title: z.string(), section1: z.string(), section2: z.string(), section3: z.string(), section4: z.string(), submitText: z.string(), completeHeader: z.string() }),
    documentNo: z.string(), receiptDate: z.string(), reportDate: z.string(), authorOrg: z.string(), authorDept: z.string(), authorName: z.string(), goal: z.array(z.string()), proposal: z.array(z.string()), notice: z.array(z.string()),
    progressPct: z.string(), completePct: z.string(), avgStudyHms: z.string(), studyTimeLabel: z.string(), studyTimeValue: z.string(),
    competence: z.array(z.object({ label: z.string(), chartLabel: z.string(), delta: z.string(), before: z.number(), after: z.number() })),
    improvedItems: z.array(z.string()), needsWorkItems: z.array(z.string()),
    satItems: z.array(z.object({ idx: z.number(), label: z.string(), chartLabel: z.string(), n: z.number(), avg10: z.number().nullable(), avg10Label: z.string() })), overallSat100: z.number().nullable(), satChartTitle: z.string(),
    effects: z.array(z.object({ label: z.string(), text: z.string() })), applyRate: z.number(), applyText: z.string(), fraudCheck: z.string(), fraudCheckText: z.string(), showLeadershipColumns: z.boolean(),
    trainees: z.array(z.object({ no: z.number(), id: z.string(), name: z.string(), studyTimeHms: z.string(), cBefore: z.string(), cAfter: z.string(), lBefore: z.string(), lAfter: z.string(), jobBefore: z.string(), jobAfter: z.string(), sat100: z.string(), status: z.string() })),
  }).optional(),
});
export type Report = z.infer<typeof ReportSchema>;
export const ReportAiSchema = z.object({ section: z.number(), feedback: z.string(), model: z.enum(['ai', 'fallback']), cached: z.boolean() });

const RecItem = z.object({ code: z.string(), name: z.string(), time: z.number(), chapter: z.number(), category: z.string(), recommendReason: z.string() });
export const AiUserDetailSchema = z.object({
  basic: z.object({ id: z.string(), name: optStr, companyName: optStr, depart: optStr, position: optStr, regDate: optStr, email: z.string(), mobile: z.string() }),
  summary: z.object({ totalCourses: z.number(), avgProgress: z.number(), completedCount: z.number(), totalStudyCount: z.number(), totalStudyTime: z.number(), studyTimeLabel: z.string(), passRate: z.number(), state: z.string() }),
  preAssessment: z.object({ userGroup: z.string(), diagnosisDate: z.string(), weakAreas: z.array(z.string()), weakAreasTop5: z.array(z.string()) }).nullable(),
  recommend: z.object({ steps: z.array(z.object({ title: z.string(), description: z.string(), showReason: z.boolean(), items: z.array(RecItem) })), recommendedCount: z.number(), candidateCount: z.number() }),
  roadmap: z.array(z.object({ no: z.number(), studySeq: z.number(), lectureCode: z.string(), courseName: z.string(), lectureStart: z.string(), lectureEnd: z.string(), progress: z.number(), progressTone: z.enum(['danger', 'warn', 'ok']), seconds: z.number(), studyTimeLabel: z.string(), passLabel: z.string(), learningLabel: z.string() })),
  pattern: z.array(z.object({ date: z.string(), label: z.string(), minutes: z.number() })),
});
export type AiUserDetail = z.infer<typeof AiUserDetailSchema>;

/** Certificate PDF kinds (one per PHP FPDF script) → API path. */
export type CertificatePdfKind = 'completion' | 'seq' | 'subject-row' | 'subject' | 'learner' | 'manager';
export const CERTIFICATE_PDF_PATH: Record<CertificatePdfKind, string> = {
  completion: '/admin/learning/closings/certificates/pdf', // include/certificate_pdf02.php
  seq: '/admin/learning/certificates/by-seq/pdf', // include/certificate_pdf01.php
  'subject-row': '/admin/learning/subject-certificates/row-print/pdf', // include/certificate_pdf04.php
  subject: '/admin/learning/subject-certificates/print/pdf', // hrd_manager/study_end2_user_pdf.php
  learner: '/admin/learning/certificates/learner/pdf', // public/mypage/certificate_pdf01.php
  manager: '/admin/learning/certificates/manager/pdf', // public/mypage/manager_certificate_pdf.php
};

/**
 * GETs an admin file with the bearer token and returns blob + Content-Disposition (file name, inline/attachment). Error bodies
 * ({message} JSON) become AppError with the API message, so the PHP alert texts ("수료내역이 없습니다." …) reach the toast.
 */
export async function fetchAdminFile(path: string, query: Q): Promise<{ blob: Blob; fileName: string | null; inline: boolean }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const go = () => fetch(url, { headers: { Authorization: `Bearer ${adminTokenStore.get() ?? ''}` }, credentials: 'include' });
  let res = await go();
  if (res.status === 401 && (await refreshAdminAccessToken())) res = await go();
  if (!res.ok) {
    let body: { code?: string; message?: string; error?: { code?: string; message?: string } } = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    const message = body.error?.message ?? body.message ?? (res.status === 403 ? '권한이 없습니다.' : '파일을 내려받지 못했습니다.');
    throw new AppError(body.error?.code ?? body.code ?? (res.status === 403 ? 'FORBIDDEN' : res.status === 404 ? 'NOT_FOUND' : 'INTERNAL'), message, res.status);
  }
  const cd = res.headers.get('Content-Disposition') ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(cd)?.[1];
  return { blob: await res.blob(), fileName: star ? decodeURIComponent(star) : plain ?? null, inline: /^\s*inline/i.test(cd) };
}

/** Saves a blob under a file name (anchor download). */
export function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = href; a.download = fileName; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/**
 * Opens a certificate PDF the way the PHP Output() did: 'I' (inline) PDFs in a new tab, 'D' (download) PDFs saved under the PHP
 * file name. `win` is a tab opened synchronously in the click handler (popup blockers); it is closed for downloads / errors.
 */
export async function openCertificatePdf(kind: CertificatePdfKind, query: Q, win?: Window | null): Promise<void> {
  try {
    const f = await fetchAdminFile(CERTIFICATE_PDF_PATH[kind], query);
    const pdf = f.blob.type === 'application/pdf' ? f.blob : new Blob([f.blob], { type: 'application/pdf' });
    if (f.inline && win && !win.closed) { win.location.href = URL.createObjectURL(pdf); return; }
    win?.close();
    saveBlob(pdf, f.fileName ?? 'certificate.pdf');
  } catch (err) { win?.close(); throw err; }
}

export const adminLearningApi = {
  options: (signal?: AbortSignal) => api.get<LearningOptions>('/admin/learning/options', { schema: LearningOptionsSchema, signal }),
  terms: (query: Q, signal?: AbortSignal) => api.get<LearningTerms>('/admin/learning/terms', { query, schema: LearningTermsSchema, signal }),
  companies: (q: string, signal?: AbortSignal) => api.get<CompanyPick>('/admin/learning/companies', { query: { q }, schema: CompanyPickSchema, signal }),
  termCompanies: (lectureStart: string, lectureEnd: string, signal?: AbortSignal) => api.get<TermCompanies>('/admin/learning/term-companies', { query: { lectureStart, lectureEnd }, schema: TermCompaniesSchema, signal }),
  courseInfo: (lectureCode: string, signal?: AbortSignal) => api.get<CourseInfo>('/admin/learning/course-info', { query: { lectureCode }, schema: CourseInfoSchema, signal }),
  memberInfo: (id: string, signal?: AbortSignal) => api.get<MemberParityDetail>(`/admin/learning/member-info/${encodeURIComponent(id)}`, { schema: MemberParityDetailSchema, signal }),
  /** qna_read.php?idx= from the member_info_pop 1:1 문의 list (수강 관리 grants). */
  memberInquiry: (id: string, idx: number, signal?: AbortSignal) => api.get<MemberInquiry>(`/admin/learning/member-info/${encodeURIComponent(id)}/inquiries/${idx}`, { schema: MemberInquirySchema, signal }),
  /** course_info_pop.php 학습자료 (direct_download.php?code=Course). */
  downloadCourseAttach: (lectureCode: string, fileName: string) => downloadAdminFile('/admin/learning/course-info/attach', { lectureCode }, fileName),
  receipt: (query: Q, signal?: AbortSignal) => api.get<Receipt>('/admin/learning/closings/receipt', { query, schema: ReceiptSchema, signal }),
  downloadReceiptXls: (query: Q, fileName: string) => downloadAdminFile('/admin/learning/closings/receipt-excel', query, fileName),
  /** receipt_confirm_excel.php as a real workbook ([사업주명].xlsx, stamp embedded). */
  downloadReceiptXlsx: (query: Q, fileName: string) => downloadAdminFile('/admin/learning/closings/receipt-xlsx', query, fileName),
  report: (type: 'training_progress' | 'education_results', query: Q, signal?: AbortSignal) => api.get<Report>(`/admin/learning/closings/reports/${type}`, { query, schema: ReportSchema, signal }),
  reportAi: (type: 'training_progress' | 'education_results', query: Q, signal?: AbortSignal) => api.get<z.infer<typeof ReportAiSchema>>(`/admin/learning/closings/reports/${type}/ai`, { query, schema: ReportAiSchema, signal }),
  aiUserDetail: (id: string, signal?: AbortSignal) => api.get<AiUserDetail>(`/admin/learning/ai-analysis/users/${encodeURIComponent(id)}`, { schema: AiUserDetailSchema, signal }),
  subjectRowPrint: (query: Q, signal?: AbortSignal) => api.get<CertificateSheet>('/admin/learning/subject-certificates/row-print', { query, schema: CertificateSheetSchema, signal }),
  certificateBySeq: (seq: number | string, signal?: AbortSignal) => api.get<CertificateSheet>('/admin/learning/certificates/by-seq', { query: { seq }, schema: CertificateSheetSchema, signal }),
  certificateLearner: (query: Q, signal?: AbortSignal) => api.get<CertificateSheet>('/admin/learning/certificates/learner', { query, schema: CertificateSheetSchema, signal }),
  certificateManager: (id: string, signal?: AbortSignal) => api.get<CertificateSheet>('/admin/learning/certificates/manager', { query: { id }, schema: CertificateSheetSchema, signal }),

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
  /** ai_log_roadmap_analysis_excel.php (AI_로그_로드맵_분석_YmdHis.xlsx). */
  downloadAiXlsx: (query: Q) => downloadAdminFile('/admin/learning/ai-analysis/export-xlsx', query, 'ai_analysis.xlsx'),

  // 과정 이수데이터 관리 (B7)
  completionData: (query: Q, signal?: AbortSignal) => api.get<Page<CompletionRow>>('/admin/learning/completion-data', { query, schema: pageOf(CompletionRowSchema), signal }),
  downloadCompletionCsv: (query: Q) => downloadAdminFile('/admin/learning/completion-data/export', query, 'completion_data.csv'),
  /** course_data_search_excel.php (개인별 과정 이수 데이터_Ymd.xlsx, template formatting). */
  downloadCompletionXlsx: (query: Q) => downloadAdminFile('/admin/learning/completion-data/export-xlsx', query, 'completion_data.xlsx'),

  // 과목별 이수증 (B8)
  subjectCertificates: (query: Q, signal?: AbortSignal) => api.get<Page<SubjectCertRow>>('/admin/learning/subject-certificates', { query, schema: pageOf(SubjectCertRowSchema), signal }),
  downloadSubjectCsv: (query: Q) => downloadAdminFile('/admin/learning/subject-certificates/export', query, 'subject_certificates.csv'),
  subjectCertificatePrint: (query: Q, signal?: AbortSignal) => api.get<CertificateSheet>('/admin/learning/subject-certificates/print', { query, schema: CertificateSheetSchema, signal }),

  // 수료증/이수증 테스트
  certificateSample: (kind: 'latest_seq' | 'latest_study_end' | 'latest_progress100', signal?: AbortSignal) => api.get<CertSample>('/admin/learning/certificate-samples', { query: { kind }, schema: CertSampleSchema, signal }),
};
