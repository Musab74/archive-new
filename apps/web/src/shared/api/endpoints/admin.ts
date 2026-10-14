import { z } from 'zod';
import { AdminSessionSchema, type AdminSession } from '@ainex/contracts';
import { API_BASE, api, AppError, refreshAdminAccessToken } from '../client';
import { adminTokenStore } from '../../auth/adminTokenStore';
import {
  AbnormalPageSchema, AdminCategoriesSchema, CompanyCheckSchema, CompanyDetailSchema, CompanyImportResultSchema, CompanyMetaSchema, CompanyRowSchema, CompanyTermsSchema, AdminChapterRowSchema, AdminContentsDetailSchema, AdminCourseDetailSchema, AdminDashboardSchema, AdminFaqDetailSchema, AdminFaqRowSchema, AdminLoginResponseSchema, AdminNoticeDetailSchema, AdminNoticeRowSchema,
  CheatingRowSchema, ContentsRowSchema, CounselRowSchema, CourseRowSchema, CurationListSchema, DailyMonitorSchema, EmonDiagnosisSchema, EmonPendingSchema, EmonPreviewSchema, EmonSummarySchema, InquiryRowSchema, MemberDetailSchema, MemberRowSchema, OkResultSchema, OkSchema, OverlapMonitorSchema,
  ProgressLogPageSchema, SiteInfoSchema, StaffListSchema, StudyDetailSchema, StudyRowSchema, pageOf,
  type AbnormalPage, type AdminCategories, type CompanyCheck, type CompanyDetail, type CompanyImportResult, type CompanyMeta, type CompanyRow, type CompanyTerms, type AdminChapterRow, type AdminContentsDetail, type AdminCourseDetail, type AdminDashboard, type AdminFaqDetail, type AdminFaqRow, type AdminLoginResponse, type AdminNoticeDetail, type AdminNoticeRow, type CheatingRow, type ContentsRow, type CounselRow, type CourseRow,
  type CurationList, type DailyMonitor, type EmonDiagnosis, type EmonPending, type EmonPreview, type EmonSummary, type InquiryRow, type MemberDetail, type MemberRow, type OkResult, type OverlapMonitor, type ProgressLogPage, type SiteInfo, type StaffList, type StudyDetail, type StudyRow,
} from '../schemas';

export interface Page<T> { items: T[]; page: number; size: number; total: number }
type Q = Record<string, string | number | boolean | null | undefined>;

/** Staff session (/auth/admin/*): separate refresh cookie + in-memory token (adminTokenStore). */
export const adminAuthApi = {
  login: (body: { id: string; password: string; secondFactor?: string }) => api.post<AdminLoginResponse>('/auth/admin/login', { ...body, role: 'admin' }, { schema: AdminLoginResponseSchema, auth: false, noRefresh: true, tokenScope: 'admin' }),
  logout: () => api.post<{ ok: boolean }>('/auth/admin/logout', undefined, { schema: OkSchema, noRefresh: true, tokenScope: 'admin' }),
  me: (signal?: AbortSignal) => api.get<AdminSession>('/auth/admin/me', { schema: AdminSessionSchema, signal, tokenScope: 'admin' }),
};

export const EMON_TABLES = ['TB_USER_HIST_V2_ENC', 'TB_USER_LOGIN_HIST_V2', 'TB_COURSE_HIST_V2', 'TB_CLASS_HIST_V2', 'TB_CONTENTS_HIST_V2', 'TB_ATTEND_HIST_V2', 'TB_CSE_HIST_V2', 'TB_SCORE_HIST_V2', 'UserCertOTP'] as const;
export type EmonTable = (typeof EMON_TABLES)[number];
export type EmonJob = 'attend' | 'score' | 'cse' | 'contents';

