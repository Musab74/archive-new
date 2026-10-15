import { z } from 'zod';
import { api } from '../client';
import { pageOf, StudyPeriodSchema } from '../schemas';
import { downloadAdminFile } from './admin';
import { EnrollImportResultSchema } from './admin-ruby-ops';

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
  no: z.number(), idx: z.number(), lectureCode: Str, tutor: Str, name: Str, resNo: z.string(), mobile: Str, email: Str, companyCode: Str, depart: Str, lectureStart: Str, lectureEnd: Str, reStudy: z.string(),
  serviceType: Str, serviceTypeLabel: z.string(), userId: Str, userIdLabel: z.string(), pwd: Str, nwIno: Str, trneeSe: Str, trneeSeLabel: z.string(), irglbrSe: Str, irglbrSeLabel: z.string(), openChapter: Str, salesId: Str, eduManager: Str,
  status: z.enum(['wait', 'error']), errors: z.array(z.string()), errorCells: z.array(z.string()), studyOverlap: z.boolean(), regDate: Str,
});
export type StagedRow = z.infer<typeof StagedRowSchema>;
export const StagedListSchema = z.object({ items: z.array(StagedRowSchema), total: z.number(), errorCount: z.number() });
export const STAGED_KEYS = ['LectureCode', 'Tutor', 'Name', 'ResNo', 'Mobile', 'Email', 'CompanyCode', 'Depart', 'LectureStart', 'LectureEnd', 'LectureReStudy', 'ServiceType', 'UserID', 'Pwd', 'nwIno', 'trneeSe', 'IrglbrSe', 'OpenChapter', 'SalesID', 'EduManager'] as const;
export type StagedKey = (typeof STAGED_KEYS)[number];
export const StagedFullSchema = z.object({ idx: z.number() }).catchall(z.union([z.string(), z.number()]));
export const StagedCommitSchema = EnrollImportResultSchema.extend({ stagedRemoved: z.number(), stagedIdxs: z.array(z.number()) });
export type StagedCommitResult = z.infer<typeof StagedCommitSchema>;

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

  // 수강 등록 › 엑셀 업로드 목록 (lecture_reg_list.php)
  staged: (signal?: AbortSignal) => api.get('/admin/enrollments/staged', { schema: StagedListSchema, signal }),
  stagedRow: (idx: number, signal?: AbortSignal) => api.get(`/admin/enrollments/staged/${idx}`, { schema: StagedFullSchema, signal }),
  updateStaged: (idx: number, body: Record<string, string>) => api.put(`/admin/enrollments/staged/${idx}`, body, { schema: Ok }),
  deleteStaged: (idxs: number[]) => api.post('/admin/enrollments/staged/delete', { idxs }, { schema: Ok }),
  commitStaged: (body: { idxs?: number[]; skipInvalid: boolean }) => api.post('/admin/enrollments/staged/commit', body, { schema: StagedCommitSchema }),
};
