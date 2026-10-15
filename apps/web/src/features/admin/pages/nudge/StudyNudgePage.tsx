import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminNudgeApi, type NudgeTarget, type SendItem } from '../../../../shared/api/endpoints/admin-nudge';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Bar, Callout, Card, ConfirmDialog, DataTable, DateField, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { HOUR_OPTIONS, MONTH_OPTIONS, MessageBlock, SendStubCallout, YEAR_OPTIONS, addDaysIso, todayIso } from './nudgeShared';
import { InfoLink, useNudgeInfo } from './nudgeInfo';

const thisYear = String(new Date().getFullYear());
const thisMonth = String(new Date().getMonth() + 1).padStart(2, '0');
const DEFAULTS = {
  s: 0, gubun: 'A', year: thisYear, month: thisMonth, period: '', companyCode: '', companyName: '', openChapter: '', abilityYN: '', abilityAfterYN: '', q: '', salesId: '', salesTeam: '', progress1: '', progress2: '',
  lectureCode: '', eduManager: '', tutorStatus: '', passOk: '', serviceType: '', certCount: '', page: 1, size: 30,
};
type Form = Omit<typeof DEFAULTS, 's' | 'page' | 'size'>;
/** The PHP list prints every row on one page; here up to 500 per page (one batch still sends to at most 200). */
const SIZE_OPTIONS = [30, 100, 200, 500];
/** Client chunk per POST /admin/nudge/send so the 진행률 can move (the PHP called study_sms_batch_process.php once per row, 800 ms apart). */
const BATCH_CHUNK = 10;
const YN = [{ value: '', label: tr('전체', 'All') }, { value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }];
const pick = (p: typeof DEFAULTS): Form => { const { s: _s, page: _p, size: _z, ...rest } = p; return rest; };
type RowStatus = SendItem | 'error';

/** function.js StudySmsSearch() checks before the search request. */
export function nudgeSearchError(f: Pick<Form, 'gubun' | 'companyName' | 'openChapter'>): string | null {
  if (f.gubun === 'B' && !f.companyName.trim()) return tr('사업주명을 입력하세요.', 'Enter a company name.');
  if (f.openChapter !== '' && !/^\d+$/.test(f.openChapter)) return tr('실시회차는 숫자만 입력하세요.', 'Round must be a number.');
  if (f.openChapter !== '' && Number(f.openChapter) < 1) return tr('실시회차는 1이상 숫자만 입력하세요.', 'Round must be 1 or more.');
  return null;
}

/** study_company_search_autocomplete.php: the typed text in red bold inside each company name. */
export function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const parts = text.split(q);
  return parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 ? <b style={{ color: '#db2400' }}>{q}</b> : null}</span>);
}

