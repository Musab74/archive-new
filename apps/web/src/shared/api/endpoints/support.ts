import type { z } from 'zod';
import { InquiryCreateSchema, CounselCreateSchema } from '@ainex/contracts';
import { isAppError } from '../client';
import { api } from '../client';
import { sanitizeLegacyHtml } from '../../utils/legacyHtml';
import { EventSchema, FaqSchema, InquiryResultSchema, listOf, NoticeSchema, pageOf, ResourceSchema, type EventItem, type Faq, type Notice, type Resource } from '../schemas';

export type InquiryCreate = z.infer<typeof InquiryCreateSchema>;
export type CounselCreate = z.infer<typeof CounselCreateSchema>;
export interface NoticePage { items: Notice[]; page: number; size: number; total: number }

export const supportApi = {
  notices: (query: { page?: number; size?: number; q?: string }, signal?: AbortSignal) => api.get<NoticePage>('/support/notices', { query, schema: pageOf(NoticeSchema), signal, auth: true }),
  /** API returns `content`; the page model uses `contents`. */
  notice: async (idx: number | string, signal?: AbortSignal): Promise<Notice> => {
    const raw = await api.get<Record<string, unknown>>(`/support/notices/${idx}`, { signal });
    const mapped = { ...raw, contents: (raw.contents as string | null | undefined) ?? (raw.content as string | null | undefined) ?? null };
    const parsed = NoticeSchema.safeParse(mapped);
    return parsed.success ? parsed.data : (mapped as unknown as Notice);
  },
  /** The API groups FAQs by category ([{category, items:[{idx,title,content}]}]); flatten to the page's {items:[{idx,category,question,answer}]}. */
  faqs: async (query: { q?: string; category?: string } = {}, signal?: AbortSignal): Promise<{ items: Faq[] }> => {
    const raw = await api.get<unknown>('/support/faqs', { query, signal });
    const groups = Array.isArray(raw) ? raw : (raw as { items?: unknown[] })?.items ?? [];
    const FAQ_CATEGORY: Record<string, string> = { A: '일반', B: '동영상', C: '학습진도', D: '로그인', E: '기타문의' };
    const label = (code: unknown): string | null => (typeof code === 'string' && code ? (FAQ_CATEGORY[code] ?? code) : null);
    const items: Faq[] = [];
    for (const g of groups as Array<Record<string, unknown>>) {
      if (Array.isArray(g.items)) {
        for (const f of g.items as Array<Record<string, unknown>>) items.push({ idx: Number(f.idx), category: (g.categoryName as string) ?? label(g.category), question: String(f.title ?? f.question ?? ''), answer: sanitizeLegacyHtml(String(f.content ?? f.answer ?? '')), link: null });
      } else if (g.idx !== undefined) {
        items.push({ idx: Number(g.idx), category: label(g.category), question: String(g.title ?? g.question ?? ''), answer: sanitizeLegacyHtml(String(g.content ?? g.answer ?? '')), link: null });
      }
    }
    return { items };
  },
  /** 기업교육 상담 (public). */
  createInquiry: (body: InquiryCreate, idempotencyKey?: string) => api.post<{ idx?: number; ok?: boolean }>('/support/inquiries', InquiryCreateSchema.parse(body), { schema: InquiryResultSchema, idempotencyKey, auth: false }),
  /** 1:1 문의 (learner). */
  createCounsel: (body: CounselCreate, idempotencyKey?: string) => api.post<{ idx?: number; ok?: boolean }>('/support/counsel', CounselCreateSchema.parse(body), { schema: InquiryResultSchema, idempotencyKey }),
  resources: (signal?: AbortSignal) => api.get<{ items: Resource[] }>('/support/resources', { schema: listOf(ResourceSchema), signal }),
  events: (signal?: AbortSignal) => api.get<{ items: EventItem[] }>('/support/events', { schema: listOf(EventSchema), signal }).catch((e) => { if (isAppError(e) && e.status === 404) return { items: [] as EventItem[] }; throw e; }),
};
