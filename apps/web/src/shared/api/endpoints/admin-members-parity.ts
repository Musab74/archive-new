import { z } from 'zod';
import { api } from '../client';
import { pageOf, ProgressLogPageSchema, StudyPeriodSchema, type ProgressLogPage } from '../schemas';
import { downloadAdminFile } from './admin';
import { EnrollImportResultSchema } from './admin-ruby-ops';
import { ChapterLogSchema, LearningRowSchema, type ChapterLog } from './admin-studies-parity';

/**
 * 회원관리 › 수강생 관리 / 수강 등록 parity endpoints (member.php, member_read.php, member_write.php, member_script.php,
 * member_company_write*.php, counsel_phone_write*.php, member_testid_*.php, delete_member_data.php, lecture_reg_list.php).
 * Extended response schemas live here; shared/api/schemas.ts keeps the original MemberRow/MemberDetail.
 */
type Q = Record<string, string | number | boolean | null | undefined>;
const Str = z.string().nullable().optional();
const Num = z.number().nullable().optional();
const enc = encodeURIComponent;

export const MemberParityRowSchema = z.object({
  idx: z.number(), id: z.string(), name: Str, memberType: Str, memberTypeLabel: z.string().default(''), companyCode: Str, companyName: Str, depart: Str, position: Str,
  useYN: Str, useYNLabel: z.string().default(''), eduManager: z.boolean(), testId: z.boolean(), protectId: Str, protectIdLabel: z.string().default(''), sleep: z.boolean(), memberOut: z.boolean(),
  lastLogin: Str, regDate: Str, passChange: Str, enrollments: z.number(),
  birthDay: Str, gender: Str, genderLabel: z.string().default(''), email: Str, mobile: Str, salesName: Str, salesDeptName: Str,
});
export type MemberParityRow = z.infer<typeof MemberParityRowSchema>;

const ProfileSchema = z.object({
  idx: z.number(), id: z.string(), name: Str, memberType: Str, memberTypeLabel: z.string().default(''), companyCode: Str, companyName: Str, depart: Str, position: Str, gender: Str, genderLabel: z.string().default(''),
  address: z.object({ zipcode: Str, address01: Str, address02: Str }), email: Str, mobile: Str, tel: Str, birthDay: Str, masked: z.boolean().default(false),
  useYN: Str, eduManager: Str, testId: Str, protectId: Str, memberRemark: Str, sleep: Str, sleepDate: Str, memberOut: Str, memberOutDate: Str, lastLogin: Str, lastLoginIp: Str, regDate: Str, editDate: Str, passChange: Str,
  mandatory: Str, marketing: Str, marketingLabel: z.string().default(''), abilityYN: Str, abilityAfterYN: Str, hrd: z.object({ nwIno: Str, trneeSe: Str, irglbrSe: Str }).optional(),
  nameEng: Str, etc01: Str, etc02: Str, mailling: Str, acs: Str, cardName: Str, cardNumber: Str, recomId: Str, testLectureCode: Str,
});
const CompanyCardSchema = z.object({
  idx: z.number(), scale: Str, scaleLabel: z.string().default(''), companyName: Str, companyCode: z.string(), hrd: Str, companyId: Str, ceo: Str, tel: Str, tel2: Str, csEnabled: z.boolean(), uptae: Str, upjong: Str, fax: Str, fax2: Str,
  address: z.object({ zipcode: Str, address01: Str, address02: Str }), bankName: Str, bankNumber: Str, email: Str, homePage: Str, eduManager: Str, eduManagerPhone: Str, eduManagerEmail: Str, salesManager: Str, salesName: Str, remark: Str, cyberUrl: Str, cyberEnabled: z.boolean(),
});
const EnrollmentSchema = z.object({
  studySeq: z.number(), lectureCode: z.string(), courseName: z.string(), serviceType: Str, serviceTypeLabel: z.string().default(''), companyCode: Str, companyName: Str, depart: Str, memberName: Str, packageYN: Str,
  period: StudyPeriodSchema, termeIdx: z.number().optional(), storedProgress: z.number(), seconds: z.number(), formatted: z.string(), percent: z.number(), over15h: z.boolean(),
  serviceTypeLabelPhp: z.string().optional(),
  passOk: z.boolean(), passOkRaw: Str, studyEnd: z.boolean(), studyEndInPeriod: z.boolean().default(false), inputDate: Str, tutor: Str, tutorName: Str, certCount: Num,
});
export const MemberParityDetailSchema = z.object({
  profile: ProfileSchema,
  company: CompanyCardSchema.nullable().default(null),
  managedCompanies: z.array(z.object({ idx: z.number(), companyCode: z.string(), companyName: Str, regDate: Str })).default([]),
  enrollments: z.array(EnrollmentSchema).default([]),
  loginHistory: z.array(z.object({ idx: z.number(), device: Str, ip: Str, userAgent: Str, uaLabel: z.string().default('-'), at: Str })).default([]),
  loginTotal: z.number().default(0),
  identity: z.object({ certCount: z.number(), certSuccess: z.number(), lastCertAt: Str }),
  certHistory: z.array(z.object({ seq: z.number(), lectureCode: z.string(), courseName: Str, studySeq: Num, certDate: Str, certType: Str, result: Str, ip: Str, at: Str })).default([]),
  counselPhone: z.array(z.object({ idx: z.number(), category: Str, categoryLabel: z.string(), name: Str, contents: z.string(), regDate: Str, status: Str, statusLabel: z.string() })).default([]),
  inquiries: z.array(z.object({ idx: z.number(), category: Str, categoryLabel: z.string(), name: Str, title: Str, regDate: Str, status: Str, statusLabel: z.string() })).default([]),
});
export type MemberParityDetail = z.infer<typeof MemberParityDetailSchema>;

