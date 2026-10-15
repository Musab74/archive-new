/**
 * 사업주 관리 parity endpoints (company_read.php 수강생 정보 / 수강 내역 / ProgressInfo / CourseInfo, company_read_excel.php,
 * company_info_pop.php, 엑셀로 등록 with warnings). Response schemas live here so the shared schemas file stays untouched.
 */
import { z } from 'zod';
import { api } from '../../../../shared/api/client';
import { pageOf } from '../../../../shared/api/schemas';
import { downloadAdminFile } from '../../../../shared/api/endpoints/admin';
import { NudgeMemberInfoSchema, NudgeRevealSchema, type NudgeMemberInfo, type RevealField } from '../../../../shared/api/endpoints/admin-nudge';

const s = z.string().nullable().optional().transform((v) => v ?? null);
const n = z.number().nullable().optional().transform((v) => v ?? null);

export const CompanyMemberRowSchema = z.object({
  no: z.number(), idx: z.number(), id: z.string(), name: s, birthDay: s, gender: s, genderLabel: z.string().default(''), email: s, mobile: s, depart: s, position: s,
  lastLogin: s, regDate: s, useYN: s, useYNLabel: z.string().default(''), eduManager: z.boolean().default(false),
});
export type CompanyMemberRow = z.infer<typeof CompanyMemberRowSchema>;

export const CompanyStudyRowSchema = z.object({
  no: z.number(), studySeq: z.number(), serviceType: s, serviceTypeLabel: z.string().default(''), id: z.string(), name: s, lectureCode: z.string(), courseName: z.string(),
  period: z.object({ start: z.string(), end: z.string() }), tutorLimitDay: z.string().default(''), seconds: z.number(), formatted: z.string().default(''), percent: z.number(),
  midView: z.string(), testView: z.string(), reportView: z.string(), totalScoreView: z.string(), passOk: s, passOkLabel: z.string().default(''), studyEnd: z.boolean().default(false),
  tutor: s, tutorName: s, companyName: s, depart: s, certCount: n,
});
export type CompanyStudyRow = z.infer<typeof CompanyStudyRowSchema>;

export const CompanyTermsV2Schema = z.object({
  year: z.union([z.number(), z.literal('all')]), order: z.enum(['asc', 'desc']).default('desc'), companyCode: z.string(),
  items: z.array(z.object({ lectureCode: z.string(), courseName: z.string(), start: z.string(), end: z.string(), enrolled: z.number(), passed: z.number(), passRate: z.number(), price: z.number(), refund: z.number() })),
});
export type CompanyTermsV2 = z.infer<typeof CompanyTermsV2Schema>;

const LearningItemSchema = z.object({
  no: z.number(), serviceTypeLabel: z.string().default(''), courseName: s, contentsTitle: s, lectureCode: z.string(), chapterNo: z.number(), chapterSeq: z.number(), rowStudySeq: z.number(),
  progress: z.number(), seconds: z.number(), studyTimeLabel: z.string(), lectureTimeMin: n, startDate: s, endDate: s,
});
export const CompanyStudyProgressSchema = z.object({
  study: z.object({
    studySeq: z.number(), id: z.string(), name: s, lectureCode: z.string(), courseName: z.string(), period: z.object({ start: z.string(), end: z.string() }), serviceTypeLabel: z.string().default(''), passOkLabel: z.string().default(''),
    passOk: s, companyName: s, depart: s, tutor: s, tutorName: s,
  }),
  header: z.object({ seconds: z.number(), label: z.string(), percent: z.number() }),
  learning: z.object({ isPackage: z.boolean(), items: z.array(LearningItemSchema), sum: z.object({ chapters: z.number(), seconds: z.number(), label: z.string(), criterionSeconds: z.number(), met: z.boolean(), judge: z.string() }) }),
});
export type CompanyStudyProgress = z.infer<typeof CompanyStudyProgressSchema>;

export const CompanyChapterLogSchema = z.union([
  z.object({ mode: z.literal('ticks'), chapterNo: z.number(), sameCount: z.number(), items: z.array(z.object({ no: z.number(), idx: z.number(), progress: z.number(), studyTime: z.number(), studyTimeLabel: z.string(), delta: z.number(), positionSec: n, ip: s, at: z.string(), lastStudy: s, sameMinute: z.boolean() })) }),
  z.object({ mode: z.literal('chapters'), sumSeconds: z.number(), items: z.array(z.object({ no: z.number(), chapterSeq: z.number(), chapterNo: z.number(), progress: z.number(), seconds: z.number(), studyTimeLabel: z.string(), startAt: s, lastAt: s })) }),
]);
export type CompanyChapterLog = z.infer<typeof CompanyChapterLogSchema>;

