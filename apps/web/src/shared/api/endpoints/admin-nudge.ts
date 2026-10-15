import { z } from 'zod';
import { api, request } from '../client';
import { pageOf } from '../schemas';
import { downloadAdminFile } from './admin';

type Q = Record<string, string | number | boolean | null | undefined>;
type Page<T> = { items: T[]; page: number; size: number; total: number };
const S = z.string().nullable().optional();

// 학습참여독려 (study_sms.php)
export const NudgeMetaSchema = z.object({
  salesManagers: z.array(z.object({ id: z.string(), name: z.string().nullable(), team: S })),
  salesTeams: z.array(z.string()),
  courses: z.array(z.object({ lectureCode: z.string(), contentsName: z.string().nullable() })),
  modes: z.array(z.object({ mode: z.string(), label: z.string(), templateIdx: z.number().nullable(), templateCode: z.string(), hasTemplate: z.boolean() })),
  years: z.array(z.number()), bulkMax: z.number(), sendConfigured: z.boolean(),
});
export type NudgeMeta = z.infer<typeof NudgeMetaSchema>;
export const TermListSchema = z.object({ items: z.array(z.object({ period: z.string(), start: z.string(), end: z.string() })) });
export const CompanyOptionListSchema = z.object({ items: z.array(z.object({ companyCode: z.string(), companyName: z.string() })) });
export const NudgeTargetSchema = z.object({
  seq: z.number(), serviceType: S, serviceTypeLabel: z.string(), id: z.string(), name: S, depart: S, eduManager: z.boolean(), lectureCode: z.string(), courseName: z.string(), lectureStart: z.string(), lectureEnd: z.string(), tutorLimit: z.string().nullable(),
  progress: z.number(), passOk: S, passLabel: z.string(), studyEnd: S, certCount: z.number(), certDate: S, companyCode: S, companyName: S, salesName: S, salesTeam: S, tutorName: S, openChapter: z.union([z.number(), z.string()]).nullable().optional(), pre: z.string(), post: z.string(),
  companyIdx: z.number().nullable().optional(), preSubmitted: z.boolean().optional(),
});
export type NudgeTarget = z.infer<typeof NudgeTargetSchema>;
export const NudgePreviewSchema = z.object({
  seq: z.number(), id: z.string(), name: S, companyName: S, courseName: S, lectureStart: z.string(), lectureEnd: z.string(), mobile: S, email: S, hasMobile: z.boolean(), hasEmail: z.boolean(), companySendSMS: S,
  mode: z.string(), modeLabel: z.string(), templateFound: z.boolean(), templateCode: z.string(), message: z.string(), templateMessage: z.string(), emailSubject: z.string(), sendConfigured: z.boolean(),
});
export type NudgePreview = z.infer<typeof NudgePreviewSchema>;
export const SendItemSchema = z.object({ seq: z.number(), id: S, name: S, channel: z.string(), status: z.string(), label: z.string(), logIdx: z.number().nullable(), ok: z.boolean(), code: z.string().optional().nullable() });
export type SendItem = z.infer<typeof SendItemSchema>;
export const SendOneSchema = SendItemSchema.extend({ notConfigured: z.boolean() });
export const SendBatchSchema = z.object({ ok: z.boolean(), code: z.string(), mode: z.string(), sendMode: z.string(), requested: z.number(), logged: z.number(), sent: z.number(), items: z.array(SendItemSchema) });
export type SendBatch = z.infer<typeof SendBatchSchema>;

// 예약문자발송 (study_sms_res_list.php)
export const ReservationRowSchema = z.object({ idx: z.number(), resDate: S, companyName: S, name: S, id: S, mobile: S, studySeq: z.number().nullable(), message: S, inputId: S, regDate: S });
export type ReservationRow = z.infer<typeof ReservationRowSchema>;
export const ReservationCreateResultSchema = z.object({ ok: z.boolean(), created: z.number(), skipped: z.array(z.number()), resDate: z.string() });

// 알림발송내역 (study_alarm_log.php)
export const AlarmRowSchema = z.object({ key: z.string(), idx: z.number(), sendType: z.string(), typeLabel: z.string(), category: z.string(), templateCode: z.string(), id: S, name: S, mobile: S, message: S, regDate: S, status: z.string(), code: z.string(), apiCode: z.string(), apiMessage: z.string(), mid: z.string(), batchKey: z.string(), companyName: S });
export type AlarmRow = z.infer<typeof AlarmRowSchema>;
export const AlarmLogSchema = pageOf(AlarmRowSchema).extend({
  from: z.string(), to: z.string(), sendType: z.string(), category: z.string(), result: z.string(),
  counts: z.object({ total: z.number(), ok: z.number(), fail: z.number(), unknown: z.number(), reasons: z.record(z.string(), z.number()) }),
  resultFilters: z.array(z.object({ value: z.string(), label: z.string(), group: z.string(), count: z.number() })), kakaoTableAvailable: z.boolean(),
});
export type AlarmLog = z.infer<typeof AlarmLogSchema>;

