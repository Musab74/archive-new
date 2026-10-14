import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { StaffList } from '../../../../shared/api/schemas';
import { AButton, AdminPage, AInput, Callout, Card, DataTable, FieldRow, StatusBadge, YnBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { GRANT_LABELS } from '../../../../shared/auth/adminMenu';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';

const FIELD_KEYS = ['CompanyName', 'Ceo', 'CompanyNumber', 'SalesReportNumber', 'Phone', 'Fax', 'Email', 'PersonalInformationManager', 'Address', 'Copyright', 'KakaoURL'] as const;
type Key = (typeof FIELD_KEYS)[number];
const camel: Record<Key, string> = { CompanyName: 'companyName', Ceo: 'ceo', CompanyNumber: 'companyNumber', SalesReportNumber: 'salesReportNumber', Phone: 'phone', Fax: 'fax', Email: 'email', PersonalInformationManager: 'personalInformationManager', Address: 'address', Copyright: 'copyright', KakaoURL: 'kakaoUrl' };

// ---------------------------------------------------------------- /admin/site-info
export function SiteInfoPage() {
  const s = adm.site.info;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'site-info'], queryFn: ({ signal }) => adminApi.siteInfo(signal) });
  const base = useMemo(() => { const out = {} as Record<Key, string>; for (const k of FIELD_KEYS) out[k] = String((q.data as Record<string, unknown> | null)?.[camel[k]] ?? ''); return out; }, [q.data]);
  const [form, setForm] = useState<Record<Key, string>>(base);
  useEffect(() => { setForm(base); }, [base]);
  const diff = useMemo(() => { const out: Record<string, string | null> = {}; for (const k of FIELD_KEYS) if (form[k] !== base[k]) out[k] = form[k].trim() === '' ? null : form[k].trim(); return out; }, [form, base]);
  const save = useAdminMutation({ fn: (body: Record<string, string | null>) => adminApi.putSiteInfo(body), invalidate: [['admin', 'site-info'], ['design']], success: adm.common.saved });
  return (
    <AdminPage title={s.title} lead={s.lead} actions={<AButton variant="primary" disabled={!canWrite || !Object.keys(diff).length} title={readOnlyTitle} loading={save.isPending} onClick={() => save.mutate(diff)}>{adm.common.save}</AButton>}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : q.isPending ? <Skeleton lines={8} /> : q.data === null ? <Callout tone="warn">{s.none}</Callout> : (
        <Card title={`idx ${q.data?.idx ?? ''} · ${q.data?.regDate ?? ''}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
            {FIELD_KEYS.map((k) => <FieldRow key={k} label={s.fields[k]} htmlFor={`si-${k}`}><AInput id={`si-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} maxLength={k === 'Address' || k === 'Copyright' || k === 'KakaoURL' ? 300 : 100} disabled={!canWrite} /></FieldRow>)}
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
