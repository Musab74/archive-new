import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { StaffRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, YnBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { GrantGate, useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const DEPT: Record<string, { label: string; grant: string; titleEn: string }> = { A: { label: '관리자 리스트', grant: 'A6', titleEn: 'Administrators' }, B: { label: '영업자 리스트', grant: 'A7', titleEn: 'Sales staff' }, C: { label: '첨삭강사 리스트', grant: 'A8', titleEn: 'Tutors' } };
const DEFAULTS = { col: 'ID', q: '', useYN: '', page: 1 };
const SIZE = 20;
const FIELDS = ['Name', 'Team', 'Mobile', 'Phone', 'Email', 'BankName', 'BankNumber'] as const;
type Form = Record<(typeof FIELDS)[number], string> & { ID: string; Pwd: string; Dept_idx: string; UseYN: 'Y' | 'N'; CommissionRatio: string };
const empty = (): Form => ({ ID: '', Pwd: '', Dept_idx: '', Name: '', Team: '', Mobile: '', Phone: '', Email: '', BankName: '', BankNumber: '', UseYN: 'Y', CommissionRatio: '0' });
const fromRow = (r: StaffRow): Form => ({ ID: r.id, Pwd: '', Dept_idx: String(r.deptIdx), Name: r.name ?? '', Team: r.team ?? '', Mobile: r.mobile ?? '', Phone: r.phone ?? '', Email: r.email ?? '', BankName: r.bankName ?? '', BankNumber: r.bankNumber ?? '', UseYN: r.useYN === 'N' ? 'N' : 'Y', CommissionRatio: String(r.commissionRatio ?? 0) });

/** staff01/02/03.php — one page per department (A 관리자, B 영업자, C 첨삭강사). */
export default function StaffListPage() {
  const { dept = 'A' } = useParams();
  const meta = DEPT[dept] ?? DEPT.A!;
  return <GrantGate grant={meta.grant}><StaffList dept={dept as 'A' | 'B' | 'C'} title={tr(meta.label, meta.titleEn)} /></GrantGate>;
}

function StaffList({ dept, title }: { dept: 'A' | 'B' | 'C'; title: string }) {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q, useYN: p.useYN });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ dept, col: p.col, q: p.q || undefined, useYN: p.useYN || undefined, page: p.page, size: SIZE }), [dept, p]);
  const list = useQuery({ queryKey: ['admin', 'staff-members', query], queryFn: ({ signal }) => adminApi.staffMembers(query, signal), placeholderData: keepPreviousData });
  const depts = useQuery({ queryKey: ['admin', 'departments'], queryFn: ({ signal }) => adminApi.departments(signal), staleTime: 5 * 60_000 });
  const deptOptions = useMemo(() => (depts.data?.items ?? []).filter((d) => d.dept === dept).map((d) => ({ value: String(d.idx), label: `${'  '.repeat(Math.max(0, d.deep - 1))}${d.name ?? d.idx}` })), [depts.data, dept]);
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;

  const [sel, setSel] = useState<StaffRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'staff-member', sel?.idx], queryFn: ({ signal }) => adminApi.staffMember(sel!.idx, signal), enabled: !!sel });
  const [editOpen, setEditOpen] = useState<'create' | 'edit' | null>(null);
  const [f, setF] = useState<Form>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (editOpen === 'edit' && sel) setF(fromRow(sel)); if (editOpen === 'create') setF(empty()); setErrors({}); }, [editOpen, sel]);
  const onErr = (err: unknown) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  const inv = [['admin', 'staff-members'], ['admin', 'departments'], ['admin', 'staff']];
  const create = useAdminMutation({ fn: (b: Record<string, unknown>) => adminApi.createStaff(b), invalidate: inv, success: adm.common.created, onSuccess: () => setEditOpen(null), onError: onErr });
  const patch = useAdminMutation({ fn: (b: Record<string, unknown>) => adminApi.patchStaff(sel!.idx, b), invalidate: [...inv, ['admin', 'staff-member', sel?.idx]], success: adm.common.saved, onSuccess: () => setEditOpen(null), onError: onErr });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminApi.deleteStaff(sel!.idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDelOpen(false); setSel(null); } });
  const [pwOpen, setPwOpen] = useState(false); const [pw, setPw] = useState('');
  const resetPw = useAdminMutation({ fn: () => adminApi.resetStaffPassword(sel!.idx, pw.trim() || undefined), success: tr('비밀번호가 초기화되었습니다.', 'Password reset.'), onSuccess: () => { setPwOpen(false); setPw(''); } });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.Name.trim()) e.Name = tr('필수 항목입니다.', 'Required.');
    if (!f.Dept_idx) e.Dept_idx = tr('카테고리를 선택하세요.', 'Choose a category.');
    if (editOpen === 'create') { if (!/^[A-Za-z0-9_.-]{2,50}$/.test(f.ID.trim())) e.ID = tr('영문/숫자 2~50자', 'Letters/digits, 2–50 chars'); if (f.Pwd.length < 4) e.Pwd = tr('4자 이상', 'At least 4 chars'); }
    setErrors(e); if (Object.keys(e).length) return;
    const body: Record<string, unknown> = { Dept_idx: Number(f.Dept_idx), Name: f.Name.trim(), Team: f.Team.trim() || null, Mobile: f.Mobile.trim() || null, Phone: f.Phone.trim() || null, Email: f.Email.trim() || null, BankName: f.BankName.trim() || null, BankNumber: f.BankNumber.trim() || null, UseYN: f.UseYN };
    if (dept === 'B') body.CommissionRatio = Number(f.CommissionRatio) || 0;
    if (editOpen === 'create') create.mutate({ ...body, dept, ID: f.ID.trim(), Pwd: f.Pwd }); else patch.mutate(body);
  };

  const columns: Column<StaffRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => firstNo - i },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <b>{r.id}</b> },
    { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
    { key: 'deptName', header: tr('권한', 'Role'), render: (r) => r.deptName ?? '' },
    { key: 'team', header: tr('소속', 'Team'), render: (r) => r.team ?? '' },
    { key: 'mobile', header: tr('휴대폰', 'Mobile'), nowrap: true, render: (r) => r.mobile ?? '' },
    { key: 'email', header: tr('이메일', 'E-mail'), render: (r) => r.email ?? '' },
    ...(dept === 'B' ? [{ key: 'commissionRatio', header: tr('수수료율', 'Commission'), align: 'right' as const, render: (r: StaffRow) => r.commissionRatio === null || r.commissionRatio === undefined ? '' : `${r.commissionRatio}%` }] : []),
    { key: 'lastLogin', header: tr('최근 로그인', 'Last login'), nowrap: true, render: (r) => r.lastLogin ?? '—' },
    { key: 'lastLoginIp', header: tr('최근 로그인 IP', 'Last IP'), nowrap: true, render: (r) => <span className="mono">{r.lastLoginIp ?? ''}</span> },
    { key: 'useYN', header: tr('사용 유무', 'Active'), align: 'center', render: (r) => <YnBadge value={r.useYN} /> },
  ];
  const d = detail.data;
  return (
    <AdminPage title={title} lead={tr('기존 운영자 목록과 같은 항목입니다. 행을 누르면 상세·로그인 이력이 열립니다.', 'Same columns as the legacy list. Click a row for details and login history.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setEditOpen('create'); }}>{tr('신규 등록', 'New')}</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'ID', q: '', useYN: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="st-col" width={130}><ASelect id="st-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ID', label: tr('아이디', 'User ID') }, { value: 'Name', label: tr('이름', 'Name') }, { value: 'Team', label: tr('소속', 'Team') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="st-q" width={240}><AInput id="st-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={tr('사용 유무', 'Active')} htmlFor="st-use" width={120}><ASelect id="st-use" value={form.useYN} onChange={(e) => setForm({ ...form, useYN: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'Y', label: tr('사용', 'Yes') }, { value: 'N', label: tr('미사용', 'No') }]} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 운영자가 없습니다.', 'No operators.')} dense />

      <DetailDrawer open={!!sel && !editOpen} onClose={() => setSel(null)} title={sel ? `${sel.name ?? ''} (${sel.id})` : ''} subtitle={sel?.deptName ?? ''} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="danger" disabled={!canWrite} onClick={() => setDelOpen(true)}>{adm.common.delete}</AButton><AButton disabled={!canWrite} onClick={() => setPwOpen(true)}>{tr('비밀번호 초기화', 'Reset password')}</AButton><AButton variant="primary" disabled={!canWrite} onClick={() => setEditOpen('edit')}>{adm.common.edit}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={tr('기본 정보', 'Profile')}>
              <DescList items={[[tr('아이디', 'User ID'), d.staff.id], [tr('이름', 'Name'), d.staff.name], [tr('권한', 'Role'), d.staff.deptPath || d.staff.deptName], [tr('소속', 'Team'), d.staff.team], [tr('휴대폰', 'Mobile'), d.staff.mobile], [tr('연락처', 'Phone'), d.staff.phone], [tr('이메일', 'E-mail'), d.staff.email], [tr('계좌', 'Bank account'), [d.staff.bankName, d.staff.bankNumber].filter(Boolean).join(' ')], ...(dept === 'B' ? [[tr('수수료율', 'Commission'), d.staff.commissionRatio === null ? null : `${d.staff.commissionRatio}%`] as [string, string | null]] : []), [tr('사용 유무', 'Active'), <YnBadge key="u" value={d.staff.useYN} />], [tr('등록일', 'Registered'), d.staff.regDate], [tr('최근 로그인', 'Last login'), d.staff.lastLogin ? `${d.staff.lastLogin} (${d.staff.lastLoginIp ?? ''})` : null]]} />
            </Card>
            <Card title={`${tr('로그인 이력', 'Login history')} (${d.loginCount.toLocaleString()})`}>
              <DataTable columns={[{ key: 'at', header: tr('시각', 'Time'), nowrap: true, render: (r) => r.at ?? '' }, { key: 'ip', header: 'IP', render: (r) => <span className="mono">{r.ip ?? ''}</span> }, { key: 'device', header: tr('기기', 'Device'), render: (r) => r.device ?? '' }]} rows={d.loginHistory} rowKey={(_r, i) => i} size={10} dense />
            </Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      <DetailDrawer open={!!editOpen} onClose={() => setEditOpen(null)} title={editOpen === 'create' ? tr('운영자 등록', 'New operator') : tr('운영자 수정', 'Edit operator')} subtitle={title}
        footer={<><AButton onClick={() => setEditOpen(null)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{editOpen === 'create' ? adm.common.create : adm.common.save}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('카테고리(권한)', 'Category (role)')} htmlFor="sf-dept" required error={errors.Dept_idx}><ASelect id="sf-dept" value={f.Dept_idx} onChange={(e) => setF({ ...f, Dept_idx: e.target.value })} options={deptOptions} placeholder={tr('-- 선택 --', '-- choose --')} loading={depts.isPending} /></FieldRow>
          {editOpen === 'create' ? (<>
            <FieldRow label={tr('아이디', 'User ID')} htmlFor="sf-id" required error={errors.ID}><AInput id="sf-id" value={f.ID} onChange={(e) => setF({ ...f, ID: e.target.value })} maxLength={50} autoComplete="off" /></FieldRow>
            <FieldRow label={tr('비밀번호', 'Password')} htmlFor="sf-pw" required error={errors.Pwd}><AInput id="sf-pw" type="password" value={f.Pwd} onChange={(e) => setF({ ...f, Pwd: e.target.value })} maxLength={64} autoComplete="new-password" /></FieldRow>
          </>) : <FieldRow label={tr('아이디', 'User ID')}><div style={{ paddingTop: 8 }}><b className="mono">{f.ID}</b></div></FieldRow>}
          <FieldRow label={tr('이름', 'Name')} htmlFor="sf-name" required error={errors.Name}><AInput id="sf-name" value={f.Name} onChange={(e) => setF({ ...f, Name: e.target.value })} maxLength={50} /></FieldRow>
          <FieldRow label={tr('소속', 'Team')} htmlFor="sf-team"><AInput id="sf-team" value={f.Team} onChange={(e) => setF({ ...f, Team: e.target.value })} maxLength={50} /></FieldRow>
          <FieldRow label={tr('휴대폰', 'Mobile')} htmlFor="sf-mob"><AInput id="sf-mob" value={f.Mobile} onChange={(e) => setF({ ...f, Mobile: e.target.value.replace(/[^0-9-]/g, '') })} maxLength={20} /></FieldRow>
          <FieldRow label={tr('연락처', 'Phone')} htmlFor="sf-tel"><AInput id="sf-tel" value={f.Phone} onChange={(e) => setF({ ...f, Phone: e.target.value.replace(/[^0-9-]/g, '') })} maxLength={20} /></FieldRow>
          <FieldRow label={tr('이메일', 'E-mail')} htmlFor="sf-email"><AInput id="sf-email" type="email" value={f.Email} onChange={(e) => setF({ ...f, Email: e.target.value })} maxLength={50} /></FieldRow>
          <FieldRow label={tr('은행명 / 계좌번호', 'Bank / account')}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><AInput aria-label={tr('은행명', 'Bank')} value={f.BankName} onChange={(e) => setF({ ...f, BankName: e.target.value })} maxLength={50} /><AInput aria-label={tr('계좌번호', 'Account no.')} value={f.BankNumber} onChange={(e) => setF({ ...f, BankNumber: e.target.value })} maxLength={50} /></div></FieldRow>
          {dept === 'B' ? <FieldRow label={tr('수수료율 (%)', 'Commission (%)')} htmlFor="sf-cr"><AInput id="sf-cr" type="number" min={0} max={100} value={f.CommissionRatio} onChange={(e) => setF({ ...f, CommissionRatio: e.target.value })} /></FieldRow> : null}
          <FieldRow label={tr('사용 유무', 'Active')}><ASelect aria-label={tr('사용 유무', 'Active')} value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value as 'Y' | 'N' })} options={[{ value: 'Y', label: tr('사용', 'Yes') }, { value: 'N', label: tr('미사용', 'No') }]} /></FieldRow>
        </div>
      </DetailDrawer>

      <ConfirmDialog open={delOpen} title={tr('운영자 삭제', 'Delete operator')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} body={<p>{tr('삭제 처리(Del=Y)합니다. 아이디는 다시 사용할 수 없습니다.', 'Marks the operator deleted (Del=Y). The ID cannot be reused.')} <b>{sel?.id}</b></p>} />
      <ConfirmDialog open={pwOpen} title={tr('비밀번호 초기화', 'Reset password')} loading={resetPw.isPending} onCancel={() => setPwOpen(false)} onConfirm={() => resetPw.mutate(undefined as never)}
        body={<div><p>{tr('비워 두면 기존 사이트와 같이 1111로 초기화됩니다.', 'Leave empty to reset to 1111 like the legacy site.')}</p><div className="u-mt-8"><AInput type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tr('새 비밀번호 (선택)', 'New password (optional)')} maxLength={64} /></div></div>} />
    </AdminPage>
  );
}