// 메일발송내역 (study_email_log*.php)
export const ManagerMailRowSchema = z.object({ idx: z.number(), companyCode: S, logCompanyCode: S.optional(), companyIdx: z.number().nullable().optional(), companyName: z.string(), eduManager: S, email: S, title: S, message: S, messageText: z.string(), regDate: S, reciveDate: S, code: S, status: z.string(), inputId: S });
export type ManagerMailRow = z.infer<typeof ManagerMailRowSchema>;
export const MailRowSchema = ManagerMailRowSchema.extend({ id: S, name: S, studySeq: z.number().nullable() });
export type MailRow = z.infer<typeof MailRowSchema>;

// 문자/템플릿관리 (smsdata.php)
export const TemplateRowSchema = z.object({ idx: z.number(), messageMode: z.string(), modeLabel: z.string(), templateCode: z.string(), message: S, templateMessage: S, emTitle: S, regDate: S, aligoStatus: z.string().nullable() });
export type TemplateRow = z.infer<typeof TemplateRowSchema>;
export const TemplateListSchema = pageOf(TemplateRowSchema).extend({ variables: z.array(z.object({ key: z.string(), label: z.string(), example: z.string() })), modes: z.array(z.object({ mode: z.string(), label: z.string() })) });
export type TemplateList = z.infer<typeof TemplateListSchema>;

// MemberInfo / CompanyInfo popups (member_info_pop.php, company_info_pop.php)
const CompanyCardSchema = z.object({
  idx: z.number().nullable(), companyScale: z.string(), companyScaleLabel: z.string(), companyName: z.string(), companyCode: z.string(), hrd: z.string(), companyId: z.string(), ceo: z.string(), tel: z.string(), tel2: z.string(), csEnabled: z.boolean(),
  uptae: z.string(), upjong: z.string(), fax: z.string(), fax2: z.string(), zipcode: z.string(), address01: z.string(), address02: z.string(), bankName: z.string(), bankNumber: z.string(), email: z.string(), homePage: z.string(),
  eduManager: z.string(), eduManagerPhone: z.string(), eduManagerEmail: z.string(), salesManager: z.string(), salesName: z.string(), remark: z.string(), cyberUrl: z.string(), cyberEnabled: z.boolean(), sendSms: z.string(), sendSmsLabel: z.string(), salesDeptName: z.string(),
});
export type NudgeCompanyCard = z.infer<typeof CompanyCardSchema>;
export const NudgeMemberInfoSchema = z.object({
  profile: z.object({
    id: z.string(), name: S, useYN: z.string(), unused: z.boolean(), gender: z.string(), genderLabel: z.string(), email: S, tel: S, mobile: S, birthDay: S, hasEmail: z.boolean(), hasTel: z.boolean(), hasMobile: z.boolean(), hasBirthDay: z.boolean(),
    nameEng: z.string(), zipcode: z.string(), address01: z.string(), address02: z.string(), depart: z.string(), position: z.string(), etc01: z.string(), etc02: z.string(), mailling: z.string(), acs: z.string(), regDate: S,
    eduManager: z.string(), protectId: z.string(), marketing: z.string(), marketingLabel: z.string(), cardName: z.string(), cardNumber: z.string(), companyCode: z.string(), masked: z.boolean(),
  }),
  company: CompanyCardSchema.nullable(),
  loginHistory: z.array(z.object({ no: z.number(), regDate: S, ip: S, device: S, userAgent: z.string(), browser: z.string() })),
  certHistory: z.array(z.object({ no: z.number(), contentsName: z.string(), regDate: S })),
  inquiries: z.array(z.object({ no: z.number(), idx: z.number(), category: z.string(), categoryLabel: z.string(), name: S, title: S, regDate: S, status: z.string(), statusLabel: z.string() })),
});
export type NudgeMemberInfo = z.infer<typeof NudgeMemberInfoSchema>;
export const NudgeCompanyInfoSchema = z.object({
  company: CompanyCardSchema,
  studies: z.array(z.object({ no: z.number(), lectureCode: z.string(), contentsName: z.string(), lectureStart: z.string(), lectureEnd: z.string(), studyCount: z.number(), passCount: z.number(), passRatio: z.number(), price: z.number(), rPrice: z.number() })),
  members: z.array(z.object({ no: z.number(), id: z.string(), name: S, birthDay: S, genderLabel: z.string(), email: S, mobile: S, depart: z.string(), position: z.string(), lastLogin: S, regDate: S, useYNLabel: z.string() })),
});
export type NudgeCompanyInfo = z.infer<typeof NudgeCompanyInfoSchema>;
export const NudgeRevealSchema = z.object({ field: z.string(), label: z.string(), value: z.string() });
export type RevealField = 'BirthDay' | 'Email' | 'Tel' | 'Mobile';

