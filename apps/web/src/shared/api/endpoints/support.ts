import { z } from 'zod';
import { CheatingReportCreateSchema, InquiryCreateSchema } from '@ainex/contracts';
import { API_BASE, AppError, api, refreshAccessToken } from '../client';
import { tokenStore } from '../../auth/tokenStore';
import { pageOf } from '../schemas';

/**
 * 학습지원센터 (/v1/support/*): 공지사항, FAQ, 1:1 문의 + 답변, 기업교육상담(비회원), 부정행위 제보, 학습자료실 + 찜,
 * 아카이빙(기업자체콘텐츠 등록 요청), 보안코드, 라이브 입장. Attachment `url`s are API paths (relative to /v1).
 */
const nstr = z.string().nullable().optional().transform((v) => v ?? null);
const Option = z.object({ value: z.string(), label: z.string() });
const AttachmentSchema = z.object({ slot: z.number().int(), name: z.string(), url: z.string() });
export type SupportAttachment = z.infer<typeof AttachmentSchema>;

export const NoticeRowSchema = z.object({ idx: z.number().int(), no: z.number().int().optional(), title: z.string(), pinned: z.boolean().optional(), viewCount: z.number().int().optional(), regDate: nstr, hasAttachment: z.boolean().optional() });
export type NoticeRow = z.infer<typeof NoticeRowSchema>;
export const NoticeDetailSchema = z.object({ idx: z.number().int(), title: z.string(), content: z.string().default(''), pinned: z.boolean().optional(), viewCount: z.number().int().optional(), regDate: nstr, attachments: z.array(AttachmentSchema).default([]) });
export type NoticeDetail = z.infer<typeof NoticeDetailSchema>;
export interface NoticePage { items: NoticeRow[]; page: number; size: number; total: number }

export const FaqItemSchema = z.object({ idx: z.number().int(), no: z.number().int().optional(), category: z.string(), categoryName: z.string(), title: z.string(), content: z.string() });
export type FaqItem = z.infer<typeof FaqItemSchema>;
export const FaqPageSchema = pageOf(FaqItemSchema).extend({ categories: z.array(Option).default([]) });
export type FaqPage = z.infer<typeof FaqPageSchema>;

export const EduRowSchema = z.object({ idx: z.number().int(), no: z.number().int().optional(), title: z.string(), category: z.string(), categoryName: z.string(), viewCount: z.number().int().optional(), regDate: nstr, hasAttachment: z.boolean().optional() });
export type EduRow = z.infer<typeof EduRowSchema>;
export const EduPageSchema = pageOf(EduRowSchema).extend({ categories: z.array(Option).default([]) });
export type EduPage = z.infer<typeof EduPageSchema>;
export const EduDetailSchema = NoticeDetailSchema.extend({ category: z.string(), categoryName: z.string(), scrapped: z.boolean().default(false) });
export type EduDetail = z.infer<typeof EduDetailSchema>;
export const ScrapRowSchema = z.object({ idx: z.number().int(), title: z.string(), category: z.string(), categoryName: z.string(), regDate: nstr, scrappedAt: nstr, hasAttachment: z.boolean().optional() });
export type ScrapRow = z.infer<typeof ScrapRowSchema>;

export const CounselRowSchema = z.object({
  idx: z.number().int(), no: z.number().int().optional(), category: z.string(), categoryName: nstr, title: z.string(), status: z.string(), statusLabel: z.string(),
  answered: z.boolean(), regDate: nstr, answeredAt: nstr, lectureCode: nstr, studySeq: z.number().int().nullable().optional(),
});
export type CounselRow = z.infer<typeof CounselRowSchema>;
export const CounselDetailSchema = CounselRowSchema.omit({ no: true, answeredAt: true }).extend({
  contents: z.string(), courseName: nstr,
  studentFile: z.object({ name: z.string(), url: z.string() }).nullable().default(null),
  answer: z.object({ name: z.string(), contents: z.string(), regDate: nstr, attachments: z.array(AttachmentSchema).default([]) }).nullable().default(null),
});
export type CounselDetail = z.infer<typeof CounselDetailSchema>;
export const CounselOptionsSchema = z.object({
  categories: z.array(Option),
  enrollments: z.array(z.object({ studySeq: z.number().int(), lectureCode: z.string(), title: z.string(), lectureStart: nstr, lectureEnd: nstr })),
});
export type CounselOptions = z.infer<typeof CounselOptionsSchema>;

export const ArchivingRowSchema = z.object({ idx: z.number().int(), no: z.number().int().optional(), title: z.string(), regDate: nstr, status: z.string(), statusLabel: z.string(), fileType: z.string(), hasAnswer: z.boolean() });
export type ArchivingRow = z.infer<typeof ArchivingRowSchema>;
export const ArchivingDetailSchema = z.object({
  idx: z.number().int(), title: z.string(), contents: z.string(), regDate: nstr, status: z.string(), statusLabel: z.string(), fileName: nstr, fileType: z.string(), hasFile: z.boolean(),
  downloadUrl: nstr, answer: z.object({ name: z.string(), contents: z.string(), regDate: nstr }).nullable().default(null),
});
export type ArchivingDetail = z.infer<typeof ArchivingDetailSchema>;

export const CaptchaSchema = z.object({ token: z.string(), image: z.string(), width: z.number(), height: z.number(), expiresIn: z.number() });
export type Captcha = z.infer<typeof CaptchaSchema>;
export type CaptchaPurpose = 'inquiry' | 'counsel' | 'cheating';

