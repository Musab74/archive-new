import { CatalogStatsSchema, CourseCardSchema, type CatalogQuery, type CatalogStats, type CourseCard } from '@ainex/contracts';
import { z } from 'zod';
import { api } from '../client';
import { CourseDetailSchema, listOf, PackageChildrenSchema, pageOf, AiRoadmapSchema, type AiRoadmap, type Category, type CourseDetail, type Keyword, type PackageChildren, type Roadmap } from '../schemas';

export interface CoursePage { items: CourseCard[]; page: number; size: number; total: number }
const CoursePageSchema = pageOf(CourseCardSchema);
const CourseListSchema = listOf(CourseCardSchema);

/** GET /catalog/categories returns the CourseCategory tree [{idx, name, orderByNum, children:[…]}]. */
interface CategoryNodeDto { idx: number; name: string; orderByNum?: number; children?: { idx: number; name: string; orderByNum?: number }[] }
/** GET /catalog/keywords returns ContentsKeyword groups [{jobCate, category, items:[{idx, keyword, orderByNum}]}]. */
interface KeywordGroupDto { jobCate: string | null; category: string; items: { idx: number; keyword: string; orderByNum?: number }[] }

/** Tree → flat list ({id, name, parentId}) for the filter sidebar and toApiQuery. Tolerates an already-flat `{items}` payload. */
export function flattenCategories(raw: unknown): Category[] {
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) return (raw as { items: Category[] }).items;
  if (!Array.isArray(raw)) return [];
  const out: Category[] = [];
  for (const top of raw as CategoryNodeDto[]) {
    out.push({ id: Number(top.idx), name: top.name, parentId: null });
    for (const c of top.children ?? []) out.push({ id: Number(c.idx), name: c.name, parentId: Number(top.idx) });
  }
  return out;
}

/** ContentsKeyword groups → flat keyword list; `category` = ContentsKeyword.Category ('2' = 직무분야, the job fields the home lists). */
export function flattenKeywords(raw: unknown, category?: string): Keyword[] {
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) return (raw as { items: Keyword[] }).items;
  if (!Array.isArray(raw)) return [];
  const out: Keyword[] = [];
  for (const g of raw as KeywordGroupDto[]) {
    if (category && String(g.category) !== category) continue;
    for (const k of g.items ?? []) out.push({ id: Number(k.idx), name: k.keyword });
  }
  return out;
}

export interface ReviewItem { idx: number; author: string; starPoint: number; title: string; contents: string; regDate: string | null; mine: boolean }
export interface ReviewPage { items: ReviewItem[]; page: number; size: number; total: number; rating: number | null; ratingCount: number }

export type AiZoneTab = 'content' | 'handson' | 'certification';
export interface AiZoneParams { tab: AiZoneTab; type?: 'popular' | 'new'; sortBy?: 'latest' | 'rating'; categories?: string[]; ctypes?: string[]; search?: string; minTime?: number; minYear?: number; minRating?: number }
export type AiZoneCard = CourseCard & { difficulty: '기초' | '중급' | '심화' };

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

/** Detail payload → CourseDetail (teacher name/profile, 제작연도 from ContentsStart, 업데이트 = UploadDate, chapter numbers as text). */
export function mapCourseDetail(raw: Record<string, unknown>): CourseDetail {
  const teacher = raw.teacher as { name?: string; profile?: string; intro?: string } | string | null | undefined;
  const chapters = Array.isArray(raw.chapters) ? (raw.chapters as Record<string, unknown>[]).map((c) => ({ ...c, number: String(c.number ?? '') })) : [];
  const mapped = {
    ...raw,
    chapters,
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    description: str(raw.description) ?? str(raw.intro),
    objective: str(raw.objective) ?? ([str(raw.eduGoal), str(raw.eduTarget) ? `교육대상: ${str(raw.eduTarget)}` : null].filter(Boolean).join('\n\n') || null),
    teacher: str(raw.professor) ?? (typeof teacher === 'string' ? teacher : str(teacher?.name)),
    teacherIntro: typeof teacher === 'object' && teacher ? str(teacher.profile) ?? str(teacher.intro) : null,
    year: str(raw.year) ?? (str(raw.contentsStart)?.slice(0, 4) ?? str(raw.regDate)?.slice(0, 4) ?? null),
    updatedDate: str(raw.updatedDate) ?? str(raw.uploadDate) ?? str(raw.regDate),
  };
  const parsed = CourseDetailSchema.safeParse(mapped);
  return parsed.success ? parsed.data : (mapped as unknown as CourseDetail);
}

