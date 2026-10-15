import { z } from 'zod';
import { api } from '../client';
import { pageOf } from '../schemas';
import { downloadAdminFile } from './admin';

/**
 * /admin/* for the hrd_manager parity screens: 공지사항(F1), 자주 묻는 질문(F2), 1:1 상담/학습상담(F3), 부정제보(F6),
 * 수강신청관리(E7), 사이트 정보 관리(G1) and the dashboard (main.php blocks).
 */
type Q = Record<string, string | number | boolean | null | undefined>;
export interface Page<T> { items: T[]; page: number; size: number; total: number }

const nstr = z.string().nullable().optional();
const nnum = z.number().nullable().optional();
const opt = z.object({ value: z.string(), label: z.string() });
export const OkSchema = z.object({ ok: z.boolean() }).passthrough();
export type Ok = z.infer<typeof OkSchema>;
export const SlotFileSchema = z.object({ slot: z.number(), fileName: z.string(), realFileName: z.string() });
export type SlotFile = z.infer<typeof SlotFileSchema>;

// 공지사항
export const NoticeRowSchema = z.object({ idx: z.number(), useYN: nstr, useLabel: z.string().default(''), pinned: z.boolean(), title: z.string(), views: z.number(), regDate: nstr, hasFile: z.boolean(), realFileName1: nstr, fileCount: z.number().default(0) });
export type NoticeRow = z.infer<typeof NoticeRowSchema>;
export const NoticePageSchema = pageOf(NoticeRowSchema).extend({ pinned: z.array(NoticeRowSchema).default([]) });
export const NoticeDetailSchema = NoticeRowSchema.extend({ content: nstr, files: z.array(z.object({ slot: z.number(), fileName: z.string(), realFileName: z.string() }).passthrough()).default([]), uploadEnabled: z.boolean().default(false) });
export type NoticeDetail = z.infer<typeof NoticeDetailSchema>;

// FAQ
export const FaqRowSchema = z.object({ idx: z.number(), order: z.number(), category: nstr, categoryLabel: z.string().default(''), title: z.string(), useYN: nstr, useLabel: z.string().default(''), regDate: nstr });
export type FaqRow = z.infer<typeof FaqRowSchema>;
export const FaqDetailSchema = FaqRowSchema.extend({ content: nstr });
export type FaqDetail = z.infer<typeof FaqDetailSchema>;
export const FaqMetaSchema = z.object({ categories: z.array(opt), nextOrder: z.number() });

// 수강신청관리
export const InquiryRowSchema = z.object({
  idx: z.number(), serviceType: nstr, serviceTypeLabel: z.string().default(''), companyName: nstr, name: nstr, phone: nstr, email: nstr, personnel: nstr.or(nnum), contents: nstr, agreeYN: nstr,
  regDate: nstr, status: nstr, statusLabel: z.string().default(''), answer: z.object({ name: nstr, contents: nstr, regDate: nstr, mdfDate: nstr }),
});
export type InquiryRow = z.infer<typeof InquiryRowSchema>;
export const InquiryDetailSchema = InquiryRowSchema.extend({ statuses: z.array(opt).default([]) });
export type InquiryDetail = z.infer<typeof InquiryDetailSchema>;

