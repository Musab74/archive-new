import { z } from 'zod';
import { AdminSessionSchema } from '@ainex/contracts';
import { api } from '../../../../shared/api/client';
import { pageOf } from '../../../../shared/api/schemas';
import { downloadAdminFile } from '../../../../shared/api/endpoints/admin';
import { STAFF_DEPT_TEXT, staffExportFallbackName, type StaffDept } from './staffParity';

/**
 * 회원 관리 parity endpoints for 관리자/영업자/첨삭강사 리스트 (staff01/02/03.php), 카테고리 (dept_category.php),
 * 탈퇴회원 관리 (member_out.php) and 개인정보 열람내역 (read_reason.php). Served by AdminStaffController.
 * The original calls in shared/api/endpoints/admin.ts stay for other callers.
 */
type Q = Record<string, string | number | boolean | null | undefined>;
const Str = z.string().nullable().optional();
const Num = z.number().nullable().optional();
const Grant = z.object({ code: z.string(), label: z.string() });
const Catalogue = z.object({ top: z.array(Grant), sub: z.record(z.array(Grant)) });

export const StaffLoginRowSchema = z.object({ no: z.number(), ip: Str, device: Str, at: Str });
export type StaffLoginRow = z.infer<typeof StaffLoginRowSchema>;
export const IdCheckSchema = z.object({ id: z.string(), valid: z.boolean(), available: z.boolean(), message: z.string() });
export type IdCheck = z.infer<typeof IdCheckSchema>;
export const StaffCategorySchema = z.object({ idx: z.number(), parent: Num, deep: z.number(), name: Str, deptString: Str, children: z.number(), path: z.string() });
export type StaffCategory = z.infer<typeof StaffCategorySchema>;
export const StaffCategoriesSchema = z.object({ dept: z.string(), deptLabel: Str, items: z.array(StaffCategorySchema) });
export const LoginAsSchema = z.object({ accessToken: z.string(), expiresIn: z.number(), admin: AdminSessionSchema });

export const DeptNodeParitySchema = z.object({
  idx: z.number(), dept: z.string(), deptLabel: Str, parent: Num, deep: z.number(), name: Str, deptString: Str, topMenuGrant: z.string(), subMenuGrant: z.string(),
  order: Num, children: z.number(), descendants: z.number().default(0), staff: z.number(),
});
export type DeptNodeParity = z.infer<typeof DeptNodeParitySchema>;
export const SalesOrderRowSchema = z.object({ idx: z.number(), deep: z.number(), name: Str, order: Num, descendants: z.number(), salesCount: z.number() });
export type SalesOrderRow = z.infer<typeof SalesOrderRowSchema>;
export const DepartmentsParitySchema = z.object({
  items: z.array(DeptNodeParitySchema),
  salesOrder: z.array(SalesOrderRowSchema).default([]),
  grants: Catalogue.extend({ byDept: z.record(Catalogue).optional() }),
});
export type DepartmentsParity = z.infer<typeof DepartmentsParitySchema>;

export const WithdrawnParityRowSchema = z.object({
  idx: z.number(), id: z.string(), name: Str, companyCode: Str, companyName: Str, companyLabel: z.string().default(''), birthDay: Str, gender: Str, genderLabel: z.string().default(''),
  email: Str, mobile: Str, depart: Str, position: Str, lastLogin: Str, regDate: Str, memberOutDate: Str,
});
export type WithdrawnParityRow = z.infer<typeof WithdrawnParityRowSchema>;

/** Local YYYYMMDD (fallback file names only — the server's Content-Disposition wins). */
const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
const enc = (n: number) => encodeURIComponent(String(n));
export const staffParityApi = {
  logins: (idx: number, page: number, size: number, signal?: AbortSignal) => api.get(`/admin/staff-members/${enc(idx)}/logins`, { query: { page, size }, schema: pageOf(StaffLoginRowSchema), signal }),
  idCheck: (id: string) => api.get('/admin/staff-members/id-check', { query: { id }, schema: IdCheckSchema }),
  categories: (dept: string, signal?: AbortSignal) => api.get('/admin/staff-members/categories', { query: { dept }, schema: StaffCategoriesSchema, signal }),
  loginAs: (idx: number) => api.post(`/admin/staff-members/${enc(idx)}/login-as`, {}, { schema: LoginAsSchema }),
  /** staff02_excel.php — the API answers an .xlsx workbook (name kept for existing callers). */
  downloadStaffCsv: (query: Q) => downloadAdminFile('/admin/staff-members/export', query, staffExportFallbackName(String(query.dept) in STAFF_DEPT_TEXT ? (query.dept as StaffDept) : 'B', todayYmd())),
  departments: (signal?: AbortSignal) => api.get('/admin/departments', { schema: DepartmentsParitySchema, signal }),
  withdrawn: (query: Q, signal?: AbortSignal) => api.get('/admin/withdrawn-members', { query, schema: pageOf(WithdrawnParityRowSchema), signal }),
  /** read_reason_excel.php — .xlsx workbook "개인정보 열람내역_YYYYMMDD.xlsx". */
  downloadPrivacyCsv: (query: Q) => downloadAdminFile('/admin/privacy-log/export', query, `개인정보 열람내역_${todayYmd()}.xlsx`),
};