export const CourseInfoSchema = z.object({
  courseIdx: n, lectureCode: z.string(), classGrade: s, classGradeLabel: z.string().default(''), useYN: s, useYNLabel: z.string().default(''), contentsURLSelect: s, packageLectureCode: s, hrdSeq: s,
  category: z.string().default(''), serviceType: s, serviceTypeLabel: z.string().default(''), contentsTime: n, contentsName: s, views: n, keyword1: s, keyword2: s, keyword3: s, keyword4: s,
  chapter: n, contentsStart: s, contentsEnd: s, uploadDate: s, professor: s, passTime: n, mobile: s, mobileLabel: z.string().default(''), bookPrice: n,
  price: n, price01: n, price02: n, price03: n, bookIntro: s, attachFile: s, previewImage: s, bookImage: s, intro: s, eduTarget: s, eduGoal: s,
});
export type CourseInfo = z.infer<typeof CourseInfoSchema>;

export const CompanyByCodeSchema = z.object({ idx: z.number(), companyCode: z.string(), companyName: z.string() });

export const ImportPlanRowV2Schema = z.object({ line: z.number(), action: z.enum(['create', 'update', 'error']), companyCode: z.string(), companyName: z.string(), companyId: z.string(), homePage: z.string(), errors: z.array(z.string()), warnings: z.array(z.string()).default([]) });
export type ImportPlanRowV2 = z.infer<typeof ImportPlanRowV2Schema>;
export const ImportResultV2Schema = z.object({ mode: z.enum(['dryRun', 'commit']), summary: z.object({ total: z.number(), create: z.number(), update: z.number(), error: z.number() }), rows: z.array(ImportPlanRowV2Schema), applied: z.object({ created: z.number(), updated: z.number(), skipped: z.number() }).nullable() });
export type ImportResultV2 = z.infer<typeof ImportResultV2Schema>;
export type ImportFormat = 'template' | 'hrdTrainee';

/**
 * 회사명 / 사업자번호 are required strings in the import row schema: a blank cell is sent as '' (not null) so the row is
 * validated and painted red by the API instead of the whole batch being rejected. Other blank cells stay null.
 */
export function importRowBody(r: Record<string, string | null>): Record<string, string | null> {
  return { ...r, CompanyName: r.CompanyName ?? '', CompanyCode: r.CompanyCode ?? '' };
}

export const companiesApi = {
  terms: (idx: number, year: number | 'all', order: 'asc' | 'desc' = 'desc', signal?: AbortSignal) => api.get<CompanyTermsV2>(`/admin/companies/${idx}/terms`, { query: { year, order }, schema: CompanyTermsV2Schema, signal }),
  members: (idx: number, query: { page: number; size: number }, signal?: AbortSignal) => api.get(`/admin/companies/${idx}/members`, { query, schema: pageOf(CompanyMemberRowSchema), signal }),
  studies: (idx: number, query: { page: number; size: number }, signal?: AbortSignal) => api.get(`/admin/companies/${idx}/studies`, { query, schema: pageOf(CompanyStudyRowSchema), signal }),
  studyProgress: (idx: number, seq: number, signal?: AbortSignal) => api.get<CompanyStudyProgress>(`/admin/companies/${idx}/studies/${seq}/progress`, { schema: CompanyStudyProgressSchema, signal }),
  chapterLog: (idx: number, seq: number, query: { lectureCode: string; studySeq?: number; chapterSeq?: number }, signal?: AbortSignal) => api.get<CompanyChapterLog>(`/admin/companies/${idx}/studies/${seq}/chapter-log`, { query, schema: CompanyChapterLogSchema, signal }),
  courseInfo: (lectureCode: string, signal?: AbortSignal) => api.get<CourseInfo>(`/admin/companies/course-info/${encodeURIComponent(lectureCode)}`, { schema: CourseInfoSchema, signal }),
  byCode: (code: string, signal?: AbortSignal) => api.get(`/admin/companies/by-code/${encodeURIComponent(code)}`, { schema: CompanyByCodeSchema, signal }),
  importCompanies: (body: { rows: Record<string, string | null>[]; mode: 'dryRun' | 'commit'; skipInvalid: boolean; format: ImportFormat }) => api.post<ImportResultV2>('/admin/companies/import', { ...body, rows: body.rows.map(importRowBody) }, { schema: ImportResultV2Schema }),
  /** ProgressInfo "학습내역 엑셀 출력" (study_progress_excel.php) for this company's enrollment — A1 is enough. */
  downloadStudyProgressExcel: (idx: number, seq: number) => downloadAdminFile(`/admin/companies/${idx}/studies/${seq}/progress-excel`, {}, 'study_progress.csv'),
  /** MemberInfo(ID) popup (member_info_pop.php) for a learner of this company — A1 is enough (the member page needs A2). */
  memberInfo: (idx: number, id: string, signal?: AbortSignal) => api.get<NudgeMemberInfo>(`/admin/companies/${idx}/member-info/${encodeURIComponent(id)}`, { schema: NudgeMemberInfoSchema, signal }),
  revealMember: (idx: number, id: string, body: { field: RevealField; gubun: string; reason: string; url?: string }) => api.post<z.infer<typeof NudgeRevealSchema>>(`/admin/companies/${idx}/member-info/${encodeURIComponent(id)}/reveal`, body, { schema: NudgeRevealSchema }),
  downloadMembersCsv: (idx: number) => downloadAdminFile(`/admin/companies/${idx}/members/export`, {}, 'company_members.csv'),
};
