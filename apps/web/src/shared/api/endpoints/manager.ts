import { z } from 'zod';
import { API_BASE, AppError, api, refreshAccessToken } from '../client';
import { tokenStore } from '../../auth/tokenStore';
import { ChapterProgressRowSchema, DailyRowSchema } from '../schemas';

// ---------------------------------------------------------------------------------------------------------------------
// 교육담당자 (Member.EduManager='Y') — GET/POST /manager/* (learner Bearer token, scoped to the manager's companies)
// ---------------------------------------------------------------------------------------------------------------------
const optStr = z.string().nullable().optional();
const Period = z.object({ start: z.string(), end: z.string(), label: z.string().optional() });

export const ManagerCompanySchema = z.object({ companyCode: z.string(), companyName: z.string(), ceo: optStr, tel: optStr, primary: z.boolean().default(false), trainees: z.number().default(0) });
export type ManagerCompany = z.infer<typeof ManagerCompanySchema>;

export const ManagerOverviewSchema = z.object({
  scope: z.array(z.string()), selectedCompany: z.string().default(''), today: z.string(), asOf: z.string(),
  stats: z.object({ totalLearners: z.number(), completedLearners: z.number(), avgCompletionRate: z.number(), avgProgressRate: z.number(), avgSatisfaction: z.number(), safeLearners: z.number(), warningLearners: z.number(), atRiskLearners: z.number(), weeklyTimeDistribution: z.array(z.number()), paymentCompletionRate: z.number() }),
  payment: z.object({ totalEducationFee: z.number(), totalSelfPayment: z.number(), paymentCompletionRate: z.number() }),
  competency: z.object({ companyCode: z.string().nullable(), commonBefore: z.number(), commonAfter: z.number(), leadershipBefore: z.number(), leadershipAfter: z.number(), jobBefore: z.number(), jobAfter: z.number() }),
  insights: z.object({ insight: z.string(), risk: z.string(), performance: z.string() }),
  composition: z.object({
    refund: z.object({ enrollments: z.number(), withRecord: z.number(), noRecord: z.number(), over15h: z.number(), passed: z.number(), pending: z.number() }),
    nonRefund: z.object({ enrollments: z.number(), withRecord: z.number(), noRecord: z.number() }),
  }),
});
export type ManagerOverview = z.infer<typeof ManagerOverviewSchema>;

export const TraineeRowSchema = z.object({
  studySeq: z.number(), id: z.string(), name: optStr, depart: optStr, position: optStr, companyCode: z.string(), companyName: optStr,
  serviceType: z.string(), sectionTitle: z.string(), sectionNo: z.number(), lectureCode: z.string(), courseName: z.string(), isPackage: z.boolean().optional(),
  period: Period, studyEnd: z.boolean(), active: z.boolean(), seconds: z.number(), timeLabel: z.string(), formatted: z.string(), percent: z.number(), storedProgress: z.number(),
  passOk: z.boolean(), fifteenMet: z.boolean(), post: z.object({ state: z.enum(['done', 'progress', 'none']), label: z.string() }), postScore: z.number(),
  incomplete: z.object({ code: z.enum(['TIME', 'POST_IN_PROGRESS', 'POST_MISSING']), label: z.string() }).nullable(),
  preLabel: z.string(), preDone: z.boolean(), postDone: z.boolean(), certCount: z.number(), lastLearning: optStr, nudge: z.object({ eligible: z.boolean(), reason: z.string() }),
});
export type TraineeRow = z.infer<typeof TraineeRowSchema>;
export const TraineePageSchema = z.object({
  items: z.array(TraineeRowSchema), page: z.number(), size: z.number(), total: z.number(), totalPages: z.number(), uniqueOnPage: z.number(),
  selectedYear: z.string(), selectedCompany: z.string(), showCompanyColumn: z.boolean(), yearOptions: z.array(z.number()), today: z.string(),
});
export type TraineePage = z.infer<typeof TraineePageSchema>;

