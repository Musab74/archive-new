import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { StaffRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, YnBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError, refreshAdminAccessToken } from '../../../../shared/api/client';
import { adminTokenStore } from '../../../../shared/auth/adminTokenStore';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { staffParityApi, type IdCheck } from './staffApi';
import { StaffDeptPicker } from './StaffDeptPicker';
import { BANKS, STAFF_DEPT_TEXT, emptyStaffForm, emptyStaffText, joinPhone, staffListAllowed, splitPhone, validateStaffForm, type StaffDept, type StaffFormValues } from './staffParity';

const DEPT: Record<string, { label: string; grant: string; titleEn: string }> = { A: { label: '관리자 리스트', grant: 'A6', titleEn: 'Administrators' }, B: { label: '영업자 리스트', grant: 'A7', titleEn: 'Sales staff' }, C: { label: '첨삭강사 리스트', grant: 'A8', titleEn: 'Tutors' } };
/** staffNN.php: the search select starts on 이름; include_top.php $page_size = 30. */
const DEFAULTS = { col: 'Name', q: '', useYN: '', page: 1 };
const SIZE = 30;
const LOGIN_SIZE = 20;
const fromRow = (r: StaffRow): StaffFormValues => {
  const [m1, m2, m3] = splitPhone(r.mobile); const [p1, p2, p3] = splitPhone(r.phone);
  return { ID: r.id, Pwd: '', Dept_idx: String(r.deptIdx), Name: r.name ?? '', Team: r.team ?? '', Mobile1: m1, Mobile2: m2, Mobile3: m3, Phone1: p1, Phone2: p2, Phone3: p3, Email: r.email ?? '', BankName: r.bankName ?? '', BankNumber: r.bankNumber ?? '', UseYN: r.useYN === 'N' ? 'N' : 'Y', CommissionRatio: r.commissionRatio === null || r.commissionRatio === undefined ? '' : String(r.commissionRatio) };
};

/** staff01/02/03.php — one page per department (A 관리자, B 영업자, C 첨삭강사). */
export default function StaffListPage() {
  const { dept = 'A' } = useParams();
  const meta = DEPT[dept] ?? DEPT.A!;
  const code = (dept in DEPT ? dept : 'A') as StaffDept;
  return <StaffListGate dept={code}><StaffList key={dept} dept={code} title={tr(meta.label, meta.titleEn)} /></StaffListGate>;
}

/** Exact sub-menu grant (A6/A7/A8) for non-A departments, like include_submenu.php and the API's canManageStaffDept. */
function StaffListGate({ dept, children }: { dept: StaffDept; children: ReactNode }) {
  const { admin } = useAdminSession();
  if (!staffListAllowed(admin, dept)) return <StateBlock code="NO_ACCESS" page title={adm.noGrant.title} body={adm.noGrant.body} hideActions />;
  return <>{children}</>;
}

function PhoneBoxes({ id, label, parts, onChange }: { id: string; label: string; parts: [string, string, string]; onChange: (p: [string, string, string]) => void }) {
  const set = (i: number, v: string) => { const next = [...parts] as [string, string, string]; next[i] = v.replace(/\D/g, ''); onChange(next); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <AInput id={id} aria-label={`${label} 1`} value={parts[0]} onChange={(e) => set(0, e.target.value)} maxLength={3} inputMode="numeric" style={{ width: 70 }} /> -
      <AInput aria-label={`${label} 2`} value={parts[1]} onChange={(e) => set(1, e.target.value)} maxLength={4} inputMode="numeric" style={{ width: 80 }} /> -
      <AInput aria-label={`${label} 3`} value={parts[2]} onChange={(e) => set(2, e.target.value)} maxLength={4} inputMode="numeric" style={{ width: 80 }} />
    </div>
  );
}