export const catalogApi = {
  courses: (query: Partial<CatalogQuery>, signal?: AbortSignal) => api.get<CoursePage>('/catalog/courses', { query, schema: CoursePageSchema, signal }),
  course: async (lectureCode: string, signal?: AbortSignal): Promise<CourseDetail> =>
    mapCourseDetail(await api.get<Record<string, unknown>>(`/catalog/courses/${encodeURIComponent(lectureCode)}`, { signal })),
  /** Operator-curated list (1 PICK / 2 TOP10 / 3 NEW / 4 HRDe), ContentsList order, max 50. */
  list: (listId: number, signal?: AbortSignal) => api.get<{ items: CourseCard[] }>(`/catalog/lists/${listId}`, { schema: CourseListSchema, signal }),
  /** Live counts for the home hero (public, cached 10 min server-side). */
  stats: (signal?: AbortSignal) => api.get<CatalogStats>('/catalog/stats', { schema: CatalogStatsSchema, signal, auth: false }),
  /** ContentsKeyword labels (flat); `category` '2' keeps the 직무분야 list only. */
  keywords: async (signal?: AbortSignal, category?: string): Promise<{ items: Keyword[] }> => ({ items: flattenKeywords(await api.get<unknown>('/catalog/keywords', { signal }), category) }),
  categories: async (signal?: AbortSignal): Promise<{ items: Category[] }> => ({ items: flattenCategories(await api.get<unknown>('/catalog/categories', { signal })) }),
  /** 찜하기 = POST, 찜 해제 = DELETE (the API keeps one CourseLike row per learner and content). */
  like: (lectureCode: string, liked: boolean) => {
    const path = `/catalog/courses/${encodeURIComponent(lectureCode)}/like`;
    const schema = z.object({ liked: z.boolean(), count: z.number().int().optional() });
    return liked ? api.post<{ liked: boolean; count?: number }>(path, {}, { schema }) : api.delete<{ liked: boolean; count?: number }>(path, { schema });
  },
  review: (lectureCode: string, body: { starPoint: number; title?: string; contents?: string }) => api.post<{ idx: number; updated: boolean }>(`/catalog/courses/${encodeURIComponent(lectureCode)}/reviews`, body, { schema: z.object({ idx: z.number().int(), updated: z.boolean() }) }),
  reviews: (lectureCode: string, page = 1, size = 10, signal?: AbortSignal) => api.get<ReviewPage>(`/catalog/courses/${encodeURIComponent(lectureCode)}/reviews`, { query: { page, size }, signal }),
  /** Learning-home 추천 콘텐츠 (archive/include/top_header.html): profile-keyword match with the reason line. */
  recommendations: (signal?: AbortSignal) => api.get<{ items: (CourseCard & { reason: string; matchScore: number })[] }>('/catalog/recommendations', { signal }),
  /** AI ZONE content hub (AI 콘텐츠 허브 / 실습형 AI / AI 관련 자격). */
  aiZone: (p: AiZoneParams, signal?: AbortSignal) => api.get<{ tab: AiZoneTab; count: number; items: AiZoneCard[] }>('/catalog/ai-zone', {
    query: { tab: p.tab, type: p.type, sortBy: p.sortBy, categories: p.categories?.length ? p.categories.join(',') : undefined, ctypes: p.ctypes?.length ? p.ctypes.join(',') : undefined, search: p.search || undefined, minTime: p.minTime && p.minTime > 1 ? p.minTime : undefined, minYear: p.minYear && p.minYear > 2018 ? p.minYear : undefined, minRating: p.minRating ? p.minRating : undefined },
    signal,
  }),
  /** Child courses of a package enrollment (AR-09 운영자 로드맵). */
  packageChildren: (lectureCode: string, signal?: AbortSignal) => api.get<PackageChildren>(`/catalog/packages/${encodeURIComponent(lectureCode)}/children`, { schema: PackageChildrenSchema, signal }),
  roadmap: async (body: { goal: string; field?: string; level?: string }): Promise<Roadmap> => {
    const r = await api.post<AiRoadmap>('/ai/roadmap', { jobField: body.field ?? '', goal: body.goal, hoursPerWeek: body.level === 'advanced' ? 5 : body.level === 'intermediate' ? 3 : 2 }, { schema: AiRoadmapSchema });
    return { summary: r.summary ?? null, items: r.steps.map((st, i) => ({ order: i + 1, lectureCode: st.lectureCode ?? null, title: st.title, reason: st.reason ?? null, minutes: st.minutes ?? null, ctype: null })) };
  },
};