/** 독려 관리 (menu C) — /admin/nudge/* (AdminNudgeController). */
export const adminNudgeApi = {
  // C1 학습참여독려
  meta: (signal?: AbortSignal) => api.get<NudgeMeta>('/admin/nudge/meta', { schema: NudgeMetaSchema, signal }),
  terms: (query: Q, signal?: AbortSignal) => api.get<z.infer<typeof TermListSchema>>('/admin/nudge/terms', { query, schema: TermListSchema, signal }),
  termCompanies: (query: Q, signal?: AbortSignal) => api.get<z.infer<typeof CompanyOptionListSchema>>('/admin/nudge/term-companies', { query, schema: CompanyOptionListSchema, signal }),
  companySearch: (q: string, signal?: AbortSignal) => api.get<z.infer<typeof CompanyOptionListSchema>>('/admin/nudge/companies', { query: { q }, schema: CompanyOptionListSchema, signal }),
  targets: (query: Q, signal?: AbortSignal) => api.get<Page<NudgeTarget>>('/admin/nudge/targets', { query, schema: pageOf(NudgeTargetSchema), signal }),
  preview: (seq: number, mode: string, signal?: AbortSignal) => api.get<NudgePreview>(`/admin/nudge/targets/${seq}/preview`, { query: { mode }, schema: NudgePreviewSchema, signal }),
  sendOne: (seq: number, body: { mode: string; sendMode: 'sms' | 'email'; message?: string }) => api.post<z.infer<typeof SendOneSchema>>(`/admin/nudge/targets/${seq}/send`, body, { schema: SendOneSchema }),
  sendBatch: (body: { seqs: number[]; mode: string; sendMode: 'sms' | 'email' }) => api.post<SendBatch>('/admin/nudge/send', body, { schema: SendBatchSchema }),
  // C1 예약문자발송
  reservations: (query: Q, signal?: AbortSignal) => api.get<Page<ReservationRow>>('/admin/nudge/reservations', { query, schema: pageOf(ReservationRowSchema), signal }),
  downloadReservationsCsv: (query: Q) => downloadAdminFile('/admin/nudge/reservations/export', query, 'sms_reservations.csv'),
  createReservations: (body: { seqs: number[]; resDate: string; resHour: number; message: string }) => api.post<z.infer<typeof ReservationCreateResultSchema>>('/admin/nudge/reservations', body, { schema: ReservationCreateResultSchema }),
  deleteReservations: (idxs: number[]) => request<{ ok: boolean; deleted: number; requested: number }>('/admin/nudge/reservations', { method: 'DELETE', body: { idxs } }),
  // C2 알림발송내역
  alarmLog: (query: Q, signal?: AbortSignal) => api.get<AlarmLog>('/admin/nudge/alarm-log', { query, schema: AlarmLogSchema, signal }),
  downloadAlarmLogCsv: (query: Q) => downloadAdminFile('/admin/nudge/alarm-log/export', query, 'alarm_log.csv'),
  // C3 / C4 메일발송내역
  managerMailLog: (query: Q, signal?: AbortSignal) => api.get<Page<ManagerMailRow>>('/admin/nudge/manager-mail-log', { query, schema: pageOf(ManagerMailRowSchema), signal }),
  mailLog: (query: Q, signal?: AbortSignal) => api.get<Page<MailRow>>('/admin/nudge/mail-log', { query, schema: pageOf(MailRowSchema), signal }),
  downloadMailLogCsv: (query: Q) => downloadAdminFile('/admin/nudge/mail-log/export', query, 'mail_log.csv'),
  // MemberInfo / CompanyInfo popups (any C grant)
  memberInfo: (id: string, signal?: AbortSignal) => api.get<NudgeMemberInfo>(`/admin/nudge/member-info/${encodeURIComponent(id)}`, { schema: NudgeMemberInfoSchema, signal }),
  revealMember: (id: string, body: { field: RevealField; gubun: string; reason: string; url?: string }) => api.post<z.infer<typeof NudgeRevealSchema>>(`/admin/nudge/member-info/${encodeURIComponent(id)}/reveal`, body, { schema: NudgeRevealSchema }),
  companyInfo: (code: string, signal?: AbortSignal) => api.get<NudgeCompanyInfo>(`/admin/nudge/company-info/${encodeURIComponent(code)}`, { schema: NudgeCompanyInfoSchema, signal }),
  // C5 문자/템플릿관리
  templates: (query: Q, signal?: AbortSignal) => api.get<TemplateList>('/admin/nudge/templates', { query, schema: TemplateListSchema, signal }),
  template: (idx: number, signal?: AbortSignal) => api.get<TemplateRow>(`/admin/nudge/templates/${idx}`, { schema: TemplateRowSchema, signal }),
  createTemplate: (body: { MessageMode: string; TemplateCode: string; TemplateMessage: string }) => api.post<{ ok: boolean; idx: number }>('/admin/nudge/templates', body),
  patchTemplate: (idx: number, body: Partial<{ MessageMode: string; TemplateCode: string; TemplateMessage: string }>) => api.patch<{ ok: boolean; updated: number }>(`/admin/nudge/templates/${idx}`, body),
  deleteTemplate: (idx: number) => api.delete<{ ok: boolean; deleted: number }>(`/admin/nudge/templates/${idx}`),
};