function StaffList({ dept, title }: { dept: StaffDept; title: string }) {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q, useYN: p.useYN });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const { admin } = useAdminSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const deptName = STAFF_DEPT_TEXT[dept].name;
  const query = useMemo(() => ({ dept, col: p.col, q: p.q || undefined, useYN: p.useYN || undefined, page: p.page, size: SIZE }), [dept, p]);
  const list = useQuery({ queryKey: ['admin', 'staff-members', query], queryFn: ({ signal }) => adminApi.staffMembers(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;

  const [sel, setSel] = useState<StaffRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'staff-member', sel?.idx], queryFn: ({ signal }) => adminApi.staffMember(sel!.idx, signal), enabled: !!sel });
  const [loginPage, setLoginPage] = useState(1);
  useEffect(() => setLoginPage(1), [sel?.idx]);
  const logins = useQuery({ queryKey: ['admin', 'staff-member', sel?.idx, 'logins', loginPage], queryFn: ({ signal }) => staffParityApi.logins(sel!.idx, loginPage, LOGIN_SIZE, signal), enabled: !!sel, placeholderData: keepPreviousData });

  const [editOpen, setEditOpen] = useState<'create' | 'edit' | null>(null);
  const [f, setF] = useState<StaffFormValues>(emptyStaffForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idCheck, setIdCheck] = useState<IdCheck | null>(null);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const initial = (): StaffFormValues => (editOpen === 'edit' && sel ? fromRow(sel) : emptyStaffForm());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setF(initial()); setErrors({}); setIdCheck(null); }, [editOpen, sel]);
  const onErr = (err: unknown) => { setSaveConfirm(false); if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  const inv = [['admin', 'staff-members'], ['admin', 'departments'], ['admin', 'staff'], ['admin', 'staff-categories']];
  const done = () => { setSaveConfirm(false); setEditOpen(null); };
  const create = useAdminMutation({ fn: (b: Record<string, unknown>) => adminApi.createStaff(b), invalidate: inv, success: adm.common.created, onSuccess: done, onError: onErr });
  const patch = useAdminMutation({ fn: (b: Record<string, unknown>) => adminApi.patchStaff(sel!.idx, b), invalidate: [...inv, ['admin', 'staff-member', sel?.idx]], success: adm.common.saved, onSuccess: done, onError: onErr });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminApi.deleteStaff(sel!.idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDelOpen(false); setSel(null); } });
  const [pwOpen, setPwOpen] = useState(false); const [pw, setPw] = useState('');
  const resetPw = useAdminMutation({ fn: () => adminApi.resetStaffPassword(sel!.idx, pw.trim() || undefined), success: tr('비밀번호가 초기화되었습니다.', 'Password reset.'), onSuccess: () => { setPwOpen(false); setPw(''); } });
  const [asOpen, setAsOpen] = useState(false);
  const [asBusy, setAsBusy] = useState(false);
  const loginAs = async () => {
    if (!sel) return;
    setAsBusy(true);
    try {
      const r = await staffParityApi.loginAs(sel.idx);
      adminTokenStore.set(r.accessToken, r.expiresIn);
      await refreshAdminAccessToken(); // the refresh cookie now belongs to the new identity → updates the session state
      qc.clear();
      setAsOpen(false);
      navigate('/admin');
    } catch (err) {
      toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
    } finally { setAsBusy(false); }
  };
  const canLoginAs = canWrite && admin?.dept === 'A';
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => { setExporting(true); try { await staffParityApi.downloadStaffCsv({ dept, col: p.col, q: p.q || undefined, useYN: p.useYN || undefined }); } catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); } finally { setExporting(false); } };

  const runIdCheck = async () => {
    try { setIdCheck(await staffParityApi.idCheck(f.ID.trim())); } catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
  };
  const submit = () => {
    const e = validateStaffForm(f, editOpen === 'create' ? 'create' : 'edit', dept);
    setErrors(e);
    const first = Object.values(e)[0];
    if (first) { toast(first, { tone: 'danger' }); return; }
    setSaveConfirm(true);
  };
  const save = () => {
    const body: Record<string, unknown> = {
      Dept_idx: Number(f.Dept_idx), Name: f.Name.trim(), Team: f.Team.trim(), Mobile: joinPhone(f.Mobile1, f.Mobile2, f.Mobile3), Phone: joinPhone(f.Phone1, f.Phone2, f.Phone3) || null, Email: f.Email.trim(), UseYN: f.UseYN,
    };
    if (dept !== 'A') { body.BankName = f.BankName || null; body.BankNumber = f.BankNumber.trim() || null; }
    if (dept === 'B') body.CommissionRatio = Number(f.CommissionRatio.trim());
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
    { key: 'lastLogin', header: tr('최근 로그인', 'Last login'), nowrap: true, render: (r) => r.lastLogin ?? '' },
    { key: 'lastLoginIp', header: tr('최근 로그인 IP', 'Last IP'), nowrap: true, render: (r) => <span className="mono">{r.lastLoginIp ?? ''}</span> },
    ...(dept === 'B' ? [{ key: 'commissionRatio', header: tr('수수료율', 'Commission'), align: 'right' as const, render: (r: StaffRow) => r.commissionRatio === null || r.commissionRatio === undefined ? '' : `${r.commissionRatio}%` }] : []),
    { key: 'useYN', header: tr('사용 유무', 'Active'), align: 'center', render: (r) => <YnBadge value={r.useYN} /> },
  ];
  const d = detail.data;
  const bank = (s: { bankName?: string | null; bankNumber?: string | null }) => [s.bankName, s.bankNumber].filter(Boolean).join(' ');
  const formTitle = editOpen === 'create' ? tr(`${deptName} 등록`, `New ${STAFF_DEPT_TEXT[dept].nameEn}`) : tr(`${deptName} 수정`, `Edit ${STAFF_DEPT_TEXT[dept].nameEn}`);
  return (
    <AdminPage title={title} lead={tr('기존 운영자 목록과 같은 항목입니다. 행을 누르면 상세·로그인 내역이 열립니다.', 'Same columns as the legacy list. Click a row for details and login history.')}
      actions={<>
        {dept === 'B' && canWrite ? <AButton icon="download" loading={exporting} onClick={() => void exportCsv()}>{tr('검색항목 엑셀 출력', 'Export search results')}</AButton> : null}
        <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setEditOpen('create'); }}>{tr('신규 등록', 'New')}</AButton>
      </>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'Name', q: '', useYN: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="st-col" width={130}><ASelect id="st-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Name', label: tr('이름', 'Name') }, { value: 'ID', label: tr('아이디', 'User ID') }, { value: 'Mobile', label: tr('휴대폰', 'Mobile') }, { value: 'Team', label: tr('소속', 'Team') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="st-q" width={240}><AInput id="st-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={tr('사용 유무', 'Active')} htmlFor="st-use" width={120}><ASelect id="st-use" value={form.useYN} onChange={(e) => setForm({ ...form, useYN: e.target.value })} options={[{ value: '', label: adm.common.all }, { value: 'Y', label: tr('사용', 'Yes') }, { value: 'N', label: tr('미사용', 'No') }]} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={emptyStaffText(dept)} dense />

      <DetailDrawer open={!!sel && !editOpen} onClose={() => setSel(null)} title={sel ? `${sel.name ?? ''} (${sel.id})` : ''} subtitle={tr(`${deptName} 상세 내용`, `${STAFF_DEPT_TEXT[dept].nameEn} details`)} wide
        footer={<>
          <AButton onClick={() => setSel(null)}>{adm.common.close}</AButton>
          <AButton variant="danger" disabled={!canWrite} onClick={() => setDelOpen(true)}>{adm.common.delete}</AButton>
          <AButton disabled={!canWrite} onClick={() => setPwOpen(true)}>{tr('비밀번호 초기화', 'Reset password')}</AButton>
          <AButton disabled={!canLoginAs} title={canLoginAs ? undefined : tr('관리자 부서 계정만 사용할 수 있습니다.', 'Administrator department only.')} onClick={() => setAsOpen(true)}>{tr('현재 아이디로 로그인', 'Log in as this ID')}</AButton>
          <AButton variant="primary" disabled={!canWrite} onClick={() => setEditOpen('edit')}>{tr('정보 수정', 'Edit')}</AButton>
        </>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={tr('기본 정보', 'Profile')}>
              <DescList items={[
                [tr('아이디', 'User ID'), d.staff.id], [tr('이름', 'Name'), d.staff.name], [tr('카테고리', 'Category'), d.staff.deptPath || d.staff.deptName], [tr('소속', 'Team'), d.staff.team],
                [tr('휴대폰', 'Mobile'), d.staff.mobile], [tr('연락처', 'Phone'), d.staff.phone], [tr('이메일', 'E-mail'), d.staff.email], [tr('사용 유무', 'Active'), <YnBadge key="u" value={d.staff.useYN} />],
                ...(dept !== 'A' ? [[tr('계좌정보', 'Bank account'), bank(d.staff)] as [string, string]] : []),
                ...(dept === 'B' ? [[tr('영업자 수수료율', 'Commission'), d.staff.commissionRatio === null || d.staff.commissionRatio === undefined ? null : `${d.staff.commissionRatio} %`] as [string, string | null]] : []),
                [tr('등록일', 'Registered'), d.staff.regDate], [tr('최근 로그인', 'Last login'), d.staff.lastLogin ? `${d.staff.lastLogin} (${d.staff.lastLoginIp ?? ''})` : null],
              ]} />
            </Card>
            <Card title={`${tr('로그인 내역', 'Login history')} (${(logins.data?.total ?? d.loginCount).toLocaleString()})`}>
              <DataTable columns={[
                { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 70, render: (r) => r.no },
                { key: 'at', header: tr('로그인 시각', 'Login time'), nowrap: true, render: (r) => r.at ?? '' },
                { key: 'ip', header: tr('아이피', 'IP'), render: (r) => <span className="mono">{r.ip ?? ''}</span> },
                { key: 'device', header: tr('기기', 'Device'), render: (r) => r.device ?? '' },
              ]} rows={logins.data?.items} rowKey={(r) => r.no} loading={logins.isPending} error={logins.error} page={loginPage} size={LOGIN_SIZE} total={logins.data?.total ?? 0} onPageChange={setLoginPage} emptyTitle={tr('로그인 내역이 없습니다.', 'No logins.')} dense />
            </Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      <DetailDrawer open={!!editOpen} onClose={() => setEditOpen(null)} title={formTitle} subtitle={title}
        footer={<>
          <AButton onClick={() => setEditOpen(null)}>{adm.common.cancel}</AButton>
          <AButton onClick={() => { setF(initial()); setErrors({}); setIdCheck(null); }}>{tr('다시 작성', 'Reset form')}</AButton>
          <AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{editOpen === 'create' ? tr('등록', 'Register') : tr('수정', 'Save')}</AButton>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editOpen === 'edit' ? <FieldRow label={tr('등록된 카테고리', 'Current category')}><div style={{ paddingTop: 8 }} data-testid="registered-category">{d?.staff.deptPath || d?.staff.deptName || sel?.deptName || ''}</div></FieldRow> : null}
          <FieldRow label={tr('카테고리', 'Category')} required error={errors.Dept_idx}><StaffDeptPicker dept={dept} value={f.Dept_idx} invalid={!!errors.Dept_idx} onChange={(idx) => setF({ ...f, Dept_idx: idx })} /></FieldRow>
          {editOpen === 'create' ? (<>
            <FieldRow label={tr('아이디', 'User ID')} htmlFor="sf-id" required error={errors.ID}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <AInput id="sf-id" value={f.ID} onChange={(e) => { setF({ ...f, ID: e.target.value }); setIdCheck(null); }} maxLength={30} autoComplete="off" style={{ maxWidth: 240 }} />
                <AButton size="sm" onClick={() => void runIdCheck()}>{tr('중복 검색', 'Check ID')}</AButton>
                {idCheck ? <span role="status" style={{ color: idCheck.valid && idCheck.available ? 'var(--c-primary)' : 'var(--c-danger)', fontWeight: 600 }}>{idCheck.message}</span> : null}
              </div>
            </FieldRow>
          </>) : <FieldRow label={tr('아이디', 'User ID')}><div style={{ paddingTop: 8 }}><b className="mono">{f.ID}</b></div></FieldRow>}
          <FieldRow label={tr('이름', 'Name')} htmlFor="sf-name" required error={errors.Name}><AInput id="sf-name" value={f.Name} onChange={(e) => setF({ ...f, Name: e.target.value })} maxLength={50} /></FieldRow>
          <FieldRow label={tr('소속', 'Team')} htmlFor="sf-team" required error={errors.Team}><AInput id="sf-team" value={f.Team} onChange={(e) => setF({ ...f, Team: e.target.value })} maxLength={50} /></FieldRow>
          {editOpen === 'create' ? <FieldRow label={tr('비밀번호', 'Password')} htmlFor="sf-pw" required error={errors.Pwd}><AInput id="sf-pw" type="text" value={f.Pwd} onChange={(e) => setF({ ...f, Pwd: e.target.value })} maxLength={64} autoComplete="off" /></FieldRow> : null}
          <FieldRow label={tr('휴대폰', 'Mobile')} htmlFor="sf-mob" required error={errors.Mobile}><PhoneBoxes id="sf-mob" label={tr('휴대폰', 'Mobile')} parts={[f.Mobile1, f.Mobile2, f.Mobile3]} onChange={([a, b, c]) => setF({ ...f, Mobile1: a, Mobile2: b, Mobile3: c })} /></FieldRow>
          <FieldRow label={tr('연락처', 'Phone')} htmlFor="sf-tel"><PhoneBoxes id="sf-tel" label={tr('연락처', 'Phone')} parts={[f.Phone1, f.Phone2, f.Phone3]} onChange={([a, b, c]) => setF({ ...f, Phone1: a, Phone2: b, Phone3: c })} /></FieldRow>
          <FieldRow label={tr('이메일', 'E-mail')} htmlFor="sf-email" required error={errors.Email}><AInput id="sf-email" value={f.Email} onChange={(e) => setF({ ...f, Email: e.target.value })} maxLength={50} /></FieldRow>
          {dept !== 'A' ? (
            <FieldRow label={tr('계좌정보', 'Bank account')} htmlFor="sf-bank">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <ASelect id="sf-bank" aria-label={tr('은행명', 'Bank')} value={f.BankName} onChange={(e) => setF({ ...f, BankName: e.target.value })} placeholder={tr('-- 은행 선택 --', '-- choose a bank --')}
                  options={[...BANKS.map((b) => ({ value: b, label: b })), ...(f.BankName && !(BANKS as readonly string[]).includes(f.BankName) ? [{ value: f.BankName, label: f.BankName }] : [])]} />
                <AInput aria-label={tr('계좌번호', 'Account no.')} value={f.BankNumber} onChange={(e) => setF({ ...f, BankNumber: e.target.value })} maxLength={50} />
              </div>
            </FieldRow>
          ) : null}
          {dept === 'B' ? <FieldRow label={tr('영업자 수수료율 (%)', 'Commission (%)')} htmlFor="sf-cr" required error={errors.CommissionRatio}><AInput id="sf-cr" inputMode="numeric" value={f.CommissionRatio} onChange={(e) => setF({ ...f, CommissionRatio: e.target.value })} maxLength={3} style={{ width: 100 }} /></FieldRow> : null}
          <FieldRow label={tr('사용 여부', 'Active')}><ASelect aria-label={tr('사용 여부', 'Active')} value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value as 'Y' | 'N' })} options={[{ value: 'Y', label: tr('사용', 'Yes') }, { value: 'N', label: tr('미사용', 'No') }]} /></FieldRow>
        </div>
      </DetailDrawer>

      <ConfirmDialog open={saveConfirm} title={formTitle} tone="info" loading={create.isPending || patch.isPending} onCancel={() => setSaveConfirm(false)} onConfirm={save}
        body={<p>{create.isPending || patch.isPending ? tr('처리중입니다...', 'Processing…') : tr('등록하시겠습니까?', 'Save this record?')}</p>} />
      <ConfirmDialog open={delOpen} title={tr(`${deptName} 삭제`, 'Delete')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} body={<p>{tr(`현재 ${deptName}를 삭제하시겠습니까?`, 'Delete this operator?')} <b>{sel?.id}</b><br /><span className="muted">{tr('삭제 처리(Del=Y)합니다. 아이디는 다시 사용할 수 없습니다.', 'Marks the operator deleted (Del=Y). The ID cannot be reused.')}</span></p>} />
      <ConfirmDialog open={pwOpen} title={tr('비밀번호 초기화', 'Reset password')} loading={resetPw.isPending} onCancel={() => setPwOpen(false)} onConfirm={() => resetPw.mutate(undefined as never)}
        body={<div><p>{tr('비워 두면 기존 사이트와 같이 1111로 초기화됩니다.', 'Leave empty to reset to 1111 like the legacy site.')}</p><div className="u-mt-8"><AInput type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tr('새 비밀번호 (선택)', 'New password (optional)')} maxLength={64} /></div></div>} />
      <ConfirmDialog open={asOpen} title={tr('현재 아이디로 로그인', 'Log in as this ID')} tone="warn" loading={asBusy} onCancel={() => setAsOpen(false)} onConfirm={() => void loginAs()}
        body={<p>{tr(`[${sel?.id ?? ''}]로 로그인 하시겠습니까?`, `Log in as [${sel?.id ?? ''}]?`)}<br /><span className="muted">{tr('현재 관리자 세션이 이 계정으로 바뀝니다.', 'Your admin session switches to this account.')}</span></p>} />
    </AdminPage>
  );
}