const OkIdx = z.object({ ok: z.boolean(), idx: z.number().int().optional() });
const ScrapResult = z.object({ ok: z.boolean(), scrapped: z.boolean() });
export const InquiryResultSchema = OkIdx.extend({ notified: z.boolean().optional(), notifyCode: z.string().optional() });

export type InquiryCreate = z.input<typeof InquiryCreateSchema>;
export type CheatingCreate = z.input<typeof CheatingReportCreateSchema>;
export interface CounselCreate { category: string; title: string; contents: string; studySeq?: number; captchaToken: string; captchaCode: string; file?: File | null }
export interface ArchivingCreate { title: string; contents: string; file?: File | null }

type Q = Record<string, string | number | undefined>;

/** Public file (공지/학습자료): a plain link to the API route; the API answers with Content-Disposition: attachment. */
export const publicFileUrl = (path: string): string => `${API_BASE}${path}`;

/** Own file (1:1 문의, 아카이빙): fetched with the learner token and handed to the browser as a download. */
export async function downloadLearnerFile(path: string, fallbackName: string): Promise<void> {
  const go = () => fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` }, credentials: 'include' });
  let res = await go();
  if (res.status === 401 && (await refreshAccessToken())) res = await go();
  if (!res.ok) throw new AppError(res.status === 404 ? 'NOT_FOUND' : 'INTERNAL', res.status === 404 ? '파일이 존재하지 않습니다.' : '파일을 내려받지 못했습니다.', res.status);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const name = star ? decodeURIComponent(star) : fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function formOf(fields: Record<string, string | number | undefined>, file?: File | null): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) fd.set(k, String(v));
  if (file) fd.set('file', file, file.name);
  return fd;
}

export const supportApi = {
  notices: (query: { page?: number; size?: number; q?: string }, signal?: AbortSignal) => api.get<NoticePage>('/support/notices', { query, schema: pageOf(NoticeRowSchema), signal }),
  notice: (idx: number | string, signal?: AbortSignal) => api.get<NoticeDetail>(`/support/notices/${idx}`, { schema: NoticeDetailSchema, signal }),
  faqs: (query: Q, signal?: AbortSignal) => api.get<FaqPage>('/support/faqs', { query, schema: FaqPageSchema, signal }),

  eduData: (query: Q, signal?: AbortSignal) => api.get<EduPage>('/support/edudata', { query, schema: EduPageSchema, signal }),
  eduDataItem: (idx: number | string, signal?: AbortSignal) => api.get<EduDetail>(`/support/edudata/${idx}`, { schema: EduDetailSchema, signal }),
  scraps: (query: Q, signal?: AbortSignal) => api.get<{ items: ScrapRow[]; page: number; size: number; total: number }>('/support/edudata/scraps', { query, schema: pageOf(ScrapRowSchema), signal }),
  scrap: (idx: number) => api.post<z.infer<typeof ScrapResult>>(`/support/edudata/${idx}/scrap`, undefined, { schema: ScrapResult }),
  unscrap: (idx: number) => api.delete<z.infer<typeof ScrapResult>>(`/support/edudata/${idx}/scrap`, { schema: ScrapResult }),

  captcha: (purpose: CaptchaPurpose, signal?: AbortSignal) => api.get<Captcha>('/support/captcha', { query: { purpose }, schema: CaptchaSchema, signal, auth: false }),

  /** 기업교육상담 (비회원 가능) — POST /support/inquiries. */
  createInquiry: (body: InquiryCreate, idempotencyKey?: string) => api.post<z.infer<typeof InquiryResultSchema>>('/support/inquiries', InquiryCreateSchema.parse(body), { schema: InquiryResultSchema, idempotencyKey, auth: false }),
  /** 부정행위 제보 (비회원 가능, 회원 id를 보내지 않음). */
  createCheating: (body: CheatingCreate, idempotencyKey?: string) => api.post<z.infer<typeof OkIdx>>('/support/cheating-reports', CheatingReportCreateSchema.parse(body), { schema: OkIdx, idempotencyKey, auth: false }),

  counselList: (query: Q, signal?: AbortSignal) => api.get<{ items: CounselRow[]; page: number; size: number; total: number }>('/support/counsel', { query, schema: pageOf(CounselRowSchema), signal }),
  counsel: (idx: number | string, signal?: AbortSignal) => api.get<CounselDetail>(`/support/counsel/${idx}`, { schema: CounselDetailSchema, signal }),
  counselOptions: (signal?: AbortSignal) => api.get<CounselOptions>('/support/counsel/options', { schema: CounselOptionsSchema, signal }),
  /** 1:1 문의 — multipart so the optional attachment travels with the question. */
  createCounsel: (body: CounselCreate, idempotencyKey?: string) => api.post<z.infer<typeof OkIdx>>('/support/counsel',
    formOf({ category: body.category, title: body.title, contents: body.contents, studySeq: body.studySeq, captchaToken: body.captchaToken, captchaCode: body.captchaCode }, body.file), { schema: OkIdx, idempotencyKey }),
  /** 학습상담 「학습내용 질문하기」 (학습창). */

  archivingList: (query: Q, signal?: AbortSignal) => api.get<{ items: ArchivingRow[]; page: number; size: number; total: number }>('/support/archiving', { query, schema: pageOf(ArchivingRowSchema), signal }),
  archiving: (idx: number | string, signal?: AbortSignal) => api.get<ArchivingDetail>(`/support/archiving/${idx}`, { schema: ArchivingDetailSchema, signal }),
  createArchiving: (body: ArchivingCreate, idempotencyKey?: string) => api.post<z.infer<typeof OkIdx>>('/support/archiving', formOf({ title: body.title, contents: body.contents }, body.file), { schema: OkIdx, idempotencyKey }),
};