/** study_sms.php + study_sms_search_result.php — 학습참여독려 (C1). */
export default function StudyNudgePage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState<Form>(pick(p));
  const { toast } = useToast();
  const qc = useQueryClient();
  const info = useNudgeInfo();
  const meta = useQuery({ queryKey: ['admin', 'nudge', 'meta'], queryFn: ({ signal }) => adminNudgeApi.meta(signal), staleTime: 5 * 60_000 });

  // 기간 선택 (study_lectureterme.php) and 사업주 선택 (study_lectureterme_company.php) for 기간 검색; 사업주 검색 lists the company's own terms.
  const termsKey = form.gubun === 'B' ? { year: form.year, month: form.month || undefined, companyCode: form.companyCode || undefined } : { year: form.year, month: form.month || undefined };
  const terms = useQuery({ queryKey: ['admin', 'nudge', 'terms', termsKey], queryFn: ({ signal }) => adminNudgeApi.terms(termsKey, signal), enabled: form.gubun === 'A' || !!form.companyCode });
  const periodSel = useMemo(() => { const m = /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/.exec(form.period); return m ? { lectureStart: m[1]!, lectureEnd: m[2]! } : null; }, [form.period]);
  const termCompanies = useQuery({ queryKey: ['admin', 'nudge', 'term-companies', periodSel], queryFn: ({ signal }) => adminNudgeApi.termCompanies(periodSel!, signal), enabled: form.gubun === 'A' && !!periodSel });
  const [companyQ, setCompanyQ] = useState(form.companyName);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(companyQ.replace(/\s/g, '') ? companyQ : ''), 300); return () => clearTimeout(t); }, [companyQ]);
  const suggestions = useQuery({ queryKey: ['admin', 'nudge', 'company-search', debouncedQ], queryFn: ({ signal }) => adminNudgeApi.companySearch(debouncedQ, signal), enabled: form.gubun === 'B' && suggestOpen && debouncedQ.length > 0 });

  const query = useMemo(() => ({ ...Object.fromEntries(Object.entries(pick(p)).map(([k, v]) => [k, v === '' ? undefined : v])), page: p.page, size: p.size }), [p]);
  const list = useQuery({ queryKey: ['admin', 'nudge', 'targets', query], queryFn: ({ signal }) => adminNudgeApi.targets(query, signal), enabled: p.s === 1, placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * p.size;
  const rows = list.data?.items ?? [];

  // selection + per-row 상태 survive page changes (PHP had one page); every 검색 (and any filter change) clears them
  const filterKey = useMemo(() => JSON.stringify(pick(p)), [p]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState<Record<number, RowStatus>>({});
  const [batchRan, setBatchRan] = useState(false);
  const clearSelection = () => { setChecked(new Set()); setStatus({}); setBatchRan(false); };
  useEffect(clearSelection, [filterKey]);
  const modes = useMemo(() => (meta.data?.modes ?? []).filter((m) => m.mode !== 'edu' || p.eduManager === 'Y'), [meta.data, p.eduManager]);
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.seq));
  const toggleAll = () => setChecked((s) => { const n = new Set(s); if (allChecked) for (const r of rows) n.delete(r.seq); else for (const r of rows) n.add(r.seq); return n; });
  const toggle = (seq: number) => setChecked((s) => { const n = new Set(s); if (n.has(seq)) n.delete(seq); else n.add(seq); return n; });
  const bulkMax = meta.data?.bulkMax ?? 200;

  // preview / individual send (study_sms_ea.php)
  const [prev, setPrev] = useState<{ seq: number; mode: string } | null>(null);
  const preview = useQuery({ queryKey: ['admin', 'nudge', 'preview', prev], queryFn: ({ signal }) => adminNudgeApi.preview(prev!.seq, prev!.mode, signal), enabled: !!prev });
  const [sendMode, setSendMode] = useState<'sms' | 'email'>('sms');
  const [text, setText] = useState('');
  useEffect(() => { if (preview.data) { setText(preview.data.templateMessage); setSendMode('sms'); } }, [preview.data]);
  const [oneResult, setOneResult] = useState<SendItem | null>(null);
  const [confirmOne, setConfirmOne] = useState(false);
  const sendOne = useAdminMutation({
    fn: () => adminNudgeApi.sendOne(prev!.seq, { mode: prev!.mode, sendMode, message: text }), invalidate: [['admin', 'nudge', 'alarm-log'], ['admin', 'nudge', 'mail-log']],
    // study_sms_ea_script.php: alert('발송되었습니다.') and close, or alert('오류가 발생했습니다.') and keep the popup
    success: (r) => r.ok ? tr('발송되었습니다.', 'Sent.') : r.code === 'SEND_NOT_CONFIGURED' ? tr('발송 로그만 기록되었습니다 (발송 설정 없음).', 'Logged only (sending not configured).') : tr('오류가 발생했습니다.', 'An error occurred.'),
    onSuccess: (r) => { setConfirmOne(false); setOneResult(r); setStatus((s) => ({ ...s, [r.seq]: r })); if (r.ok) setPrev(null); },
    onError: (e) => { setConfirmOne(false); toast(isAppError(e) ? e.message : tr('오류가 발생했습니다.', 'An error occurred.'), { tone: 'danger' }); },
  });
  const openPreview = (seq: number, m: string) => { setOneResult(null); setPrev({ seq, mode: m }); };

  // batch send (study_sms_batch_process.php per checked row) — chunked so the 진행률 moves and 상태 fills in as each chunk returns
  const [batch, setBatch] = useState<'sms' | 'email' | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelled = useRef(false);
  useEffect(() => { cancelled.current = false; return () => { cancelled.current = true; }; }, []);
  const runBatch = async (m: 'sms' | 'email') => {
    const seqs = [...checked];
    setBatch(null); setBatchRan(true); setProgress({ done: 0, total: seqs.length });
    let logged = 0; let sent = 0;
    for (let i = 0; i < seqs.length && !cancelled.current; i += BATCH_CHUNK) {
      const chunk = seqs.slice(i, i + BATCH_CHUNK);
      try {
        const r = await adminNudgeApi.sendBatch({ seqs: chunk, mode, sendMode: m });
        logged += r.logged; sent += r.sent;
        setStatus((s) => { const n = { ...s }; for (const it of r.items) n[it.seq] = it; return n; });
      } catch {
        setStatus((s) => { const n = { ...s }; for (const seq of chunk) n[seq] = 'error'; return n; });
      }
      setProgress({ done: Math.min(seqs.length, i + chunk.length), total: seqs.length });
    }
    setProgress(null);
    void qc.invalidateQueries({ queryKey: ['admin', 'nudge', 'alarm-log'] }); void qc.invalidateQueries({ queryKey: ['admin', 'nudge', 'mail-log'] });
    toast(tr(`발송처리가 완료되었습니다. 로그 ${logged}건 / 실제 발송 ${sent}건`, `Done. ${logged} logged / ${sent} actually sent`), { tone: 'ok' });
  };
  const startBatch = (m: 'sms' | 'email') => {
    if (!mode) { toast(tr('발송하려는 독려 내용 단계를 선택하세요.', 'Choose the nudge stage first.'), { tone: 'danger' }); return; }
    if (total < 1) { toast(tr('검색된 항목이 없습니다.', 'No results.'), { tone: 'danger' }); return; }
    if (!checked.size) { toast(tr('발송할 항목을 선택하세요.', 'Select learners first.'), { tone: 'danger' }); return; }
    if (checked.size > bulkMax) { toast(tr(`한 번에 최대 ${bulkMax}명까지 발송할 수 있습니다. 선택: ${checked.size}명. 소량으로 나누어 발송하거나 예약 발송을 이용하세요.`, `At most ${bulkMax} per batch (selected ${checked.size}).`), { tone: 'danger' }); return; }
    setBatch(m);
  };

  // 예약 발송 (study_sms_res.php)
  const [resOpen, setResOpen] = useState(false);
  const [res, setRes] = useState({ date: '', hour: '0', message: '' });
  const [resErr, setResErr] = useState<string | null>(null);
  const [confirmRes, setConfirmRes] = useState(false);
  const reserve = useAdminMutation({ fn: () => adminNudgeApi.createReservations({ seqs: [...checked], resDate: res.date, resHour: Number(res.hour), message: res.message }), invalidate: [['admin', 'nudge', 'reservations']], success: (r) => tr(`문자발송이 예약되었습니다. (${r.created}건)`, `Reserved ${r.created} message(s).`), onSuccess: () => { setConfirmRes(false); setResOpen(false); setRes({ date: '', hour: '0', message: '' }); }, onError: (e) => { setConfirmRes(false); setResErr(isAppError(e) ? e.message : adm.common.failed); } });
  const openReserve = () => {
    if (total < 1) { toast(tr('검색된 항목이 없습니다.', 'No results.'), { tone: 'danger' }); return; }
    if (!checked.size) { toast(tr('예약발송할 항목을 선택하세요.', 'Select learners first.'), { tone: 'danger' }); return; }
    if (checked.size > bulkMax) { toast(tr(`한 번에 최대 ${bulkMax}명까지 예약할 수 있습니다. 선택: ${checked.size}명. 소량으로 나누어 등록하세요.`, `At most ${bulkMax} per reservation.`), { tone: 'danger' }); return; }
    setResErr(null); setResOpen(true);
  };
  const submitReserve = () => {
    if (!res.date) { setResErr(tr('예약날짜를 선택하세요.', 'Choose a date.')); return; }
    if (res.date <= todayIso()) { setResErr(tr('예약날짜는 현재날짜 이후부터 가능합니다.', 'The date must be after today.')); return; }
    if (!res.message.trim()) { setResErr(tr('예약 메세지를 입력하세요.', 'Enter the message.')); return; }
    setConfirmRes(true); // study_sms_res.php: confirm('발송하시겠습니까?')
  };

  /** StudySmsSearch(): validate, then search (also fired by the 기간 / 사업주 selects, as their onchange did). */
  const runSearch = (next: Form) => {
    const err = nudgeSearchError(next);
    if (err) { toast(err, { tone: 'danger' }); return; }
    // every StudySmsSearch reloaded study_sms_search_result.php, which cleared the checks and the 성공/제외 statuses — even with unchanged filters
    clearSelection();
    const same = p.s === 1 && p.page === 1 && JSON.stringify(pick({ ...p, ...next })) === filterKey;
    setP({ ...next, s: 1 }, true);
    if (same) void list.refetch();
  };
  const submit = () => runSearch(form);
  const resetAll = () => { setForm(pick(DEFAULTS)); setCompanyQ(''); reset(); };
  const applyCompany = (c: { companyCode: string; companyName: string }) => { setForm({ ...form, companyCode: c.companyCode, companyName: c.companyName, period: '' }); setCompanyQ(c.companyName); setSuggestOpen(false); };

  const statusCell = (r: NudgeTarget) => {
    const s = status[r.seq];
    if (s === 'error') return <StatusBadge tone="danger">{tr('오류', 'Error')}</StatusBadge>;
    if (!s) return batchRan && !checked.has(r.seq) ? <span className="muted">{tr('제외', 'Skipped')}</span> : '-';
    const tone = s.ok ? 'ok' : s.code === 'SEND_NOT_CONFIGURED' ? 'warn' : 'danger';
    return <StatusBadge tone={tone} title={s.label}>{s.ok ? tr('성공', 'OK') : s.code === 'SEND_NOT_CONFIGURED' ? tr('로그만 기록', 'Logged') : tr('실패', 'Failed')}</StatusBadge>;
  };
  // one column per 독려 단계: radio + label + (템플릿코드) in the header, 내용보기 in every row (study_sms_search_result.php)
  const modeColumns: Column<NudgeTarget>[] = modes.map((m) => ({
    key: `mode-${m.mode}`, align: 'center', nowrap: true,
    header: <label style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}><input type="radio" name="MessageMode" value={m.mode} checked={mode === m.mode} onChange={() => setMode(m.mode)} /><span>{m.label}</span><span className="muted" style={{ fontSize: 11, fontWeight: 'normal' }}>{m.hasTemplate ? (m.templateCode ? `(${m.templateCode})` : '') : tr('(템플릿 없음)', '(no template)')}</span></label>,
    render: (r) => <AButton size="xs" aria-label={`${m.label} ${tr('내용보기', 'View')} ${r.id}`} onClick={() => openPreview(r.seq, m.mode)}>{tr('내용보기', 'View')}</AButton>,
  }));
  const columns: Column<NudgeTarget>[] = [
    { key: 'check', header: <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={allChecked} onChange={toggleAll} />, width: 40, align: 'center', render: (r) => <input type="checkbox" aria-label={`${tr('선택', 'Select')} ${r.id}`} checked={checked.has(r.seq)} onChange={() => toggle(r.seq)} /> },
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 70, render: (_r, i) => <>{firstNo - i}<br /><span className="muted">{_r.serviceTypeLabel}</span></> },
    { key: 'name', header: <>{tr('이름', 'Name')}<br />ID</>, nowrap: true, render: (r) => <InfoLink onClick={() => info.openMember(r.id)}>{r.name ?? ''}<br />{r.id}</InfoLink> },
    { key: 'course', header: <>{tr('과정명', 'Course')}<br />{tr('수강기간', 'Period')}</>, render: (r) => <><b>{r.courseName}</b><br />{r.lectureStart} ~ {r.lectureEnd}<br /><span className="muted">{tr('첨삭완료', 'Tutor deadline')} : {r.tutorLimit ?? '-'}{tr('까지', '')}</span></> },
    { key: 'progress', header: tr('진도율', 'Progress'), align: 'right', nowrap: true, render: (r) => `${r.progress}%` },
    ...modeColumns,
    { key: 'company', header: tr('사업주', 'Company'), render: (r) => r.companyCode ? <InfoLink onClick={() => info.openCompany(r.companyCode)}>{r.companyName ?? r.companyCode}</InfoLink> : (r.companyName ?? '') },
    { key: 'sales', header: <>{tr('영업담당자', 'Sales')}<br />{tr('영업담당자 소속', 'Team')}</>, nowrap: true, render: (r) => <>{r.salesName ?? ''}<br />{r.salesTeam ?? ''}</> },
    { key: 'openChapter', header: tr('실시회차', 'Round'), align: 'center', width: 60, render: (r) => r.openChapter ?? '' },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', width: 80, render: statusCell },
    { key: 'pre', header: tr('사전', 'Pre'), align: 'center', nowrap: true },
    { key: 'post', header: tr('사후', 'Post'), align: 'center', width: 40 },
  ];
  const salesManagers = meta.data?.salesManagers ?? [];
  const teamOptions = [{ value: '', label: tr('전체', 'All') }, ...(meta.data?.salesTeams ?? []).map((t) => ({ value: t, label: t }))];
  const courseOptions = [{ value: '', label: tr('전체', 'All') }, ...(meta.data?.courses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.contentsName ?? ''} | ${c.lectureCode}` }))];
  const periodOptions = [{ value: '', label: tr('-- 기간 선택 --', '-- period --') }, ...(terms.data?.items ?? []).map((t) => ({ value: t.period, label: t.period }))];
  const companyOptions = [{ value: '', label: tr('-- 사업주 선택 --', '-- company --') }, ...(termCompanies.data?.items ?? []).map((c) => ({ value: c.companyCode, label: `${c.companyName} | ${c.companyCode}` }))];
  const years = YEAR_OPTIONS(meta.data?.years ?? [Number(thisYear)]);
  const pd = preview.data;
  const ratio = progress ? (progress.total ? (progress.done / progress.total) * 100 : 100) : 0;

  return (
    <AdminPage title={tr('학습참여독려', 'Study nudges')} lead={tr('수강생들의 교육참여에 따라 알림톡·문자·메일을 보낼 수 있습니다. 검색 조건을 선택하고 검색을 누르세요.', 'Send Kakao/SMS/e-mail nudges by learning status. Choose filters and search.')}>
      <SendStubCallout />
      <FilterBar onSubmit={submit} onReset={resetAll}>
        <FilterField label={tr('검색 구분', 'Search by')} width={230}>
          <div style={{ display: 'flex', gap: 14, paddingTop: 8 }}>
            <label><input type="radio" name="gubun" value="A" checked={form.gubun === 'A'} onChange={() => setForm({ ...form, gubun: 'A', companyCode: '', companyName: '', period: '' })} /> {tr('기간 검색', 'By period')}</label>
            <label><input type="radio" name="gubun" value="B" checked={form.gubun === 'B'} onChange={() => setForm({ ...form, gubun: 'B', companyCode: '', period: '' })} /> {tr('사업주 검색', 'By company')}</label>
          </div>
        </FilterField>
        {form.gubun === 'B' ? (
          <FilterField label={tr('사업주명', 'Company name')} htmlFor="sn-cname" width={320}>
            <div style={{ position: 'relative' }}>
              <AInput id="sn-cname" value={companyQ} placeholder={tr('사업주명 입력', 'Type a company name')} onChange={(e) => { setCompanyQ(e.target.value); setSuggestOpen(true); setForm({ ...form, companyName: e.target.value, companyCode: '', period: '' }); }} autoComplete="off" />
              {suggestOpen && debouncedQ && suggestions.data ? (
                <div role="listbox" aria-label={tr('사업주 검색 결과', 'Company matches')} style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', padding: 4, background: 'var(--c-paper, #fff)', border: '1px solid var(--c-line, #ddd)', borderRadius: 8, maxHeight: 260, overflow: 'auto' }}>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {suggestions.data.items.length ? suggestions.data.items.map((c, i) => <li key={c.companyCode}><button type="button" role="option" aria-selected={false} style={{ width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => applyCompany(c)}>{i + 1}. {highlight(c.companyName, debouncedQ)}&nbsp;&nbsp;<span className="muted">{c.companyCode}</span></button></li>)
                      : <li style={{ padding: '6px 8px' }}>{tr('검색 결과가 없습니다.', 'No results.')}</li>}
                  </ul>
                  <div style={{ textAlign: 'right', paddingTop: 4 }}><AButton size="xs" onClick={() => setSuggestOpen(false)}>{tr('닫기', 'Close')}</AButton></div>
                </div>
              ) : null}
            </div>
          </FilterField>
        ) : null}
        <FilterField label={tr('연도', 'Year')} htmlFor="sn-year" width={110}><ASelect id="sn-year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value, period: '', ...(form.gubun === 'A' ? { companyCode: '' } : {}) })} options={years} /></FilterField>
        <FilterField label={tr('월', 'Month')} htmlFor="sn-month" width={100}><ASelect id="sn-month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value, period: '', ...(form.gubun === 'A' ? { companyCode: '' } : {}) })} options={MONTH_OPTIONS} /></FilterField>
        <FilterField label={tr('기간', 'Period')} htmlFor="sn-period" width={250}><ASelect id="sn-period" value={form.period} onChange={(e) => { const next = { ...form, period: e.target.value, ...(form.gubun === 'A' ? { companyCode: '' } : {}) }; setForm(next); runSearch(next); }} options={periodOptions} loading={terms.isFetching} /></FilterField>
        {form.gubun === 'A' ? <FilterField label={tr('사업주', 'Company')} htmlFor="sn-company" width={300}><ASelect id="sn-company" value={form.companyCode} onChange={(e) => { const next = { ...form, companyCode: e.target.value }; setForm(next); runSearch(next); }} options={companyOptions} disabled={!periodSel} loading={termCompanies.isFetching} /></FilterField> : null}
        <FilterField label={tr('실시회차', 'Round')} htmlFor="sn-oc" width={100}><AInput id="sn-oc" inputMode="numeric" value={form.openChapter} onChange={(e) => setForm({ ...form, openChapter: e.target.value })} /></FilterField>
        <FilterField label={tr('사전', 'Pre-test')} htmlFor="sn-pre" width={100}><ASelect id="sn-pre" value={form.abilityYN} onChange={(e) => setForm({ ...form, abilityYN: e.target.value })} options={YN} /></FilterField>
        <FilterField label={tr('사후', 'Post-test')} htmlFor="sn-post" width={100}><ASelect id="sn-post" value={form.abilityAfterYN} onChange={(e) => setForm({ ...form, abilityAfterYN: e.target.value })} options={YN} /></FilterField>
        <FilterField label={tr('이름,ID', 'Name / ID')} htmlFor="sn-q" width={160}><AInput id="sn-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        {/* select2 in the PHP: type an ID or a name (the server matches a.SalesID = x OR 영업담당자 이름 = x) */}
        <FilterField label={tr('영업담당자', 'Sales rep')} htmlFor="sn-sales" width={240}>
          <AInput id="sn-sales" list="sn-sales-list" value={form.salesId} placeholder={tr('전체 (ID 또는 이름 검색)', 'All (type ID or name)')} onChange={(e) => setForm({ ...form, salesId: e.target.value.split(' | ')[0]!.trim() })} autoComplete="off" />
          <datalist id="sn-sales-list">{salesManagers.map((s) => <option key={s.id} value={s.id}>{`${s.id} | ${s.name ?? ''} | ${s.team ?? ''}`}</option>)}</datalist>
        </FilterField>
        <FilterField label={tr('영업담당자 소속', 'Sales team')} htmlFor="sn-team" width={160}><ASelect id="sn-team" value={form.salesTeam} onChange={(e) => setForm({ ...form, salesTeam: e.target.value })} options={teamOptions} /></FilterField>
        <FilterField label={tr('진도율 (%)', 'Progress (%)')} width={170}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AInput aria-label={tr('진도율 시작', 'Progress from')} inputMode="numeric" value={form.progress1} onChange={(e) => setForm({ ...form, progress1: e.target.value.replace(/\D/g, '') })} style={{ width: 60 }} /> ~ <AInput aria-label={tr('진도율 종료', 'Progress to')} inputMode="numeric" value={form.progress2} onChange={(e) => setForm({ ...form, progress2: e.target.value.replace(/\D/g, '') })} style={{ width: 60 }} /></div></FilterField>
        <FilterField label={tr('과정명', 'Course')} htmlFor="sn-course" width={300}><ASelect id="sn-course" value={form.lectureCode} onChange={(e) => setForm({ ...form, lectureCode: e.target.value })} options={courseOptions} /></FilterField>
        <FilterField label={tr('교육담당자 여부', 'Training manager')} htmlFor="sn-edu" width={140}><ASelect id="sn-edu" value={form.eduManager} onChange={(e) => setForm({ ...form, eduManager: e.target.value })} options={[{ value: '', label: tr('전체', 'All') }, { value: 'Y', label: tr('교육담당자', 'Managers') }, { value: 'N', label: tr('일반회원', 'Members') }]} /></FilterField>
        <FilterField label={tr('첨삭정렬', 'Tutoring')} htmlFor="sn-tutor" width={150}><ASelect id="sn-tutor" value={form.tutorStatus} onChange={(e) => setForm({ ...form, tutorStatus: e.target.value })} options={[{ value: '', label: tr('전체', 'All') }, { value: 'N', label: tr('미첨삭만 보기', 'Not tutored only') }]} /></FilterField>
        <FilterField label={tr('수료여부', 'Completion')} htmlFor="sn-pass" width={120}><ASelect id="sn-pass" value={form.passOk} onChange={(e) => setForm({ ...form, passOk: e.target.value })} options={[{ value: '', label: tr('전체', 'All') }, { value: 'Y', label: tr('수료', 'Passed') }, { value: 'N', label: tr('미수료', 'Not passed') }]} /></FilterField>
        <FilterField label={tr('개설용도', 'Service type')} htmlFor="sn-st" width={120}><ASelect id="sn-st" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} options={[{ value: '', label: tr('전체', 'All') }, { value: 'A', label: tr('패키지', 'Package') }, { value: 'W', label: tr('비환급', 'Non-refund') }]} /></FilterField>
        <FilterField label={tr('실명인증 여부', 'Identity check')} htmlFor="sn-cert" width={130}><ASelect id="sn-cert" value={form.certCount} onChange={(e) => setForm({ ...form, certCount: e.target.value })} options={[{ value: '', label: tr('전체', 'All') }, { value: 'Y', label: tr('인증 완료', 'Verified') }, { value: 'N', label: tr('미인증', 'Not verified') }]} /></FilterField>
      </FilterBar>

      {p.s !== 1 ? <Card><p className="muted" style={{ textAlign: 'center', margin: '24px 0' }}>{tr('검색 조건을 선택하세요.', 'Choose search filters.')}</p></Card> : (
        <>
          <Card title={tr('발송', 'Send')} aside={<span className="muted">{tr(`선택 ${checked.size}명 / 최대 ${bulkMax}명 · 검색 ${total.toLocaleString()}건`, `${checked.size} selected / max ${bulkMax} · ${total.toLocaleString()} found`)}</span>}>
            <p className="muted" style={{ margin: '0 0 10px' }}>{tr('표 머리글에서 독려 단계를 고른 뒤 체크한 수강생에게 발송합니다. 각 단계 열의 "내용보기"로 한 명에게 개별 발송할 수 있습니다.', 'Pick a stage in the table header, then send to the checked learners. "View" in a stage column sends to one learner.')}</p>
            {total > 0 ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <AButton disabled={!!progress} onClick={() => startBatch('sms')}>{tr('알림톡 발송', 'Send Kakao/SMS')}</AButton>
              <AButton disabled={!!progress} onClick={openReserve}>{tr('체크항목 문자 예약 발송', 'Reserve SMS for checked')}</AButton>
              <AButton disabled={!!progress} onClick={() => startBatch('email')}>{tr('e-mail 발송', 'Send e-mail')}</AButton>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <label htmlFor="sn-size" className="muted">{tr('페이지당', 'Per page')}</label>
                <ASelect id="sn-size" value={String(p.size)} onChange={(e) => setP({ size: Number(e.target.value) }, true)} options={SIZE_OPTIONS.map((n) => ({ value: String(n), label: tr(`${n}건`, `${n}`) }))} style={{ width: 100 }} />
              </span>
            </div> : null}
            {progress ? <div style={{ marginTop: 12 }} aria-live="polite"><Callout tone="info"><b>{tr('진행률', 'Progress')} {ratio.toFixed(2)} %</b> ({progress.done} / {progress.total}) — {tr('작업이 완료될 때까지 기다려 주세요.', 'Please wait until it finishes.')}<div style={{ marginTop: 6 }}><Bar value={ratio} /></div></Callout></div> : null}
          </Card>
          <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.seq} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={p.size} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')} dense />
        </>
      )}

      <DetailDrawer open={!!prev} onClose={() => setPrev(null)} title={tr('메시지 개별 발송', 'Send to one learner')} subtitle={pd ? `${pd.name ?? ''} (${pd.id}) · ${pd.modeLabel}` : ''} wide
        footer={<><AButton onClick={() => setPrev(null)}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" disabled={!pd || sendOne.isPending} onClick={() => setConfirmOne(true)}>{sendOne.isPending ? tr('처리중입니다...', 'Working…') : tr('발송 하기', 'Send')}</AButton></>}>
        {pd ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SendStubCallout />
            <FieldRow label={tr('독려 단계', 'Stage')} htmlFor="sn-prevmode"><ASelect id="sn-prevmode" value={prev?.mode ?? ''} onChange={(e) => prev && openPreview(prev.seq, e.target.value)} options={modes.map((m) => ({ value: m.mode, label: m.label }))} /></FieldRow>
            <DescList items={[[tr('발송 대상', 'Recipient'), `${pd.name ?? ''} (${pd.id})`], [tr('과정', 'Course'), `${pd.courseName ?? ''} · ${pd.lectureStart} ~ ${pd.lectureEnd}`], [tr('휴대폰', 'Mobile'), pd.mobile ?? tr('없음', 'none')], [tr('이메일', 'E-mail'), pd.email ?? tr('없음', 'none')], [tr('템플릿코드', 'Template code'), pd.templateFound ? pd.templateCode || '-' : tr('등록된 템플릿 없음', 'no template registered')], [tr('사업주 독려문자 수신', 'Company SMS opt-in'), pd.companySendSMS ?? '-']]} />
            <FieldRow label={tr('발송 방법', 'Channel')} htmlFor="sn-sendmode"><ASelect id="sn-sendmode" value={sendMode} onChange={(e) => setSendMode(e.target.value as 'sms' | 'email')} options={[{ value: 'sms', label: tr('알림톡(템플릿 일치 시) / 문자', 'Kakao (if text matches the template) / SMS') }, { value: 'email', label: tr('이메일', 'E-mail') }]} /></FieldRow>
            {sendMode === 'email' ? <FieldRow label={tr('제목', 'Subject')}><div style={{ paddingTop: 8 }}>{pd.emailSubject}</div></FieldRow> : null}
            <FieldRow label={tr('메세지', 'Message')} htmlFor="sn-text" help={text === pd.templateMessage && pd.templateCode ? tr('템플릿 문구와 같아 알림톡으로 발송됩니다.', 'Matches the template → Kakao alimtalk.') : tr('템플릿과 다르면 문자(LMS)로 발송됩니다.', 'Differs from the template → plain SMS.')}><ATextarea id="sn-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} /></FieldRow>
            {pd.templateFound ? <Card title={tr('알림톡 템플릿 원문(치환 후)', 'Alimtalk template (substituted)')}><MessageBlock text={pd.templateMessage} maxHeight={200} /></Card> : null}
            {oneResult ? <Callout tone={oneResult.ok ? 'ok' : 'warn'}>{oneResult.label}{oneResult.logIdx ? ` · ${tr('로그', 'log')} #${oneResult.logIdx}` : ''}</Callout> : null}
          </div>
        ) : preview.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>
      <ConfirmDialog open={confirmOne} title={tr('메시지 개별 발송', 'Send to one learner')} body={<p>{tr('발송하시겠습니까?', 'Send now?')}</p>} loading={sendOne.isPending} onCancel={() => setConfirmOne(false)} onConfirm={() => sendOne.mutate(undefined as never)} />

      <DetailDrawer open={resOpen} onClose={() => setResOpen(false)} title={tr('메시지 예약 발송', 'Reserve SMS')} subtitle={tr(`선택 ${checked.size}명`, `${checked.size} selected`)}
        footer={<><AButton onClick={() => setResOpen(false)}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" disabled={reserve.isPending} onClick={submitReserve}>{reserve.isPending ? tr('처리중입니다...', 'Working…') : tr('발송 하기', 'Reserve')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Callout tone="info">{tr('예약된 문자는 기존 사이트의 예약 발송기(크론)가 예약 시각에 발송합니다. 예약문자발송 메뉴에서 확인·삭제할 수 있습니다.', 'Reserved messages are sent by the legacy scheduler at the chosen time. Review or delete them under Scheduled SMS.')}</Callout>
          <FieldRow label={tr('예약 날짜', 'Date')} htmlFor="sn-resdate" required><DateField id="sn-resdate" value={res.date} min={addDaysIso(todayIso(), 1)} onChange={(v) => setRes({ ...res, date: v })} /></FieldRow>
          <FieldRow label={tr('예약 시간', 'Hour')} htmlFor="sn-reshour"><ASelect id="sn-reshour" value={res.hour} onChange={(e) => setRes({ ...res, hour: e.target.value })} options={HOUR_OPTIONS} /></FieldRow>
          <FieldRow label={tr('예약 메세지', 'Message')} htmlFor="sn-resmsg" required help={tr('#{이름} #{과정명} #{시작} #{종료} #{회사명} #{소속업체명} #{도메인} #{아이디} 사용 가능', 'Variables: #{이름} #{과정명} #{시작} #{종료} #{회사명} #{소속업체명} #{도메인} #{아이디}')} error={resErr}><ATextarea id="sn-resmsg" rows={8} value={res.message} onChange={(e) => setRes({ ...res, message: e.target.value })} /></FieldRow>
        </div>
      </DetailDrawer>
      <ConfirmDialog open={confirmRes} title={tr('메시지 예약 발송', 'Reserve SMS')} body={<p>{tr('발송하시겠습니까?', 'Reserve now?')}</p>} loading={reserve.isPending} onCancel={() => setConfirmRes(false)} onConfirm={() => reserve.mutate(undefined as never)} />

      <ConfirmDialog open={!!batch} title={batch === 'email' ? tr('이메일 발송', 'Send e-mail') : tr('알림톡 발송', 'Send Kakao/SMS')} onCancel={() => setBatch(null)} onConfirm={() => batch && void runBatch(batch)}
        body={<div>
          <p>{tr(`선택한 ${checked.size}명에게 `, `To ${checked.size} selected learner(s): `)}{batch === 'email' ? tr('이메일을 발송합니다.', 'send e-mail.') : tr('알림톡을 발송합니다. (템플릿과 내용이 같으면 카톡, 다르면 문자로 대체 발송)', 'send Kakao alimtalk (SMS fallback when the text differs from the template).')}</p>
          <p>{tr(`발송은 ${BATCH_CHUNK}명씩 순차적으로 진행됩니다. 작업이 완료될 때까지 기다려 주세요.`, `Sent ${BATCH_CHUNK} at a time; please wait until it finishes.`)}</p>
          <p><b>{tr('현재는 발송 로그만 기록되고 실제 전송은 되지 않습니다.', 'Currently only the log rows are written; nothing is transmitted.')}</b></p>
        </div>} />
      {info.drawers}
    </AdminPage>
  );
}
