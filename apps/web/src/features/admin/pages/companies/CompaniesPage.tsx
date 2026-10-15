import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { CompanyRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ConfirmDialog, DataTable, DetailDrawer, FilterBar, FilterField, StatusBadge, type Column, type SortState } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { CompanyForm, emptyValues, toCreateBody, validateCompanyForm, type CompanyFormValues, type FormErrors } from './CompanyForm';

const DEFAULTS = { q: '', col: 'all', scale: '', salesManager: '', sendSMS: '', sort: 'name', page: 1 };
const SIZE = 20;
/** Column → server sort key (DataTable header click). */
const SORT_KEYS: Record<string, string> = { companyName: 'name', regDate: 'recent', bizNo: 'code' };
const SORT_COLS: Record<string, string> = { name: 'companyName', recent: 'regDate', code: 'bizNo' };

export default function CompaniesPage() {
  const s = adm.companies;
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q, col: p.col, scale: p.scale, salesManager: p.salesManager, sendSMS: p.sendSMS });
  const navigate = useNavigate();
  const location = useLocation();
  /** company_read.php 목록 keeps pg/sw/col: the detail page returns to this exact list URL. */
  const openDetail = (idx: number) => navigate(`/admin/companies/${idx}`, { state: { listSearch: location.search } });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ q: p.q || undefined, col: p.col, scale: p.scale || undefined, salesManager: p.salesManager || undefined, sendSMS: p.sendSMS || undefined, sort: p.sort, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'companies', query], queryFn: ({ signal }) => adminApi.companies(query, signal), placeholderData: keepPreviousData });
  const meta = useQuery({ queryKey: ['admin', 'companies', 'meta'], queryFn: ({ signal }) => adminApi.companyMeta(signal), staleTime: 5 * 60_000 });
  const total = list.data?.total ?? 0;
  const firstNo = total - (p.page - 1) * SIZE;

  const c = s.cols;
  const columns: Column<CompanyRow>[] = [
    { key: 'no', header: c.no, align: 'right', width: 64, render: (_r, i) => firstNo - i },
    { key: 'bizNo', header: c.bizNo, sortable: true, nowrap: true, render: (r) => <span className="mono" title={r.companyCode}>{r.bizNo}</span> },
    { key: 'companyName', header: c.name, sortable: true, render: (r) => <b>{r.companyName}</b> },
    { key: 'scaleLabel', header: c.scale, nowrap: true },
    { key: 'eduManager', header: c.eduManager, render: (r) => r.eduManager ?? '' },
    { key: 'eduManagerPhone', header: c.eduPhone, nowrap: true, render: (r) => r.eduManagerPhone ?? '' },
    { key: 'eduManagerEmail', header: c.eduEmail, render: (r) => r.eduManagerEmail ?? '' },
    { key: 'salesName', header: c.sales, nowrap: true, render: (r) => r.salesName ? <span title={r.salesManager ?? ''}>{r.salesName}</span> : <span className="muted" title={tr('영업담당자 계정 없음', 'no staff account')}>{r.salesManager ?? ''}</span> },
    { key: 'salesTeam', header: c.salesTeam, render: (r) => r.salesTeam ?? '' },
    { key: 'manageCode', header: c.manageCode, nowrap: true, render: (r) => <span className="mono">{r.manageCode ?? ''}</span> },
    { key: 'companyId', header: c.companyId, nowrap: true, render: (r) => <span className="mono">{r.companyId ?? ''}</span> },
    { key: 'sendSMS', header: c.sendSMS, align: 'center', render: (r) => <StatusBadge tone={r.sendSMS === 'N' ? 'warn' : 'ok'}>{r.sendSMSLabel}</StatusBadge> },
    { key: 'regDate', header: c.regDate, sortable: true, nowrap: true, render: (r) => (r.regDate ?? '').slice(0, 10) },
  ];
  const sort: SortState | null = SORT_COLS[p.sort] ? { key: SORT_COLS[p.sort]!, dir: p.sort === 'recent' ? 'desc' : 'asc' } : null;
  const onSortChange = useCallback((next: SortState | null) => { const key = next ? SORT_KEYS[next.key] : undefined; setP({ sort: key ?? 'name' }, true); }, [setP]);

  // export
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try { await adminApi.downloadCompaniesCsv({ q: query.q, col: query.col, scale: query.scale, salesManager: query.salesManager, sendSMS: query.sendSMS, sort: query.sort }); }
    catch (err) { toast(isAppError(err) ? err.message : s.actions.exportFailed, { tone: 'danger' }); }
    finally { setExporting(false); }
  };

  // create drawer
  const [createOpen, setCreateOpen] = useState(false);
  const [values, setValues] = useState<CompanyFormValues>(emptyValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [availBlocked, setAvailBlocked] = useState(false);
  const create = useAdminMutation({
    fn: (body: Record<string, unknown>) => adminApi.createCompany(body), invalidate: [['admin', 'companies']], success: s.form.created,
    onSuccess: (r) => { setConfirmOpen(false); setCreateOpen(false); setValues(emptyValues()); if (r.idx) openDetail(r.idx); },
    onError: (err) => {
      setConfirmOpen(false);
      if (isAppError(err) && Array.isArray(err.details)) { const e: FormErrors = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path as keyof FormErrors] = d.message ?? ''; setErrors(e); }
      toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
    },
  });
  // company_write.php: validate, then confirm('등록 하시겠습니까?') before submitting; '다시 작성' restores the blank form.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submitCreate = () => { const e = validateCompanyForm(values, 'create'); setErrors(e); if (Object.keys(e).length || availBlocked) return; setConfirmOpen(true); };
  const resetCreate = () => { setValues(emptyValues()); setErrors({}); };

  const salesOptions = useMemo(() => [{ value: '', label: adm.common.all }, ...(meta.data?.salesManagers ?? []).map((m) => ({ value: m.id, label: `${m.name ?? m.id} (${m.team ?? m.deptName ?? m.id})` }))], [meta.data]);
  const scaleOptions = useMemo(() => [{ value: '', label: tr('-회사규모 선택-', '- any size -') }, ...(meta.data?.scales ?? [])], [meta.data]);

  return (
    <AdminPage title={s.title} lead={s.lead}
      actions={<><AButton to="/admin/companies/import" disabled={!canWrite} title={readOnlyTitle}>{s.actions.import}</AButton><AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setValues(emptyValues()); setErrors({}); setCreateOpen(true); }}>{s.actions.new}</AButton></>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '', col: 'all', scale: '', salesManager: '', sendSMS: '' }); reset(); }}
        extra={canWrite ? <AButton onClick={() => void exportCsv()} loading={exporting} disabled={!list.data || total === 0}>{s.actions.export}</AButton> : undefined}>
        <FilterField label={s.filters.scale} htmlFor="co-scale" width={170}><ASelect id="co-scale" value={form.scale} onChange={(e) => setForm({ ...form, scale: e.target.value })} options={scaleOptions} /></FilterField>
        <FilterField label={s.filters.col} htmlFor="co-col" width={130}><ASelect id="co-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={s.searchCols} /></FilterField>
        <FilterField label={s.filters.q} htmlFor="co-q" width={260}><AInput id="co-q" value={form.q} placeholder={tr('검색어를 입력하세요', 'Enter a keyword')} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={s.filters.salesManager} htmlFor="co-sales" width={200}><ASelect id="co-sales" value={form.salesManager} onChange={(e) => setForm({ ...form, salesManager: e.target.value })} options={salesOptions} /></FilterField>
        <FilterField label={s.filters.sendSMS} htmlFor="co-sms" width={120}><ASelect id="co-sms" value={form.sendSMS} onChange={(e) => setForm({ ...form, sendSMS: e.target.value })} options={[{ value: '', label: adm.common.all }, ...(meta.data?.sendSMS ?? [{ value: 'Y', label: '수신허용' }, { value: 'N', label: '수신거부' }])]} /></FilterField>
        <FilterField label={s.filters.sort} htmlFor="co-sort" width={130}><ASelect id="co-sort" value={p.sort} onChange={(e) => setP({ sort: e.target.value }, true)} options={s.sorts} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={s.empty}
        sort={sort} onSortChange={onSortChange} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => openDetail(r.idx)} dense />

      <DetailDrawer open={createOpen} onClose={() => setCreateOpen(false)} title={s.form.createTitle} wide
        footer={<><AButton onClick={() => setCreateOpen(false)}>{adm.common.cancel}</AButton><AButton onClick={resetCreate} disabled={!canWrite}>{tr('다시 작성', 'Reset')}</AButton><AButton variant="primary" loading={create.isPending} disabled={!canWrite || availBlocked} title={readOnlyTitle} onClick={submitCreate}>{adm.common.create}</AButton></>}>
        <CompanyForm mode="create" values={values} onChange={setValues} meta={meta.data} errors={errors} onAvailability={setAvailBlocked} disabled={!canWrite} />
      </DetailDrawer>
      <ConfirmDialog open={confirmOpen} tone="info" title={tr('등록 하시겠습니까?', 'Register this company?')} body={<p>{values.CompanyName} <span className="mono">{values.CompanyCode}</span></p>} confirmLabel={adm.common.create}
        loading={create.isPending} onCancel={() => setConfirmOpen(false)} onConfirm={() => create.mutate(toCreateBody(values))} />
    </AdminPage>
  );
}