// 1:1 상담
export const CounselRowSchema = z.object({
  idx: z.number(), id: nstr, name: nstr, category: nstr, categoryLabel: z.string().default(''), title: nstr, regDate: nstr, regDate2: z.string().default('-'), status: nstr, statusLabel: z.string().default(''), answered: z.boolean(),
  mobile: nstr, email: nstr, lectureCode: nstr,
});
export type CounselRow = z.infer<typeof CounselRowSchema>;
export const CounselMetaSchema = z.object({ categories: z.array(opt), statuses: z.array(opt), revealGubun: z.array(z.string()), uploadEnabled: z.boolean() });
export type CounselMeta = z.infer<typeof CounselMetaSchema>;
export const CounselDetailSchema = z.object({
  idx: z.number(), lectureCode: nstr, courseName: nstr, contentsTitle: nstr, studySeq: nnum, contentsIdx: nnum, title: nstr, name: nstr, id: nstr, category: nstr, categoryLabel: z.string().default(''),
  mobile: nstr, email: nstr, hasMobile: z.boolean(), hasEmail: z.boolean(), regDate: nstr, regDate2: z.string(), contents: nstr,
  studentFile: z.object({ fileName: z.string(), realFileName: z.string() }).nullable(), status: nstr, statusLabel: z.string().default(''), name2: nstr, contents2: nstr,
  files: z.array(SlotFileSchema), uploadEnabled: z.boolean(),
});
export type CounselDetail = z.infer<typeof CounselDetailSchema>;
export const RevealSchema = z.object({ ok: z.boolean(), field: z.enum(['Mobile', 'Email']), label: z.string(), value: z.string() });
export const CounselAnswerSchema = z.object({
  ok: z.boolean(), status: z.string(), answerDateSet: z.boolean(),
  notify: z.object({ attempted: z.boolean(), ok: z.boolean(), code: z.string(), logIdx: z.number().nullable(), message: z.string() }).nullable(),
});
export type CounselAnswer = z.infer<typeof CounselAnswerSchema>;

// 부정제보
export const CheatingRowSchema = z.object({ idx: z.number(), name: nstr, category: nstr, categoryLabel: z.string().default(''), mobile: nstr, email: nstr, title: nstr, contents: nstr, regDate: nstr, status: nstr, statusLabel: z.string().default(''), answeredBy: nstr, answeredAt: nstr });
export type CheatingRow = z.infer<typeof CheatingRowSchema>;
export const CheatingDetailSchema = CheatingRowSchema.extend({ statuses: z.array(opt).default([]) });
export type CheatingDetail = z.infer<typeof CheatingDetailSchema>;

// 사이트 정보
export const SiteInfoSchema = z.object({ idx: z.number(), companyName: nstr, ceo: nstr, companyNumber: nstr, salesReportNumber: nstr, phone: nstr, fax: nstr, email: nstr, personalInformationManager: nstr, address: nstr, copyright: nstr, kakaoUrl: nstr, regDate: nstr }).nullable();
export type SiteInfo = z.infer<typeof SiteInfoSchema>;
export const SiteInfoSaveSchema = z.object({ ok: z.boolean(), updated: z.number(), fields: z.array(z.string()).default([]), unchanged: z.boolean().optional(), idx: z.number().nullable().optional(), previousIdx: z.number().nullable().optional() });

// 대시보드 (existing tiles + main.php blocks; new fields optional so older API builds still parse)
const optNum = z.number().nullable().optional();
export const DashboardSchema = z.object({
  today: z.string(), monthStart: z.string(), logins: z.object({ today: optNum, uniqueUsers: optNum }), activePlayers: z.object({ count: optNum, freshnessSeconds: z.number() }), learnersOver15hThisMonth: optNum, activeEnrollments: optNum,
  emon: z.object({ pending: optNum, pendingStale: optNum }), support: z.object({ openInquiries: optNum, openCounsel: optNum, openCheating: optNum }), signupsToday: optNum,
  welcome: z.object({ id: z.string(), name: nstr, deptName: nstr, loginAt: nstr, clientIp: nstr, serverIp: nstr, team: nstr, greeting: nstr }).nullable().optional(),
  rubyShortcuts: z.boolean().optional(),
  siteName: nstr, siteAddress: nstr, browserTitle: nstr,
});
export type Dashboard = z.infer<typeof DashboardSchema>;

/** GET /admin/dashboard/chrome — include_top.php greeting / <title> and include_bottom.php footer values. */
export const AdminChromeSchema = z.object({
  id: z.string(), name: nstr, dept: nstr, deptName: nstr, team: nstr, greeting: z.string(), serverIp: nstr, siteName: z.string(), siteAddress: nstr, browserTitle: z.string(),
});
export type AdminChrome = z.infer<typeof AdminChromeSchema>;

export const EditorPhotoSchema = z.object({ ok: z.boolean(), fileName: z.string(), url: z.string(), html: z.string() });
export type EditorPhoto = z.infer<typeof EditorPhotoSchema>;

