import { z } from 'zod';

export const CONTENT_TYPES = { X: 'elearning', Y: 'micro', Z: 'short', W: 'nonrefund', A: 'package' } as const;

export const CatalogQuerySchema = z.object({
  q: z.string().max(100).optional(),
  category1: z.coerce.number().int().optional(),
  category2: z.coerce.number().int().optional(),
  ctype: z.enum(['X', 'Y', 'Z']).optional(),
  keyword: z.string().max(100).optional(),
  sort: z.enum(['latest', 'popular', 'rating', 'title']).default('latest'),
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
