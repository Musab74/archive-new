import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { adminSupportParityApi } from '../../../../shared/api/endpoints/admin-support-parity';
import type { StaffList } from '../../../../shared/api/schemas';
import { AButton, AdminPage, AInput, Callout, Card, DataTable, FieldRow, StatusBadge, YnBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { GRANT_LABELS } from '../../../../shared/auth/adminMenu';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';

/** site_info.php inputs in screen order with the PHP <th> labels; every field except Kakao 채널 URL is required (SubmitOk). */
const FIELDS = [
  { key: 'CompanyName', camel: 'companyName', label: () => tr('상호명', 'Company name'), msg: () => tr('상호명을 입력하세요.', 'Enter the company name.') },
  { key: 'Ceo', camel: 'ceo', label: () => tr('대표자명', 'CEO'), msg: () => tr('대표자명을 입력하세요.', 'Enter the CEO.') },
  { key: 'CompanyNumber', camel: 'companyNumber', label: () => tr('사업자등록번호', 'Business reg. no.'), msg: () => tr('사업자번호를 입력하세요.', 'Enter the business number.') },
  { key: 'SalesReportNumber', camel: 'salesReportNumber', label: () => tr('통신판매업신고번호', 'Mail-order reg. no.'), msg: () => tr('통신판매업신고번호를 입력하세요.', 'Enter the mail-order number.') },
  { key: 'Phone', camel: 'phone', label: () => tr('고객상담센터 번호', 'Help desk'), msg: () => tr('고객상담센터 번호를 입력하세요.', 'Enter the help desk number.') },
  { key: 'Fax', camel: 'fax', label: () => 'FAX', msg: () => tr('FAX를 입력하세요.', 'Enter the fax number.') },
  { key: 'Email', camel: 'email', label: () => tr('이메일', 'Email'), msg: () => tr('이메일을 입력하세요.', 'Enter the email.') },
  { key: 'PersonalInformationManager', camel: 'personalInformationManager', label: () => tr('개인정보책임자', 'Privacy officer'), msg: () => tr('개인정보책임자를 입력하세요.', 'Enter the privacy officer.') },
  { key: 'Address', camel: 'address', label: () => tr('주소', 'Address'), msg: () => tr('주소를 입력하세요.', 'Enter the address.') },
  { key: 'Copyright', camel: 'copyright', label: () => 'Copyright', msg: () => tr('Copyright를 입력하세요.', 'Enter the copyright.') },
  { key: 'KakaoURL', camel: 'kakaoUrl', label: () => tr('Kakao 채널 URL', 'Kakao channel URL'), msg: null },
] as const;
type Key = (typeof FIELDS)[number]['key'];

// ---------------------------------------------------------------- /admin/site-info — site_info.php (G1)
export function SiteInfoPage() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'site-info'], queryFn: ({ signal }) => adminSupportParityApi.siteInfo(signal) });
  const base = useMemo(() => { const out = {} as Record<Key, string>; for (const f of FIELDS) out[f.key] = String((q.data as Record<string, unknown> | null | undefined)?.[f.camel] ?? ''); return out; }, [q.data]);
  const [form, setForm] = useState<Record<Key, string>>(base);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  useEffect(() => { setForm(base); setErrors({}); }, [base]);
  const changed = FIELDS.some((f) => form[f.key].trim() !== base[f.key].trim());
  const save = useAdminMutation({ fn: () => adminSupportParityApi.saveSiteInfo(Object.fromEntries(FIELDS.map((f) => [f.key, form[f.key].trim()]))), invalidate: [['admin', 'site-info'], ['design']], success: tr('처리되었습니다.', 'Done.') });
  const submit = () => {
    const e: Partial<Record<Key, string>> = {};
    for (const f of FIELDS) if (f.msg && !form[f.key].trim()) e[f.key] = f.msg();
    setErrors(e); if (!Object.keys(e).length) save.mutate(undefined as never);
  };
  return (
    <AdminPage title={tr('사이트 정보 관리', 'Site information')} lead={tr('저장할 때마다 기존 사이트와 같이 새 행이 추가되고, 화면에는 가장 최근 행이 표시됩니다.', 'Each save adds a new row (as the previous site does); the newest row is shown.')}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : q.isPending ? <Skeleton lines={8} /> : (
        <Card title={q.data ? `idx ${q.data.idx} · ${q.data.regDate ?? ''}` : tr('등록된 사이트 정보가 없습니다', 'No site information yet')}>
          {q.data === null ? <Callout tone="warn">{tr('사이트 정보가 없습니다. 아래 항목을 입력하고 저장하면 첫 행이 만들어집니다.', 'No row yet; saving creates the first one.')}</Callout> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
            {FIELDS.map((f) => <FieldRow key={f.key} label={f.label()} htmlFor={`si-${f.key}`} required={!!f.msg} error={errors[f.key]}><AInput id={`si-${f.key}`} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} maxLength={f.key === 'KakaoURL' ? 100 : 250} disabled={!canWrite} /></FieldRow>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <AButton variant="primary" disabled={!canWrite || (!changed && q.data !== null)} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{tr('수정 하기', 'Save')}</AButton>
          </div>
        </Card>
      )}
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/staff
type Dept = StaffList['departments'][number];
type Staff = StaffList['staff'][number];
const grants = (s: string | null | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const deptCols: Column<Dept>[] = [
  { key: 'idx', header: 'idx', align: 'right' },
  { key: 'dept', header: adm.site.staff.cols.dept, render: (r) => <StatusBadge tone={r.dept === 'A' ? 'ink' : r.dept === 'B' ? 'warn' : 'info'}>{r.dept} {r.deptLabel}</StatusBadge> },
  { key: 'name', header: tr('부서명', 'Department name'), render: (r) => <b>{r.name}</b> },
  { key: 'deep', header: tr('깊이', 'Depth'), align: 'right' },
  { key: 'topMenuGrant', header: adm.site.staff.cols.top, render: (r) => <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>{grants(r.topMenuGrant).map((g) => <StatusBadge key={g} tone="info" title={GRANT_LABELS[g]}>{g}</StatusBadge>)}</span> },
  { key: 'subMenuGrant', header: adm.site.staff.cols.sub, render: (r) => <span className="mono" style={{ fontSize: 11 }}>{r.subMenuGrant ?? ''}</span> },
  { key: 'order', header: adm.site.staff.cols.order, align: 'right', render: (r) => String(r.order ?? '') },
];
const staffCols: Column<Staff>[] = [
  { key: 'id', header: adm.site.staff.cols.id, sortable: true, render: (r) => <b>{r.id}</b> },
  { key: 'name', header: adm.site.staff.cols.name, sortable: true, render: (r) => r.name ?? '' },
  { key: 'dept', header: adm.site.staff.cols.dept, sortable: true, render: (r) => <span><StatusBadge tone={r.dept === 'A' ? 'ink' : r.dept === 'B' ? 'warn' : 'info'}>{r.dept} {r.deptLabel}</StatusBadge> {r.deptName}</span> },
  { key: 'team', header: adm.site.staff.cols.team, render: (r) => r.team ?? '' },
  { key: 'mobile', header: adm.site.staff.cols.mobile, render: (r) => r.mobile ?? '' },
  { key: 'email', header: adm.site.staff.cols.email, render: (r) => r.email ?? '' },
  { key: 'lastLogin', header: adm.site.staff.cols.lastLogin, nowrap: true, sortable: true, render: (r) => r.lastLogin ? `${r.lastLogin} (${r.lastLoginIp ?? ''})` : '' },
  { key: 'useYN', header: adm.site.staff.cols.useYN, align: 'center', render: (r) => <YnBadge value={r.useYN} /> },
];

export function StaffPage() {
  const q = useQuery({ queryKey: ['admin', 'staff'], queryFn: ({ signal }) => adminApi.staff(signal) });
  return (
    <AdminPage title={adm.site.staff.title} lead={adm.site.staff.lead}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title={`${adm.site.staff.staff} (${q.data?.staff.length ?? 0})`}><DataTable columns={staffCols} rows={q.data?.staff} rowKey={(r) => r.idx} loading={q.isPending} dense /></Card>
          <Card title={`${adm.site.staff.departments} (${q.data?.departments.length ?? 0})`}>
            <Callout className="u-mb-8">{tr('메뉴 권한 코드', 'Menu permission codes')}: {Object.entries(GRANT_LABELS).map(([k, v]) => `${k}=${v}`).join(' · ')}. {tr('부서 A는 모든 메뉴, 부서 B(영업)는 조회만 가능합니다.', 'Department A can use every menu; department B (sales) is read-only.')}</Callout>
            <DataTable columns={deptCols} rows={q.data?.departments} rowKey={(r) => r.idx} loading={q.isPending} dense />
          </Card>
        </div>
      )}
    </AdminPage>
  );
}