const formOf = (file: File) => { const fd = new FormData(); fd.append('file', file, file.name); return fd; };

export const adminSupportParityApi = {
  // 공지사항 F1
  notices: (query: Q, signal?: AbortSignal) => api.get<z.infer<typeof NoticePageSchema>>('/admin/notices', { query, schema: NoticePageSchema, signal }),
  notice: (idx: number, signal?: AbortSignal) => api.get<NoticeDetail>(`/admin/notices/${idx}`, { schema: NoticeDetailSchema, signal }),
  createNotice: (body: { Title: string; Content: string; UseYN: string; Notice: string }) => api.post<Ok & { idx: number }>('/admin/notices', body, { schema: OkSchema.extend({ idx: z.number() }) }),
  updateNotice: (idx: number, body: Partial<{ Title: string; Content: string; UseYN: string; Notice: string; clearFiles: number[] }>) => api.patch<Ok>(`/admin/notices/${idx}`, body, { schema: OkSchema }),
  deleteNotice: (idx: number) => api.delete<Ok>(`/admin/notices/${idx}`, { schema: OkSchema }),
  uploadNoticeFile: (idx: number, slot: number, file: File) => api.post<Ok>(`/admin/notices/${idx}/files/${slot}`, formOf(file), { schema: OkSchema }),
  downloadNoticeFile: (idx: number, slot: number, name: string) => downloadAdminFile(`/admin/notices/${idx}/files/${slot}`, {}, name),

  // FAQ F2
  faqs: (query: Q, signal?: AbortSignal) => api.get<Page<FaqRow>>('/admin/faqs', { query, schema: pageOf(FaqRowSchema), signal }),
  faqMeta: (signal?: AbortSignal) => api.get<z.infer<typeof FaqMetaSchema>>('/admin/faqs/meta', { schema: FaqMetaSchema, signal }),
  faq: (idx: number, signal?: AbortSignal) => api.get<FaqDetail>(`/admin/faqs/${idx}`, { schema: FaqDetailSchema, signal }),
  createFaq: (body: { Category: string; Title: string; Content: string; UseYN: string; OrderByNum: number }) => api.post<Ok & { idx: number }>('/admin/faqs', body, { schema: OkSchema.extend({ idx: z.number() }) }),
  updateFaq: (idx: number, body: { Category: string; Title: string; Content: string; UseYN: string; OrderByNum: number }) => api.patch<Ok>(`/admin/faqs/${idx}`, body, { schema: OkSchema }),
  deleteFaq: (idx: number) => api.delete<Ok>(`/admin/faqs/${idx}`, { schema: OkSchema }),

  // 수강신청관리 E7
  inquiries: (query: Q, signal?: AbortSignal) => api.get<Page<InquiryRow>>('/admin/inquiries', { query, schema: pageOf(InquiryRowSchema), signal }),
  inquiry: (idx: number, signal?: AbortSignal) => api.get<InquiryDetail>(`/admin/inquiries/${idx}`, { schema: InquiryDetailSchema, signal }),
  answerInquiry: (idx: number, body: { Contents2: string; Status: 'A' | 'B'; Name2?: string }) => api.patch<Ok>(`/admin/inquiries/${idx}/answer`, body, { schema: OkSchema }),
  deleteInquiry: (idx: number) => api.delete<Ok>(`/admin/inquiries/${idx}`, { schema: OkSchema }),

  // 1:1 상담 F3
  counsel: (query: Q, signal?: AbortSignal) => api.get<Page<CounselRow>>('/admin/counsel', { query, schema: pageOf(CounselRowSchema), signal }),
  counselMeta: (signal?: AbortSignal) => api.get<CounselMeta>('/admin/counsel/meta', { schema: CounselMetaSchema, signal }),
  counselDetail: (idx: number, signal?: AbortSignal) => api.get<CounselDetail>(`/admin/counsel/${idx}`, { schema: CounselDetailSchema, signal }),
  revealCounsel: (idx: number, body: { field: 'Mobile' | 'Email'; gubun: string; reason: string }) => api.post<z.infer<typeof RevealSchema>>(`/admin/counsel/${idx}/reveal`, body, { schema: RevealSchema }),
  answerCounsel: (idx: number, body: { Contents2: string; Status: 'A' | 'B'; Name2: string; clearFiles?: number[] }) => api.patch<CounselAnswer>(`/admin/counsel/${idx}/answer`, body, { schema: CounselAnswerSchema }),
  deleteCounsel: (idx: number) => api.delete<Ok>(`/admin/counsel/${idx}`, { schema: OkSchema }),
  uploadCounselFile: (idx: number, slot: number, file: File) => api.post<Ok>(`/admin/counsel/${idx}/files/${slot}`, formOf(file), { schema: OkSchema }),
  downloadCounselFile: (idx: number, slot: number | 'student', name: string) => downloadAdminFile(`/admin/counsel/${idx}/files/${slot}`, {}, name),
  /** qna_excel.php: 1대1문의_YYYYMMDD.xlsx (the server sends the name). */
  downloadCounselXlsx: (query: Q) => downloadAdminFile('/admin/counsel/export', query, '1대1문의.xlsx'),
  /** The same rows as CSV (format=csv). */
  downloadCounselCsv: (query: Q) => downloadAdminFile('/admin/counsel/export', { ...query, format: 'csv' }, '1대1문의.csv'),

  // 부정제보 F6
  cheating: (query: Q, signal?: AbortSignal) => api.get<Page<CheatingRow>>('/admin/cheating', { query, schema: pageOf(CheatingRowSchema), signal }),
  cheatingDetail: (idx: number, signal?: AbortSignal) => api.get<CheatingDetail>(`/admin/cheating/${idx}`, { schema: CheatingDetailSchema, signal }),
  setCheatingStatus: (idx: number, body: { Status: 'A' | 'B'; Name2: string }) => api.patch<Ok>(`/admin/cheating/${idx}/status`, body, { schema: OkSchema }),
  deleteCheating: (idx: number) => api.delete<Ok>(`/admin/cheating/${idx}`, { schema: OkSchema }),

  // 사이트 정보 G1
  siteInfo: (signal?: AbortSignal) => api.get<SiteInfo>('/admin/site-info', { schema: SiteInfoSchema, signal }),
  saveSiteInfo: (body: Record<string, string | null>) => api.put<z.infer<typeof SiteInfoSaveSchema>>('/admin/site-info', body, { schema: SiteInfoSaveSchema }),

  // 대시보드
  dashboard: (signal?: AbortSignal) => api.get<Dashboard>('/admin/dashboard', { schema: DashboardSchema, signal }),
  /** SmartEditor2 사진 (photo_uploader file_uploader.php): stores upload/webedit/<Ym>/<YmdHis>.<ext>; returns the <img> tag to insert. */
  uploadEditorPhoto: (file: File) => api.post<EditorPhoto>('/admin/support/editor-photo', formOf(file), { schema: EditorPhotoSchema }),
  chrome: (signal?: AbortSignal) => api.get<AdminChrome>('/admin/dashboard/chrome', { schema: AdminChromeSchema, signal }),
};

/** include/include_function.php arrays, used as fallbacks while the meta endpoints load. */
export const FAQ_CATEGORIES = [{ value: 'A', label: '일반' }, { value: 'B', label: '동영상' }, { value: 'C', label: '학습진도' }, { value: 'D', label: '로그인' }, { value: 'E', label: '기타문의' }];
export const COUNSEL_CATEGORIES = [{ value: 'A', label: '학습 내용 문의' }, { value: 'B', label: '시스템 문의' }, { value: 'C', label: '이의 제기' }, { value: 'D', label: '수강 관련 문의' }, { value: 'E', label: '결제 관련 문의' }];
export const SUPPORT_STATUSES: { value: 'A' | 'B'; label: string }[] = [{ value: 'A', label: '대기' }, { value: 'B', label: '완료' }];
export const REVEAL_GUBUN = ['학습자 관리', '학습자 요청', '기타 상담'];