export const MemberEditFormSchema = z.object({
  idx: z.number(), id: z.string(), name: Str, resNo: z.string(), gender: z.string(), birthDay: z.string(), email: z.string(), tel: z.string(), mobile: z.string(), zipcode: z.string(), address01: z.string(), address02: z.string(), nameEng: z.string(),
  companyCode: z.string(), companyName: z.string(), depart: z.string(), position: z.string(), etc01: z.array(z.string()), etc02: z.array(z.string()), mailling: z.string(), acs: z.string(), marketing: z.string(), eduManager: z.string(), useYN: z.string(), protectId: z.string(),
  cardName: z.string(), cardNumber: z.string(), recomId: Str,
});
export type MemberEditForm = z.infer<typeof MemberEditFormSchema>;

const Ok = z.object({ ok: z.boolean() }).passthrough();
export const RevealSchema = z.object({ field: z.string(), label: z.string(), value: z.string() });
export const IdCheckSchema = z.object({ id: z.string(), available: z.boolean(), message: z.string() });
export const CompanyPickSchema = z.object({ items: z.array(z.object({ companyCode: z.string(), companyName: Str })) });
export const TestAccountResultSchema = z.object({ ok: z.boolean(), id: z.string(), password: z.string(), enrollment: z.object({ studySeq: z.number(), termeIdx: z.number(), lectureCode: z.string(), lectureStart: z.string(), lectureEnd: z.string() }).nullable() });
export type TestAccountResult = z.infer<typeof TestAccountResultSchema>;

export const StagedRowSchema = z.object({
  no: z.number(), idx: z.number(), lectureCode: Str, tutor: Str, name: Str, resNo: z.string(),
  /** lecture_reg_list.php shows the full 주민등록번호 (the admin's own upload); resNo stays masked for older callers. */
  resNoFull: z.string().optional(),
  mobile: Str, email: Str, companyCode: Str, depart: Str, lectureStart: Str, lectureEnd: Str, reStudy: z.string(),
  serviceType: Str, serviceTypeLabel: z.string(), userId: Str, userIdLabel: z.string(), pwd: Str, nwIno: Str, trneeSe: Str, trneeSeLabel: z.string(), irglbrSe: Str, irglbrSeLabel: z.string(), openChapter: Str, salesId: Str, eduManager: Str,
  status: z.enum(['wait', 'error']), errors: z.array(z.string()), errorCells: z.array(z.string()), studyOverlap: z.boolean(), regDate: Str,
  /** lecture_reg_list.php $SqlOverlap: the open Study this row overlaps (for "기존 수강 수강마감 열기"). */
  overlapStudy: z.object({ seq: z.number(), lectureStart: z.string(), lectureEnd: z.string(), companyCode: z.string(), companyName: z.string(), title: z.string() }).nullable().optional(),
});
export type StagedRow = z.infer<typeof StagedRowSchema>;
export const StagedListSchema = z.object({ items: z.array(StagedRowSchema), total: z.number(), errorCount: z.number() });
export const STAGED_KEYS = ['LectureCode', 'Tutor', 'Name', 'ResNo', 'Mobile', 'Email', 'CompanyCode', 'Depart', 'LectureStart', 'LectureEnd', 'LectureReStudy', 'ServiceType', 'UserID', 'Pwd', 'nwIno', 'trneeSe', 'IrglbrSe', 'OpenChapter', 'SalesID', 'EduManager'] as const;
export type StagedKey = (typeof STAGED_KEYS)[number];
export const StagedFullSchema = z.object({ idx: z.number() }).catchall(z.union([z.string(), z.number()]));
export const StagedCommitSchema = EnrollImportResultSchema.extend({ stagedRemoved: z.number(), stagedIdxs: z.array(z.number()) });
export type StagedCommitResult = z.infer<typeof StagedCommitSchema>;

