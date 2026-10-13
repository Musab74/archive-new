import { CatalogStatsSchema, CourseCardSchema, type CatalogQuery, type CatalogStats, type CourseCard } from '@ainex/contracts';
import { z } from 'zod';
import { api } from '../client';
import { CategorySchema, CourseDetailSchema, KeywordSchema, listOf, OkSchema, PackageChildrenSchema, pageOf, RoadmapSchema, AiRoadmapSchema, type AiRoadmap, type Category, type CourseDetail, type Keyword, type PackageChildren, type Roadmap } from '../schemas';

export interface CoursePage { items: CourseCard[]; page: number; size: number; total: number }
const CoursePageSchema = pageOf(CourseCardSchema);
const CourseListSchema = listOf(CourseCardSchema);

export const catalogApi = {
  courses: (query: Partial<CatalogQuery>, signal?: AbortSignal) => api.get<CoursePage>('/catalog/courses', { query, schema: CoursePageSchema, signal }),
  course: async (lectureCode: string, signal?: AbortSignal): Promise<CourseDetail> => {
    const raw = await api.get<Record<string, unknown>>(`/catalog/courses/${encodeURIComponent(lectureCode)}`, { signal });
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
    const teacher = raw.teacher as { name?: string; intro?: string } | string | null | undefined;
    const mapped = {
      ...raw,
      description: str(raw.description) ?? str(raw.intro),
      objective: str(raw.objective) ?? ([str(raw.eduGoal), str(raw.eduTarget) ? `교육대상: ${str(raw.eduTarget)}` : null].filter(Boolean).join('\n\n') || null),
      teacher: str(raw.professor) ?? (typeof teacher === 'string' ? teacher : str(teacher?.name)),
      teacherIntro: typeof teacher === 'object' && teacher ? str(teacher.intro) : null,
      year: str(raw.year) ?? str(raw.madeYear) ?? (str(raw.regDate)?.slice(0, 4) ?? null),
      updatedDate: str(raw.updatedDate) ?? str(raw.regDate),
    };
    const parsed = CourseDetailSchema.safeParse(mapped);
    return parsed.success ? parsed.data : (mapped as unknown as CourseDetail);
  },
  /** Operator-curated list (1 = 대표 콘텐츠 / 메인 PICK). */
  list: (listId: number, signal?: AbortSignal) => api.get<{ items: CourseCard[] }>(`/catalog/lists/${listId}`, { schema: CourseListSchema, signal }),
  /** Live counts for the home hero (public, cached 10 min server-side). */
  stats: (signal?: AbortSignal) => api.get<CatalogStats>('/catalog/stats', { schema: CatalogStatsSchema, signal, auth: false }),
  keywords: (signal?: AbortSignal) => api.get<{ items: Keyword[] }>('/catalog/keywords', { schema: listOf(KeywordSchema), signal }),
  categories: (signal?: AbortSignal) => api.get<{ items: Category[] }>('/catalog/categories', { schema: listOf(CategorySchema), signal }),
  like: (lectureCode: string, liked: boolean) => api.post<{ ok: boolean; liked?: boolean }>(`/catalog/courses/${encodeURIComponent(lectureCode)}/like`, { liked }, { schema: OkSchema.extend({ liked: z.boolean().optional() }) }),
  review: (lectureCode: string, body: { starPoint: number; title?: string; contents?: string }) => api.post<{ ok: boolean }>(`/catalog/courses/${encodeURIComponent(lectureCode)}/reviews`, body, { schema: OkSchema }),
  /** Child courses of a package enrollment (AR-09 운영자 로드맵). */
  packageChildren: (lectureCode: string, signal?: AbortSignal) => api.get<PackageChildren>(`/catalog/packages/${encodeURIComponent(lectureCode)}/children`, { schema: PackageChildrenSchema, signal }),
  roadmap: async (body: { goal: string; field?: string; level?: string }): Promise<Roadmap> => {
    const r = await api.post<AiRoadmap>('/ai/roadmap', { jobField: body.field ?? '', goal: body.goal, hoursPerWeek: body.level === 'advanced' ? 5 : body.level === 'intermediate' ? 3 : 2 }, { schema: AiRoadmapSchema });
    return { summary: r.summary ?? null, items: r.steps.map((st, i) => ({ order: i + 1, lectureCode: st.lectureCode ?? null, title: st.title, reason: st.reason ?? null, minutes: st.minutes ?? null, ctype: null })) };
  },
};