/** /admin/* — all calls send the staff token (path-based scope in the client). */
export const adminApi = {
  dashboard: (signal?: AbortSignal) => api.get<AdminDashboard>('/admin/dashboard', { schema: AdminDashboardSchema, signal }),

  // 회원관리 (A1)
  members: (query: Q, signal?: AbortSignal) => api.get<Page<MemberRow>>('/admin/members', { query, schema: pageOf(MemberRowSchema), signal }),
  member: (id: string, signal?: AbortSignal) => api.get<MemberDetail>(`/admin/members/${encodeURIComponent(id)}`, { schema: MemberDetailSchema, signal }),
  patchMember: (id: string, body: Record<string, unknown>) => api.patch<OkResult>(`/admin/members/${encodeURIComponent(id)}`, body, { schema: OkResultSchema }),
  resetPassword: (id: string, password: string) => api.post<OkResult>(`/admin/members/${encodeURIComponent(id)}/password`, { password }, { schema: OkResultSchema }),

  // 사업주 관리 (A1)
  companies: (query: Q, signal?: AbortSignal) => api.get<Page<CompanyRow>>('/admin/companies', { query, schema: pageOf(CompanyRowSchema), signal }),
  companyMeta: (signal?: AbortSignal) => api.get<CompanyMeta>('/admin/companies/meta', { schema: CompanyMetaSchema, signal }),
  companyCheck: (field: 'CompanyCode' | 'CompanyID' | 'HomePage', value: string, excludeIdx?: number, signal?: AbortSignal) => api.get<CompanyCheck>('/admin/companies/check', { query: { field, value, excludeIdx }, schema: CompanyCheckSchema, signal }),
  company: (idx: number, signal?: AbortSignal) => api.get<CompanyDetail>(`/admin/companies/${idx}`, { schema: CompanyDetailSchema, signal }),
  companyTerms: (idx: number, year: number | 'all', signal?: AbortSignal) => api.get<CompanyTerms>(`/admin/companies/${idx}/terms`, { query: { year }, schema: CompanyTermsSchema, signal }),
  createCompany: (body: Record<string, unknown>) => api.post<OkResult>('/admin/companies', body, { schema: OkResultSchema }),
  patchCompany: (idx: number, body: Record<string, unknown>) => api.patch<OkResult>(`/admin/companies/${idx}`, body, { schema: OkResultSchema }),
  deleteCompany: (idx: number, force: boolean) => api.delete<OkResult>(`/admin/companies/${idx}`, { query: force ? { force: 1 } : {}, schema: OkResultSchema }),
  importCompanies: (body: { rows: Record<string, string | null>[]; mode: 'dryRun' | 'commit'; skipInvalid: boolean }) => api.post<CompanyImportResult>('/admin/companies/import', body, { schema: CompanyImportResultSchema }),
  /** Streams GET /admin/companies/export (text/csv) into a browser download. The JSON client cannot be used for files. */
  downloadCompaniesCsv: (query: Q) => downloadAdminFile('/admin/companies/export', query, 'companies.csv'),

  // 수강관리 (B1)
  studies: (query: Q, signal?: AbortSignal) => api.get<Page<StudyRow>>('/admin/studies', { query, schema: pageOf(StudyRowSchema), signal }),
  study: (seq: number, signal?: AbortSignal) => api.get<StudyDetail>(`/admin/studies/${seq}`, { schema: StudyDetailSchema, signal }),
  progressLog: (seq: number, cursor: number, size = 100, signal?: AbortSignal) => api.get<ProgressLogPage>(`/admin/studies/${seq}/progress-log`, { query: { cursor, size }, schema: ProgressLogPageSchema, signal }),
  monitoringDaily: (query: Q, signal?: AbortSignal) => api.get<DailyMonitor>('/admin/monitoring/daily', { query, schema: DailyMonitorSchema, signal }),
  monitoringOverlap: (query: Q, signal?: AbortSignal) => api.get<OverlapMonitor>('/admin/monitoring/overlap', { query, schema: OverlapMonitorSchema, signal }),
  monitoringAbnormal: (query: Q, signal?: AbortSignal) => api.get<AbnormalPage>('/admin/monitoring/abnormal', { query, schema: AbnormalPageSchema, signal }),

  // 컨텐츠관리 (D1)
  courses: (query: Q, signal?: AbortSignal) => api.get<Page<CourseRow>>('/admin/courses', { query, schema: pageOf(CourseRowSchema), signal }),
  course: (idx: number, signal?: AbortSignal) => api.get<AdminCourseDetail>(`/admin/courses/${idx}`, { schema: AdminCourseDetailSchema, signal }),
  patchCourse: (idx: number, body: Record<string, unknown>) => api.patch<OkResult>(`/admin/courses/${idx}`, body, { schema: OkResultSchema }),
  chapters: (lectureCode: string, signal?: AbortSignal) => api.get<AdminChapterRow[]>(`/admin/courses/${encodeURIComponent(lectureCode)}/chapters`, { schema: z.array(AdminChapterRowSchema), signal }),
  contents: (query: Q, signal?: AbortSignal) => api.get<Page<ContentsRow>>('/admin/contents', { query, schema: pageOf(ContentsRowSchema), signal }),
  content: (idx: number, signal?: AbortSignal) => api.get<AdminContentsDetail>(`/admin/contents/${idx}`, { schema: AdminContentsDetailSchema, signal }),
  patchContent: (idx: number, body: { ContentsTitle?: string; LectureTime?: number | null }) => api.patch<OkResult>(`/admin/contents/${idx}`, body, { schema: OkResultSchema }),
  categories: (signal?: AbortSignal) => api.get<AdminCategories>('/admin/categories', { schema: AdminCategoriesSchema, signal }),
  curationList: (gubun: string, signal?: AbortSignal) => api.get<CurationList>(`/admin/lists/${gubun}`, { schema: CurationListSchema, signal }),
  putCurationList: (gubun: string, lectureCodes: string[]) => api.put<OkResult>(`/admin/lists/${gubun}`, { lectureCodes }, { schema: OkResultSchema }),

  // 커뮤니티 (F1)
  notices: (query: Q, signal?: AbortSignal) => api.get<Page<AdminNoticeRow>>('/admin/notices', { query, schema: pageOf(AdminNoticeRowSchema), signal }),
  notice: (idx: number, signal?: AbortSignal) => api.get<AdminNoticeDetail>(`/admin/notices/${idx}`, { schema: AdminNoticeDetailSchema, signal }),
  createNotice: (body: { Title: string; Content?: string | null; UseYN: string; Notice: string }) => api.post<OkResult>('/admin/notices', body, { schema: OkResultSchema }),
  updateNotice: (idx: number, body: Partial<{ Title: string; Content: string | null; UseYN: string; Notice: string }>) => api.patch<OkResult>(`/admin/notices/${idx}`, body, { schema: OkResultSchema }),
  deleteNotice: (idx: number) => api.delete<OkResult>(`/admin/notices/${idx}`, { schema: OkResultSchema }),
  faqs: (query: Q, signal?: AbortSignal) => api.get<Page<AdminFaqRow>>('/admin/faqs', { query, schema: pageOf(AdminFaqRowSchema), signal }),
  faq: (idx: number, signal?: AbortSignal) => api.get<AdminFaqDetail>(`/admin/faqs/${idx}`, { schema: AdminFaqDetailSchema, signal }),
  createFaq: (body: { Category: string; Title: string; Content?: string | null; UseYN: string; OrderByNum: number }) => api.post<OkResult>('/admin/faqs', body, { schema: OkResultSchema }),
  updateFaq: (idx: number, body: Partial<{ Category: string; Title: string; Content: string | null; UseYN: string; OrderByNum: number }>) => api.patch<OkResult>(`/admin/faqs/${idx}`, body, { schema: OkResultSchema }),
  deleteFaq: (idx: number) => api.delete<OkResult>(`/admin/faqs/${idx}`, { schema: OkResultSchema }),
  inquiries: (query: Q, signal?: AbortSignal) => api.get<Page<InquiryRow>>('/admin/inquiries', { query, schema: pageOf(InquiryRowSchema), signal }),
  answerInquiry: (idx: number, Contents2: string) => api.patch<OkResult>(`/admin/inquiries/${idx}/answer`, { Contents2 }, { schema: OkResultSchema }),
  counsel: (query: Q, signal?: AbortSignal) => api.get<Page<CounselRow>>('/admin/counsel', { query, schema: pageOf(CounselRowSchema), signal }),
  answerCounsel: (idx: number, Contents2: string) => api.patch<OkResult>(`/admin/counsel/${idx}/answer`, { Contents2 }, { schema: OkResultSchema }),
  cheating: (query: Q, signal?: AbortSignal) => api.get<Page<CheatingRow>>('/admin/cheating', { query, schema: pageOf(CheatingRowSchema), signal }),

  // 사이트관리 (G1)
  siteInfo: (signal?: AbortSignal) => api.get<SiteInfo>('/admin/site-info', { schema: SiteInfoSchema, signal }),
  putSiteInfo: (body: Record<string, string | null>) => api.put<OkResult>('/admin/site-info', body, { schema: OkResultSchema }),
  staff: (signal?: AbortSignal) => api.get<StaffList>('/admin/staff', { schema: StaffListSchema, signal }),

  // EMON 모니터 (B1) — read-only, never sends anything
  emonSummary: (signal?: AbortSignal) => api.get<EmonSummary>('/admin/emon/summary', { schema: EmonSummarySchema, signal }),
  emonPending: (table: EmonTable, page: number, size = 20, signal?: AbortSignal) => api.get<EmonPending>('/admin/emon/pending', { query: { table, page, size }, schema: EmonPendingSchema, signal }),
  emonDiagnosis: (query: { id: string; course?: string; termeIdx?: number }, signal?: AbortSignal) => api.get<EmonDiagnosis>('/admin/emon/diagnosis', { query: { ...query }, schema: EmonDiagnosisSchema, signal }),
  emonPreview: (job: EmonJob, query: { n?: number; id?: string; course?: string }, signal?: AbortSignal) => api.get<EmonPreview>(`/admin/emon/preview/${job}`, { query: { ...query }, schema: EmonPreviewSchema, signal }),
};

/** Fetch a file endpoint with the staff token (one refresh+retry on 401) and hand it to the browser as a download. */
export async function downloadAdminFile(path: string, query: Q, fallbackName: string): Promise<void> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const go = () => fetch(url, { headers: { Authorization: `Bearer ${adminTokenStore.get() ?? ''}` }, credentials: 'include' });
  let res = await go();
  if (res.status === 401 && (await refreshAdminAccessToken())) res = await go();
  if (!res.ok) throw new AppError(res.status === 403 ? 'FORBIDDEN' : 'INTERNAL', res.status === 403 ? '권한이 없습니다.' : '파일을 내려받지 못했습니다.', res.status);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(cd)?.[1];
  const name = star ? decodeURIComponent(star) : plain ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