export const TraineeProgressSchema = z.object({
  trainee: z.object({ id: z.string(), name: optStr, depart: optStr, position: optStr }), studySeq: z.number(), companyCode: z.string(), companyName: optStr, lectureCode: z.string(), courseName: z.string(),
  serviceType: z.string(), sectionTitle: z.string(), period: Period, passOk: z.boolean(), studyEnd: z.boolean(), storedProgress: z.number(),
  seconds: z.number(), formatted: z.string(), timeLabel: z.string(), percent: z.number(), fifteenMet: z.boolean(), preLabel: z.string(), post: z.object({ state: z.string(), label: z.string() }),
  incomplete: z.object({ code: z.string(), label: z.string() }).nullable(),
  codes: z.array(z.string()).default([]), isPackage: z.boolean().optional(), chapters: z.array(ChapterProgressRowSchema).default([]), daily: z.array(DailyRowSchema).default([]),
});
export type TraineeProgress = z.infer<typeof TraineeProgressSchema>;

const Score = z.object({ common: z.number(), leader: z.number(), job: z.number(), total: z.number(), submitted: z.boolean() });
export const TraineeAssessmentSchema = z.object({ trainee: z.object({ id: z.string(), name: z.string(), companyName: z.string() }), studySeq: z.number(), courseName: z.string(), period: Period, pre: Score, post: Score, comparable: z.boolean() });
export type TraineeAssessment = z.infer<typeof TraineeAssessmentSchema>;

export const RosterSchema = z.object({
  companyCode: z.string(), lectureCode: z.string(), period: Period, courseName: optStr, passed: z.number(), notPassed: z.number(), total: z.number(),
  items: z.array(z.object({ studySeq: z.number(), id: z.string(), name: optStr, gubun: z.string(), courseName: optStr, progress: z.number(), seconds: z.number(), studyTime: z.string(), lectureStart: z.string(), lectureEnd: z.string() })),
});
export type Roster = z.infer<typeof RosterSchema>;

export const CohortCardSchema = z.object({
  companyCode: z.string(), companyName: optStr, lectureCode: z.string(), courseName: z.string(), serviceType: z.string(), mode: z.enum(['refund', 'nonRefund']), title: z.string(), period: Period,
  totalCount: z.number(), completedCount: z.number(), avgProgressRate: z.number(), certificatePrintOk: z.boolean(), confirmed: z.boolean(), state: z.enum(['running', 'ended', 'upcoming']),
  reportDeadline: z.string(), reportAllowed: z.boolean(),
  composition: z.object({ learners: z.number(), withRecord: z.number(), noRecord: z.number(), over15h: z.number().nullable(), passed: z.number().nullable(), notPassed: z.number().nullable(), pending: z.number().nullable() }),
});
export type CohortCard = z.infer<typeof CohortCardSchema>;
export const CompletionSchema = z.object({
  selectedYear: z.string(), selectedCompany: z.string(), yearOptions: z.array(z.number()), today: z.string(), items: z.array(CohortCardSchema),
  overall: z.object({ totalCompleted: z.number(), totalCount: z.number(), avgProgressRate: z.number() }),
  insight: z.object({ completionRate: z.number(), status: z.string(), warning: z.string(), suggestion: z.string() }),
});
export type Completion = z.infer<typeof CompletionSchema>;

export const PaymentItemSchema = z.object({ no: z.number(), studySeq: z.number(), id: z.string(), companyCode: z.string(), lectureCode: z.string(), period: Period, courseName: z.string(), educationFee: z.number(), selfPayment: z.number(), deposit: z.number(), requestAmount: z.number(), depositStatus: z.enum(['P', 'C']), statusLabel: z.string(), payStatus: optStr, payStatusLabel: optStr });
export type PaymentItem = z.infer<typeof PaymentItemSchema>;
export const PaymentsSchema = z.object({
  year: z.string(), yearOptions: z.array(z.number()), page: z.number(), size: z.number(), total: z.number(), totalPages: z.number(),
  summary: z.object({ totalCount: z.number(), uniqueStudents: z.number(), totalEducationFee: z.number(), totalSelfPayment: z.number(), totalDeposit: z.number(), paymentRate: z.number() }),
  items: z.array(PaymentItemSchema),
});
export type Payments = z.infer<typeof PaymentsSchema>;

