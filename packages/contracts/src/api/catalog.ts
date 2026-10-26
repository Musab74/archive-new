import { z } from 'zod';

/** Course.ctype / ServiceType letters as the PHP site uses them (hrd_manager/course.php: X 이러닝, Y 숏폼, Z 마이크로닝; nav ctype=Z 마이크로러닝, Y 숏폼). */
export const CONTENT_TYPES = { X: 'elearning', Y: 'short', Z: 'micro', W: 'nonrefund', A: 'package' } as const;

/** AR-04 AI ZONE learning directions (AI 입문·기초 / 산업별 AI 특화 / AI·AX 프로젝트 / AI 스마트교육과정) plus `all`. */
export const AI_DIRECTIONS = ['all', 'basic', 'industry', 'project', 'smart'] as const;
export type AiDirection = (typeof AI_DIRECTIONS)[number];

export const CatalogQuerySchema = z.object({
  q: z.string().max(100).optional(),
  category1: z.coerce.number().int().optional(),
  category2: z.coerce.number().int().optional(),
  ctype: z.enum(['X', 'Y', 'Z']).optional(),
  keyword: z.string().max(100).optional(),
  /** AI ZONE scope (api/aizone-content.php AI 기본 조건): all = every AI-related content; basic|industry|project|smart = one of the four AR-04 directions. */
  ai: z.enum(AI_DIRECTIONS).optional(),
  /** latest 운영 편성순(등록 최신) · popular 조회순 · rating 평점순 · title 제목순 · relevance 검색 관련도순(q가 있을 때만) · liked 찜한 콘텐츠순(로그인 시) */
  sort: z.enum(['latest', 'popular', 'rating', 'title', 'relevance', 'liked']).default('latest'),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(60).default(12),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

export const CourseCardSchema = z.object({
  idx: z.number().int(),
  lectureCode: z.string(),
  title: z.string(),
  ctype: z.string(),
  serviceType: z.string().nullable(),
  category1: z.string().nullable(),
  category2: z.string().nullable(),
  minutes: z.number().int(),
  thumbnailUrl: z.string().nullable(),
  viewCount: z.number().int(),
  rating: z.number().nullable(),
  ratingCount: z.number().int(),
  keywords: z.array(z.string()),
  regDate: z.string().nullable(),
  /** Course.ContentsStart (제작) / UploadDate (업로드), 'YYYY-MM-DD'; null when unset (0000-00-00). */
  contentsStart: z.string().nullable().optional(),
  uploadDate: z.string().nullable().optional(),
  /** Course.Keyword2 → ContentsKeyword label (직무분야). */
  jobField: z.string().nullable().optional(),
  liked: z.boolean().optional(),
});
export type CourseCard = z.infer<typeof CourseCardSchema>;

export const ReviewCreateSchema = z.object({ starPoint: z.number().int().min(1).max(5), title: z.string().max(250).default(''), contents: z.string().max(2000).default('') });

/** GET /catalog/stats — live, cached counts shown on the public home (facts, not promises). */
export const CatalogStatsSchema = z.object({
  courses: z.number().int().nonnegative(),
  categories: z.number().int().nonnegative(),
  keywords: z.number().int().nonnegative(),
  types: z.number().int().nonnegative(),
});
export type CatalogStats = z.infer<typeof CatalogStatsSchema>;