/** lecture_reg.php selects (sales carry Mobile for "성명 | 아이디 | 소속 | 휴대폰"). */
export const EnrollOptionsParitySchema = z.object({
  courses: z.array(z.object({ lectureCode: z.string(), name: Str, ctype: Str })).default([]),
  tutors: z.array(z.object({ id: z.string(), name: Str, team: Str })).default([]),
  sales: z.array(z.object({ id: z.string(), name: Str, team: Str, mobile: Str, label: z.string().optional() })).default([]),
  serviceTypes: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
  progress: z.array(z.number()).default([0, 50, 80, 100]),
});
export type EnrollOptionsParity = z.infer<typeof EnrollOptionsParitySchema>;
export const EnrollMemberSearchSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: Str, companyCode: Str, companyName: Str, depart: Str, label: z.string().optional() })),
  total: z.number().optional(), truncated: z.boolean().optional(),
});
export const StagedCoursesSchema = z.object({ items: z.array(z.object({ lectureCode: z.string(), name: Str, packageYN: Str, serviceType: Str, label: z.string() })) });
export const StagedUploadResultSchema = z.object({ ok: z.boolean(), inserted: z.number(), skipped: z.number(), idxs: z.array(z.number()) });
export const StagedCommitRowSchema = z.object({ idx: z.number(), status: z.enum(['done', 'error']), label: z.string(), reasons: z.array(z.string()), userId: Str, studySeq: Num, memberCreated: z.boolean() });
export type StagedCommitRow = z.infer<typeof StagedCommitRowSchema>;
export const LoginAsSchema = z.object({ ok: z.boolean(), id: z.string(), name: Str, url: z.string().default('/'), liveSso: z.boolean().optional() });

/** salesmanager_search.php result ("-- N건이 검색되었습니다 --"). */
export const SalesSearchSchema = z.object({ items: z.array(z.object({ id: z.string(), name: Str, team: Str, mobile: Str, label: z.string() })), total: z.number() });
export type SalesSearch = z.infer<typeof SalesSearchSchema>;

/** progress_info_pop.php opened from 수강생 상세 (A2): 수강 정보 header + 학습 내역. */
export const MemberStudyProgressSchema = z.object({
  studySeq: z.number(), id: z.string(), name: Str, courseName: Str, lectureCode: z.string(), companyCode: Str, companyName: Str, period: StudyPeriodSchema,
  seconds: z.number(), formatted: z.string(), percent: z.number(), progressHeader: z.object({ seconds: z.number(), label: z.string(), percent: z.number() }).nullable().optional(),
  passOk: z.boolean(), studyEnd: z.boolean(), tutor: Str, tutorName: Str, serviceTypeLabel: Str, openChapter: z.union([z.number(), z.string()]).nullable().optional(),
  learning: z.object({ isPackage: z.boolean(), items: z.array(LearningRowSchema), sum: z.object({ chapters: z.number(), seconds: z.number(), label: z.string(), criterionSeconds: z.number().optional(), met: z.boolean(), judge: z.string().optional() }) }).nullable().optional(),
});
export type MemberStudyProgress = z.infer<typeof MemberStudyProgressSchema>;

/** qna_read.php?idx= opened from the 1:1 문의 제목 on 수강생 상세. */
export const MemberInquirySchema = z.object({
  idx: z.number(), id: Str, name: Str, category: Str, categoryLabel: z.string(), title: Str, contents: z.string(), courseName: Str, contentsTitle: Str, lectureCode: Str,
  mobile: Str, email: Str, regDate: Str, answeredAt: Str, studentFile: Str, status: Str, statusLabel: z.string(), answerName: z.string(), answer: z.string(), answerFiles: z.array(z.object({ no: z.number(), name: z.string() })),
});
export type MemberInquiry = z.infer<typeof MemberInquirySchema>;