const ReportTrainee = z.object({ no: z.number(), id: z.string(), name: z.string(), progress: z.number(), commonScore: z.number(), jobScore: z.number(), leadershipScore: z.number(), satisfaction: z.string(), status: z.string() });
export type ReportTraineeRow = z.infer<typeof ReportTrainee>;
const CompetenceRow = z.object({ label: z.string(), before: z.number(), after: z.number(), change: z.string() });
export const EducationReportSchema = z.object({
  reportType: z.literal('education_results'), today: z.string(), asOf: z.string(), digest: z.string(), confirmed: z.boolean(), reportDeadline: z.string(), cap: z.number(),
  meta: z.object({ companyCode: z.string(), companyName: z.string(), lectureCode: z.string(), courseName: z.string(), trainingStart: z.string(), trainingEnd: z.string(), trainingPeriod: z.string(), trainingYear: z.string() }),
  summary: z.object({ totalTrainees: z.number(), completedCount: z.number(), inProgressCount: z.number(), notStartedCount: z.number(), avgProgressRate: z.number(), avgStudyTimeSeconds: z.number(), avgStudyHours: z.number(), avgStudyMinutes: z.number(), participationRate: z.number(), completionRatePercent: z.number(), avgSatisfaction: z.number(), satisfactionRespondents: z.number(), reParticipationRate: z.number() }),
  competence: z.object({ overallBefore: z.number(), overallAfter: z.number(), overallChange: z.number() }).passthrough(),
  monthly: z.array(z.object({ month: z.string(), avgTime: z.number() })),
  v1: z.object({ title: z.string(), receiptDate: z.string(), submitDate: z.string(), statusLabels: z.array(z.string()), statusPercents: z.array(z.number()), competenceRows: z.array(CompetenceRow), trainees: z.array(ReportTrainee), authorName: z.string(), authorDept: z.string(), submitOrg: z.string() }),
});
export type EducationReport = z.infer<typeof EducationReportSchema>;
export const ReportAiSchema = z.object({ section: z.number(), feedback: z.string(), model: z.enum(['ai', 'fallback']), cached: z.boolean() });
export type ReportAi = z.infer<typeof ReportAiSchema>;

export const AssessmentReportSchema = z.object({
  today: z.string(),
  meta: z.object({ companyName: z.string(), lectureCode: z.string(), courseName: z.string(), trainingStart: z.string(), trainingEnd: z.string(), trainingPeriod: z.string(), authorName: z.string(), receiptDate: z.string(), submitDate: z.string() }),
  summary: z.object({ totalTrainees: z.number(), completedCount: z.number(), inProgressCount: z.number(), notStartedCount: z.number(), avgProgressRate: z.number(), avgSatisfaction: z.number(), participationRate: z.number(), completionRatePercent: z.number(), reParticipationRate: z.number(), satisfactionRespondents: z.number() }),
  statusPercents: z.object({ completed: z.number(), inProgress: z.number(), notStarted: z.number() }),
  competence: z.object({ overallBefore: z.number(), overallAfter: z.number(), overallChange: z.number(), rows: z.array(CompetenceRow) }),
  trainees: z.array(ReportTrainee),
  changes: z.array(z.object({ no: z.number(), id: z.string(), name: z.string(), preDate: z.string(), postDate: z.string(), common: z.string(), job: z.string(), leadership: z.string(), total: z.string() })),
  fileTitle: z.string(),
});
export type AssessmentReport = z.infer<typeof AssessmentReportSchema>;

export const NudgeResultSchema = z.object({
  ok: z.boolean(), code: z.string(), requested: z.number(), eligible: z.number(), sent: z.number(), message: z.string(),
  items: z.array(z.object({ studySeq: z.number(), id: z.string().nullable(), name: z.string().nullable(), status: z.enum(['NOT_SENT', 'INELIGIBLE']), reason: z.string(), message: z.string().nullable() })),
});
export type NudgeResult = z.infer<typeof NudgeResultSchema>;

export type TraineeStatus = 'all' | 'guide' | 'achieved' | 'passed' | 'failed';
export interface TraineeQuery { companyCode?: string; year?: string; q?: string; status?: TraineeStatus; serviceType?: string; page?: number; size?: number }
export interface CohortParams { companyCode: string; lectureCode: string; lectureStart: string; lectureEnd: string; serviceType?: string }
type Q = Record<string, string | number | undefined>;

