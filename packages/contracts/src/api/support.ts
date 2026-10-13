import { z } from 'zod';

export const InquiryCreateSchema = z.object({
  companyName: z.string().min(1).max(100),
  name: z.string().min(1).max(50),
  phone: z.string().min(5).max(30),
  email: z.string().email().max(100),
  personnel: z.string().max(50).default(''),
  contents: z.string().min(1).max(4000),
  agree: z.literal(true),
});

export const CounselCreateSchema = z.object({
  category: z.string().max(10).default('1'),
  title: z.string().min(1).max(250),
  contents: z.string().min(1).max(4000),
  lectureCode: z.string().max(50).default(''),
  studySeq: z.number().int().optional(),
});