/** member_write.php 관심분야 / 가입경로 checkboxes, Information_protection_regist2.php 구분. */
export const ETC01_OPTIONS = ['일반과정', '유아교육', '자격증', '개인환급', '기업환급'] as const;
export const ETC02_OPTIONS = ['인터넷검색', 'SNS', '직장동료소개', '홍보책자', '기타'] as const;
export const PRIVACY_GUBUN = ['학습자 관리', '학습자 요청', '기타 상담'] as const;
export const PRIVACY_REASON_RE = /^[가-힣a-zA-Z0-9\s]+$/u;
export const MEMBER_SEARCH_COLS = [
  { value: 'name_id', label: '이름 또는 아이디', en: 'Name or ID' }, { value: 'Name', label: '이름', en: 'Name' }, { value: 'Mobile', label: '휴대폰', en: 'Mobile' }, { value: 'ID', label: '아이디', en: 'ID' },
  { value: 'CompanyName', label: '사업주명', en: 'Company' }, { value: 'SalesName', label: '영업담당자', en: 'Sales rep' }, { value: 'SalesDept', label: '영업담당자 소속', en: 'Sales team' }, { value: 'LastLogin', label: '마지막로그인 1년이상', en: 'No login for 1 year+' },
] as const;

export const adminMembersParityApi = {
  // 수강생 관리 (member.php)
  members: (query: Q, signal?: AbortSignal) => api.get('/admin/members', { query, schema: pageOf(MemberParityRowSchema), signal }),
  downloadMembersCsv: (query: Q) => downloadAdminFile('/admin/members/export', query, 'members.csv'),
  checkId: (id: string, signal?: AbortSignal) => api.get('/admin/members/check-id', { query: { id }, schema: IdCheckSchema, signal }),
  companySearch: (name: string, signal?: AbortSignal) => api.get('/admin/members/company-search', { query: { name }, schema: CompanyPickSchema, signal }),
  createMember: (body: Record<string, unknown>) => api.post('/admin/members', body, { schema: Ok }),
  createTestAccount: (body: Record<string, unknown>) => api.post('/admin/members/test-account', body, { schema: TestAccountResultSchema }),

  // 수강생 상세 (member_read.php)
  member: (id: string, signal?: AbortSignal) => api.get(`/admin/members/${enc(id)}`, { schema: MemberParityDetailSchema, signal }),
  reveal: (id: string, body: { field: 'BirthDay' | 'Email' | 'Tel' | 'Mobile'; gubun: string; reason: string; url?: string }) => api.post(`/admin/members/${enc(id)}/reveal`, body, { schema: RevealSchema }),
  editForm: (id: string, body: { gubun: string; reason: string; url?: string }) => api.post(`/admin/members/${enc(id)}/edit-form`, body, { schema: MemberEditFormSchema }),
  updateMember: (id: string, body: Record<string, unknown>) => api.put(`/admin/members/${enc(id)}`, body, { schema: Ok }),
  initPassword: (id: string) => api.post(`/admin/members/${enc(id)}/password/init`, undefined, { schema: Ok }),
  withdraw: (id: string) => api.post(`/admin/members/${enc(id)}/withdraw`, undefined, { schema: Ok }),
  setUse: (id: string, useYN: 'Y' | 'N') => api.post(`/admin/members/${enc(id)}/use`, { useYN }, { schema: Ok }),
  deleteData: (id: string, reason: string) => api.post(`/admin/members/${enc(id)}/delete-data`, { reason }, { schema: Ok }),
  addManagedCompany: (id: string, companyCode: string) => api.post(`/admin/members/${enc(id)}/managed-companies`, { companyCode }, { schema: Ok }),
  editManagedCompany: (id: string, idx: number, companyCode: string) => api.patch(`/admin/members/${enc(id)}/managed-companies/${idx}`, { companyCode }, { schema: Ok }),
  removeManagedCompany: (id: string, idx: number) => api.delete(`/admin/members/${enc(id)}/managed-companies/${idx}`, { schema: Ok }),
  createCounselPhone: (id: string, body: { Category: string; Name: string; Contents: string; Status: string }) => api.post(`/admin/members/${enc(id)}/counsel-phone`, body, { schema: Ok }),
  updateCounselPhone: (id: string, idx: number, body: { Category: string; Name: string; Contents: string; Status: string }) => api.patch(`/admin/members/${enc(id)}/counsel-phone/${idx}`, body, { schema: Ok }),
  removeCounselPhone: (id: string, idx: number) => api.delete(`/admin/members/${enc(id)}/counsel-phone/${idx}`, { schema: Ok }),
  downloadCounselPhoneCsv: (id: string) => downloadAdminFile(`/admin/members/${enc(id)}/counsel-phone/export`, {}, `counsel_phone_${id}.csv`),
  /** member_login.php: sets the learner session cookie for this member (open the learner site afterwards). */
  loginAs: (id: string) => api.post(`/admin/members/${enc(id)}/login-as`, undefined, { schema: LoginAsSchema }),
  /** progress_info_pop.php (진도율 / 진도 로그 · 보기) for this member's enrollment — A2 is enough, unlike /admin/studies/:seq (B5). */
  memberStudyProgress: (id: string, seq: number, signal?: AbortSignal) => api.get(`/admin/members/${enc(id)}/studies/${seq}`, { schema: MemberStudyProgressSchema, signal }),
  memberChapterLog: (id: string, seq: number, query: { lectureCode: string; studySeq?: number; chapterSeq?: number }, signal?: AbortSignal) => api.get<ChapterLog>(`/admin/members/${enc(id)}/studies/${seq}/chapter-log`, { query, schema: ChapterLogSchema, signal }),
  memberProgressLog: (id: string, seq: number, cursor: number, size = 100, signal?: AbortSignal) => api.get<ProgressLogPage>(`/admin/members/${enc(id)}/studies/${seq}/progress-log`, { query: { cursor, size }, schema: ProgressLogPageSchema, signal }),
  /** qna_read.php?idx= (read-only; answering stays on 1:1 상담문의). */
  memberInquiry: (id: string, idx: number, signal?: AbortSignal) => api.get(`/admin/members/${enc(id)}/inquiries/${idx}`, { schema: MemberInquirySchema, signal }),

  // 수강 등록 (lecture_reg.php)
  enrollmentOptions: (signal?: AbortSignal) => api.get('/admin/enrollments/options', { schema: EnrollOptionsParitySchema, signal }),
  enrollmentMembers: (q: string, signal?: AbortSignal) => api.get('/admin/enrollments/members', { query: { q }, schema: EnrollMemberSearchSchema, signal }),
  /** salesmanager_search.php: Name/ID LIKE (an empty term lists every sales rep). */
  enrollmentSales: (q: string, signal?: AbortSignal) => api.get('/admin/enrollments/sales', { query: { q }, schema: SalesSearchSchema, signal }),

  // 수강 등록 › 엑셀 업로드 목록 (lecture_reg_list.php)
  staged: (signal?: AbortSignal) => api.get('/admin/enrollments/staged', { schema: StagedListSchema, signal }),
  stagedRow: (idx: number, signal?: AbortSignal) => api.get(`/admin/enrollments/staged/${idx}`, { schema: StagedFullSchema, signal }),
  updateStaged: (idx: number, body: Record<string, string>) => api.put(`/admin/enrollments/staged/${idx}`, body, { schema: Ok }),
  deleteStaged: (idxs: number[]) => api.post('/admin/enrollments/staged/delete', { idxs }, { schema: Ok }),
  commitStaged: (body: { idxs?: number[]; skipInvalid: boolean }) => api.post('/admin/enrollments/staged/commit', body, { schema: StagedCommitSchema }),
  /** lecture_reg_complete.php for one row (the page calls it row by row). */
  commitStagedRow: (idx: number) => api.post(`/admin/enrollments/staged/${idx}/commit`, undefined, { schema: StagedCommitRowSchema }),
  stagedCourses: (signal?: AbortSignal) => api.get('/admin/enrollments/staged/courses', { schema: StagedCoursesSchema, signal }),
  uploadStaged: (file: File) => { const fd = new FormData(); fd.append('file', file, file.name); return api.post('/admin/enrollments/staged/upload', fd, { schema: StagedUploadResultSchema }); },
  downloadStagedSample: (kind: 'form' | 'sample') => downloadAdminFile('/admin/enrollments/staged/sample', { kind }, kind === 'form' ? '수강등록.xlsx' : '수강등록(샘플).xlsx'),
};