export const managerApi = {
  companies: (signal?: AbortSignal) => api.get<ManagerCompany[]>('/manager/companies', { schema: z.array(ManagerCompanySchema), signal }),
  overview: (companyCode?: string, signal?: AbortSignal) => api.get<ManagerOverview>('/manager/overview', { query: { companyCode }, schema: ManagerOverviewSchema, signal }),
  trainees: (query: TraineeQuery, signal?: AbortSignal) => api.get<TraineePage>('/manager/trainees', { query: { ...query }, schema: TraineePageSchema, signal }),
  traineeProgress: (id: string, studySeq?: number, signal?: AbortSignal) => api.get<TraineeProgress>(`/manager/trainees/${encodeURIComponent(id)}/progress`, { query: { studySeq }, schema: TraineeProgressSchema, signal }),
  traineeAssessment: (id: string, studySeq?: number, signal?: AbortSignal) => api.get<TraineeAssessment>(`/manager/trainees/${encodeURIComponent(id)}/assessment`, { query: { studySeq }, schema: TraineeAssessmentSchema, signal }),
  roster: (query: { companyCode?: string; lectureCode: string; lectureStart: string; lectureEnd: string; sw?: string }, signal?: AbortSignal) => api.get<Roster>('/manager/roster', { query, schema: RosterSchema, signal }),
  completion: (query: { companyCode?: string; year?: string }, signal?: AbortSignal) => api.get<Completion>('/manager/completion', { query, schema: CompletionSchema, signal }),
  payments: (query: { companyCode?: string; year?: string; page?: number }, signal?: AbortSignal) => api.get<Payments>('/manager/payments', { query, schema: PaymentsSchema, signal }),
  educationReport: (query: CohortParams, signal?: AbortSignal) => api.get<EducationReport>('/manager/reports/education-results', { query: { ...query }, schema: EducationReportSchema, signal }),
  educationReportAi: (query: CohortParams & { section: number }, signal?: AbortSignal) => api.get<ReportAi>('/manager/reports/education-results/ai', { query: { ...query }, schema: ReportAiSchema, signal }),
  assessmentReport: (query: { companyCode?: string; lectureCode?: string; lectureStart?: string; lectureEnd?: string }, signal?: AbortSignal) => api.get<AssessmentReport>('/manager/reports/assessment', { query, schema: AssessmentReportSchema, signal }),
  sendNudge: (body: { studySeqs: number[]; message: string }) => api.post<NudgeResult>('/manager/nudge/send', body, { schema: NudgeResultSchema }),
};

/** File endpoints of /manager/* (xlsx / csv / html / pdf). */
export const MANAGER_FILE = {
  traineesXlsx: '/manager/trainees/export.xlsx',
  reportCsv: '/manager/reports/education-results/export.csv',
  reportHtml: '/manager/reports/education-results/export.html',
  certificatesPdf: '/manager/certificates/pdf',
} as const;

/**
 * GETs a manager file with the learner bearer token (refresh once on 401) and returns blob + Content-Disposition. Error bodies
 * ({error:{message}}) become AppError so the PHP alert texts ("출력내용이 없습니다." …) reach the toast.
 */
export async function fetchManagerFile(path: string, query: Q): Promise<{ blob: Blob; fileName: string | null; inline: boolean }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const go = () => fetch(url, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` }, credentials: 'include' });
  let res = await go();
  if (res.status === 401 && (await refreshAccessToken())) res = await go();
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } } = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    throw new AppError(body.error?.code ?? (res.status === 403 ? 'FORBIDDEN' : res.status === 404 ? 'NOT_FOUND' : 'INTERNAL'), body.error?.message ?? '파일을 내려받지 못했습니다.', res.status);
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

/** Downloads a manager file under its server file name. */
export async function downloadManagerFile(path: string, query: Q, fallbackName: string): Promise<void> {
  const f = await fetchManagerFile(path, query);
  saveBlob(f.blob, f.fileName ?? fallbackName);
}

/** Opens the 수료증 PDF (inline in the PHP) in a tab opened synchronously by the click handler; the tab is closed on errors. */
export async function openManagerPdf(path: string, query: Q, win?: Window | null): Promise<void> {
  try {
    const f = await fetchManagerFile(path, query);
    const pdf = f.blob.type === 'application/pdf' ? f.blob : new Blob([f.blob], { type: 'application/pdf' });
    if (win && !win.closed) { win.location.href = URL.createObjectURL(pdf); return; }
    saveBlob(pdf, f.fileName ?? 'certificate.pdf');
  } catch (err) { win?.close(); throw err; }
}
