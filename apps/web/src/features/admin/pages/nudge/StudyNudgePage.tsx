import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminNudgeApi, type NudgeTarget, type SendItem } from '../../../../shared/api/endpoints/admin-nudge';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Callout, Card, ConfirmDialog, DataTable, DateField, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { HOUR_OPTIONS, MONTH_OPTIONS, MemberLink, MessageBlock, SendStubCallout, YEAR_OPTIONS, addDaysIso, todayIso } from './nudgeShared';

const thisYear = String(new Date().getFullYear());
const thisMonth = String(new Date().getMonth() + 1).padStart(2, '0');
const DEFAULTS = {
  s: 0, gubun: 'A', year: thisYear, month: thisMonth, period: '', companyCode: '', companyName: '', openChapter: '', abilityYN: '', abilityAfterYN: '', q: '', salesId: '', salesTeam: '', progress1: '', progress2: '',
  lectureCode: '', eduManager: '', tutorStatus: '', passOk: '', serviceType: '', certCount: '', page: 1,
};
type Form = Omit<typeof DEFAULTS, 's' | 'page'>;
const SIZE = 30;
const YN = [{ value: '', label: tr('전체', 'All') }, { value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }];
const pick = (p: typeof DEFAULTS): Form => { const { s: _s, page: _p, ...rest } = p; return rest; };

/** study_sms.php + study_sms_search_result.php — 학습참여독려 (C1). */
export default function StudyNudgePage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState<Form>(pick(p));
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const meta = useQuery({ queryKey: ['admin', 'nudge', 'meta'], queryFn: ({ signal }) => adminNudgeApi.meta(signal), staleTime: 5 * 60_000 });

  // 기간 선택 (study_lectureterme.php) and 사업주 선택 (study_lectureterme_company.php) for 기간 검색; 사업주 검색 lists the company's own terms.
  const termsKey = form.gubun === 'B' ? { year: form.year, month: form.month || undefined, companyCode: form.companyCode || undefined } : { year: form.year, month: form.month || undefined };
  const terms = useQuery({ queryKey: ['admin', 'nudge', 'terms', termsKey], queryFn: ({ signal }) => adminNudgeApi.terms(termsKey, signal), enabled: form.gubun === 'A' || !!form.companyCode });
  const periodSel = useMemo(() => { const m = /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/.exec(form.period); return m ? { lectureStart: m[1]!, lectureEnd: m[2]! } : null; }, [form.period]);
  const termCompanies = useQuery({ queryKey: ['admin', 'nudge', 'term-companies', periodSel], queryFn: ({ signal }) => adminNudgeApi.termCompanies(periodSel!, signal), enabled: form.gubun === 'A' && !!periodSel });
  const [companyQ, setCompanyQ] = useState(form.companyName);
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(companyQ.trim()), 300); return () => clearTimeout(t); }, [companyQ]);
  const suggestions = useQuery({ queryKey: ['admin', 'nudge', 'company-search', debouncedQ], queryFn: ({ signal }) => adminNudgeApi.companySearch(debouncedQ, signal), enabled: form.gubun === 'B' && debouncedQ.length > 0 && debouncedQ !== form.companyName });

  const query = useMemo(() => ({ ...Object.fromEntries(Object.entries(pick(p)).map(([k, v]) => [k, v === '' ? undefined : v])), page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'nudge', 'targets', query], queryFn: ({ signal }) => adminNudgeApi.targets(query, signal), enabled: p.s === 1, placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const rows = list.data?.items ?? [];

  // selection + 독려 단계 (MessageMode radio in the legacy table header)
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState<Record<number, SendItem>>({});
  useEffect(() => { setChecked(new Set()); setStatus({}); }, [list.data]);
  const modes = useMemo(() => (meta.data?.modes ?? []).filter((m) => m.mode !== 'edu' || p.eduManager === 'Y'), [meta.data, p.eduManager]);
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.seq));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.seq)));
  const toggle = (seq: number) => setChecked((s) => { const n = new Set(s); if (n.has(seq)) n.delete(seq); else n.add(seq); return n; });
  const bulkMax = meta.data?.bulkMax ?? 200;

  // preview / individual send (study_sms_ea.php)
  const [prev, setPrev] = useState<{ seq: number; mode: string } | null>(null);
  const preview = useQuery({ queryKey: ['admin', 'nudge', 'preview', prev], queryFn: ({ signal }) => adminNudgeApi.preview(prev!.seq, prev!.mode, signal), enabled: !!prev });
  const [sendMode, setSendMode] = useState<'sms' | 'email'>('sms');
  const [text, setText] = useState('');
  useEffect(() => { if (preview.data) { setText(preview.data.templateMessage || preview.data.message); setSendMode('sms'); } }, [preview.data]);
  const [oneResult, setOneResult] = useState<SendItem | null>(null);
  const sendOne = useAdminMutation({ fn: () => adminNudgeApi.sendOne(prev!.seq, { mode: prev!.mode, sendMode, message: text }), invalidate: [['admin', 'nudge', 'alarm-log'], ['admin', 'nudge', 'mail-log']], success: (r) => r.ok ? tr('발송되었습니다.', 'Sent.') : tr('발송 로그만 기록되었습니다 (발송 설정 없음).', 'Logged only (sending not configured).'), onSuccess: (r) => { setOneResult(r); setStatus((s) => ({ ...s, [r.seq]: r })); } });

  // batch send (study_sms_batch_process.php per checked row)
  const [batch, setBatch] = useState<'sms' | 'email' | null>(null);
  const sendBatch = useAdminMutation({ fn: (m: 'sms' | 'email') => adminNudgeApi.sendBatch({ seqs: [...checked], mode, sendMode: m }), invalidate: [['admin', 'nudge', 'alarm-log'], ['admin', 'nudge', 'mail-log']], success: (r) => tr(`발송처리가 완료되었습니다. 로그 ${r.logged}건 / 실제 발송 ${r.sent}건`, `Done. ${r.logged} logged / ${r.sent} actually sent`), onSuccess: (r) => { setBatch(null); setStatus((s) => { const n = { ...s }; for (const i of r.items) n[i.seq] = i; return n; }); } });
  const startBatch = (m: 'sms' | 'email') => {
    if (!mode) { toast(tr('발송하려는 독려 내용 단계를 선택하세요.', 'Choose the nudge stage first.'), { tone: 'danger' }); return; }
    if (!checked.size) { toast(tr('발송할 항목을 선택하세요.', 'Select learners first.'), { tone: 'danger' }); return; }
    if (checked.size > bulkMax) { toast(tr(`한 번에 최대 ${bulkMax}명까지 발송할 수 있습니다. 선택: ${checked.size}명`, `At most ${bulkMax} per batch (selected ${checked.size}).`), { tone: 'danger' }); return; }
    setBatch(m);
  };

  // 예약 발송 (study_sms_res.php)
  const [resOpen, setResOpen] = useState(false);
  const [res, setRes] = useState({ date: '', hour: '9', message: '' });
  const [resErr, setResErr] = useState<string | null>(null);
  const reserve = useAdminMutation({ fn: () => adminNudgeApi.createReservations({ seqs: [...checked], resDate: res.date, resHour: Number(res.hour), message: res.message }), invalidate: [['admin', 'nudge', 'reservations']], success: (r) => tr(`문자발송이 예약되었습니다. (${r.created}건)`, `Reserved ${r.created} message(s).`), onSuccess: () => { setResOpen(false); setRes({ date: '', hour: '9', message: '' }); }, onError: (e) => setResErr(isAppError(e) ? e.message : adm.common.failed) });
  const openReserve = () => {
    if (!checked.size) { toast(tr('예약발송할 항목을 선택하세요.', 'Select learners first.'), { tone: 'danger' }); return; }
    if (checked.size > bulkMax) { toast(tr(`한 번에 최대 ${bulkMax}명까지 예약할 수 있습니다.`, `At most ${bulkMax} per reservation.`), { tone: 'danger' }); return; }
    setResErr(null); setResOpen(true);
  };
  const submitReserve = () => {
    if (!res.date) { setResErr(tr('예약날짜를 선택하세요.', 'Choose a date.')); return; }
    if (res.date <= todayIso()) { setResErr(tr('예약날짜는 현재날짜 이후부터 가능합니다.', 'The date must be after today.')); return; }
    if (!res.message.trim()) { setResErr(tr('예약 메세지를 입력하세요.', 'Enter the message.')); return; }
    reserve.mutate(undefined as never);
  };

  const submit = () => { setP({ ...form, s: 1 }, true); };
  const resetAll = () => { setForm(pick(DEFAULTS)); setCompanyQ(''); reset(); };
  const applyCompany = (c: { companyCode: string; companyName: string }) => { setForm({ ...form, companyCode: c.companyCode, companyName: c.companyName, period: '' }); setCompanyQ(c.companyName); };

  const statusCell = (r: NudgeTarget) => { const s = status[r.seq]; if (!s) return '-'; const tone = s.ok ? 'ok' : s.code === 'SEND_NOT_CONFIGURED' ? 'warn' : 'danger'; return <StatusBadge tone={tone} title={s.label}>{s.ok ? tr('성공', 'OK') : s.code === 'SEND_NOT_CONFIGURED' ? tr('로그만 기록', 'Logged') : tr('실패', 'Failed')}</StatusBadge>; };
  const columns: Column<NudgeTarget>[] = [
    { key: 'check', header: <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={allChecked} onChange={toggleAll} />, width: 40, align: 'center', render: (r) => <input type="checkbox" aria-label={`${tr('선택', 'Select')} ${r.id}`} checked={checked.has(r.seq)} onChange={() => toggle(r.seq)} /> },
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 70, render: (_r, i) => <>{firstNo - i}<br /><span className="muted">{_r.serviceTypeLabel}</span></> },
    { key: 'name', header: <>{tr('이름', 'Name')}<br />ID</>, nowrap: true, render: (r) => <MemberLink id={r.id}>{r.name ?? ''}<br />{r.id}</MemberLink> },
    { key: 'course', header: <>{tr('과정명', 'Course')}<br />{tr('수강기간', 'Period')}</>, render: (r) => <><b>{r.courseName}</b><br />{r.lectureStart} ~ {r.lectureEnd}<br /><span className="muted">{tr('첨삭완료', 'Tutor deadline')} : {r.tutorLimit ?? '-'}{tr('까지', '')}</span></> },
    { key: 'progress', header: tr('진도율', 'Progress'), align: 'right', nowrap: true, render: (r) => `${r.progress}%` },
    { key: 'preview', header: tr('독려 메시지', 'Message'), align: 'center', nowrap: true, render: (r) => <AButton size="xs" disabled={!mode} title={mode ? undefined : tr('독려 단계를 먼저 선택하세요', 'Choose a stage first')} onClick={() => { setOneResult(null); setPrev({ seq: r.seq, mode }); }}>{tr('내용보기', 'View')}</AButton> },
    { key: 'company', header: tr('사업주', 'Company'), render: (r) => r.companyName ?? '' },
    { key: 'sales', header: <>{tr('영업담당자', 'Sales')}<br />{tr('영업담당자 소속', 'Team')}</>, nowrap: true, render: (r) => <>{r.salesName ?? ''}<br />{r.salesTeam ?? ''}</> },
    { key: 'openChapter', header: tr('실시회차', 'Round'), align: 'center', width: 60, render: (r) => r.openChapter ?? '' },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', width: 80, render: statusCell },
    { key: 'pre', header: tr('사전', 'Pre'), align: 'center', width: 40 },
    { key: 'post', header: tr('사후', 'Post'), align: 'center', width: 40 },
  ];
  const salesOptions = [{ value: '', label: tr('전체', 'All') }, ...(meta.data?.salesManagers ?? []).map((s) => ({ value: s.id, label: `${s.id} | ${s.name ?? ''} | ${s.team ?? ''}` }))];
  const teamOptions = [{ value: '', label: tr('전체', 'All') }, ...(meta.data?.salesTeams ?? []).map((t) => ({ value: t, label: t }))];
  const courseOptions = [{ value: '', label: tr('전체', 'All') }, ...(meta.data?.courses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.contentsName ?? ''} | ${c.lectureCode}` }))];
  const periodOptions = [{ value: '', label: tr('-- 기간 선택 --', '-- period --') }, ...(terms.data?.items ?? []).map((t) => ({ value: t.period, label: t.period }))];
  const companyOptions = [{ value: '', label: tr('-- 사업주 선택 --', '-- company --') }, ...(termCompanies.data?.items ?? []).map((c) => ({ value: c.companyCode, label: `${c.companyName} | ${c.companyCode}` }))];
  const years = YEAR_OPTIONS(meta.data?.years ?? [Number(thisYear)]);
  const pd = preview.data;

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
              <AInput id="sn-cname" value={companyQ} placeholder={tr('사업주명 입력', 'Type a company name')} onChange={(e) => { setCompanyQ(e.target.value); setForm({ ...form, companyName: e.target.value, companyCode: '', period: '' }); }} autoComplete="off" />
              {suggestions.data?.items.length ? (
                <ul role="listbox" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', margin: 0, padding: 4, listStyle: 'none', background: 'var(--c-surface, #fff)', border: '1px solid var(--c-border, #ddd)', borderRadius: 8, maxHeight: 220, overflow: 'auto' }}>
                  {suggestions.data.items.map((c, i) => <li key={c.companyCode}><button type="button" style={{ width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => applyCompany(c)}>{i + 1}. {c.companyName} <span className="muted">{c.companyCode}</span></button></li>)}
                </ul>
              ) : null}
            </div>
          </FilterField>
        ) : null}
        <FilterField label={tr('연도', 'Year')} htmlFor="sn-year" width={110}><ASelect id="sn-year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value, period: '', ...(form.gubun === 'A' ? { companyCode: '' } : {}) })} options={years} /></FilterField>
        <FilterField label={tr('월', 'Month')} htmlFor="sn-month" width={100}><ASelect id="sn-month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value, period: '', ...(form.gubun === 'A' ? { companyCode: '' } : {}) })} options={MONTH_OPTIONS} /></FilterField>
        <FilterField label={tr('기간', 'Period')} htmlFor="sn-period" width={250}><ASelect id="sn-period" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value, ...(form.gubun === 'A' ? { companyCode: '' } : {}) })} options={periodOptions} loading={terms.isFetching} /></FilterField>
        {form.gubun === 'A' ? <FilterField label={tr('사업주', 'Company')} htmlFor="sn-company" width={300}><ASelect id="sn-company" value={form.companyCode} onChange={(e) => setForm({ ...form, companyCode: e.target.value })} options={companyOptions} disabled={!periodSel} loading={termCompanies.isFetching} /></FilterField> : null}
        <FilterField label={tr('실시회차', 'Round')} htmlFor="sn-oc" width={100}><AInput id="sn-oc" value={form.openChapter} onChange={(e) => setForm({ ...form, openChapter: e.target.value })} /></FilterField>
        <FilterField label={tr('사전', 'Pre-test')} htmlFor="sn-pre" width={100}><ASelect id="sn-pre" value={form.abilityYN} onChange={(e) => setForm({ ...form, abilityYN: e.target.value })} options={YN} /></FilterField>
        <FilterField label={tr('사후', 'Post-test')} htmlFor="sn-post" width={100}><ASelect id="sn-post" value={form.abilityAfterYN} onChange={(e) => setForm({ ...form, abilityAfterYN: e.target.value })} options={YN} /></FilterField>
        <FilterField label={tr('이름,ID', 'Name / ID')} htmlFor="sn-q" width={160}><AInput id="sn-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={tr('영업담당자', 'Sales rep')} htmlFor="sn-sales" width={240}><ASelect id="sn-sales" value={form.salesId} onChange={(e) => setForm({ ...form, salesId: e.target.value })} options={salesOptions} /></FilterField>
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
          <Card title={tr('독려 단계 선택', 'Nudge stage')} aside={<span className="muted">{tr(`선택 ${checked.size}명 / 최대 ${bulkMax}명`, `${checked.size} selected / max ${bulkMax}`)}</span>}>
            <div role="radiogroup" aria-label={tr('독려 단계', 'Nudge stage')} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginBottom: 12 }}>
              {modes.map((m) => <label key={m.mode} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><input type="radio" name="MessageMode" value={m.mode} checked={mode === m.mode} onChange={() => setMode(m.mode)} /><span>{m.label}</span><span className="muted" style={{ fontSize: 11 }}>{m.hasTemplate ? `(${m.templateCode || tr('템플릿코드 없음', 'no code')})` : tr('(템플릿 없음)', '(no template)')}</span></label>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AButton disabled={!canWrite || total === 0} title={readOnlyTitle} onClick={() => startBatch('sms')}>{tr('알림톡 발송', 'Send Kakao/SMS')}</AButton>
              <AButton disabled={!canWrite || total === 0} title={readOnlyTitle} onClick={openReserve}>{tr('체크항목 문자 예약 발송', 'Reserve SMS for checked')}</AButton>
              <AButton disabled={!canWrite || total === 0} title={readOnlyTitle} onClick={() => startBatch('email')}>{tr('e-mail 발송', 'Send e-mail')}</AButton>
            </div>
          </Card>
          <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.seq} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')} dense />
        </>
      )}

      <DetailDrawer open={!!prev} onClose={() => setPrev(null)} title={tr('메시지 개별 발송', 'Send to one learner')} subtitle={pd ? `${pd.name ?? ''} (${pd.id}) · ${pd.modeLabel}` : ''} wide
        footer={<><AButton onClick={() => setPrev(null)}>{adm.common.close}</AButton><AButton variant="primary" loading={sendOne.isPending} disabled={!canWrite || !pd || (sendMode === 'sms' ? !pd.hasMobile : !pd.hasEmail)} title={readOnlyTitle} onClick={() => sendOne.mutate(undefined as never)}>{tr('발송 하기', 'Send')}</AButton></>}>
        {pd ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SendStubCallout />
            <DescList items={[[tr('발송 대상', 'Recipient'), `${pd.name ?? ''} (${pd.id})`], [tr('과정', 'Course'), `${pd.courseName ?? ''} · ${pd.lectureStart} ~ ${pd.lectureEnd}`], [tr('휴대폰', 'Mobile'), pd.mobile ?? tr('없음', 'none')], [tr('이메일', 'E-mail'), pd.email ?? tr('없음', 'none')], [tr('템플릿코드', 'Template code'), pd.templateFound ? pd.templateCode || '-' : tr('등록된 템플릿 없음', 'no template registered')], [tr('사업주 독려문자 수신', 'Company SMS opt-in'), pd.companySendSMS ?? '-']]} />
            <FieldRow label={tr('발송 방법', 'Channel')} htmlFor="sn-sendmode"><ASelect id="sn-sendmode" value={sendMode} onChange={(e) => setSendMode(e.target.value as 'sms' | 'email')} options={[{ value: 'sms', label: tr('알림톡(템플릿 일치 시) / 문자', 'Kakao (if text matches the template) / SMS') }, { value: 'email', label: tr('이메일', 'E-mail') }]} /></FieldRow>
            {sendMode === 'email' ? <FieldRow label={tr('제목', 'Subject')}><div style={{ paddingTop: 8 }}>{pd.emailSubject}</div></FieldRow> : null}
            <FieldRow label={tr('메세지', 'Message')} htmlFor="sn-text" help={text === pd.templateMessage && pd.templateCode ? tr('템플릿 문구와 같아 알림톡으로 발송됩니다.', 'Matches the template → Kakao alimtalk.') : tr('템플릿과 다르면 문자(LMS)로 발송됩니다.', 'Differs from the template → plain SMS.')}><ATextarea id="sn-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} /></FieldRow>
            {pd.templateFound ? <Card title={tr('알림톡 템플릿 원문(치환 후)', 'Alimtalk template (substituted)')}><MessageBlock text={pd.templateMessage} maxHeight={200} /></Card> : null}
            {oneResult ? <Callout tone={oneResult.ok ? 'ok' : 'warn'}>{oneResult.label}{oneResult.logIdx ? ` · ${tr('로그', 'log')} #${oneResult.logIdx}` : ''}</Callout> : null}
          </div>
        ) : preview.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      <DetailDrawer open={resOpen} onClose={() => setResOpen(false)} title={tr('메시지 예약 발송', 'Reserve SMS')} subtitle={tr(`선택 ${checked.size}명`, `${checked.size} selected`)}
        footer={<><AButton onClick={() => setResOpen(false)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={reserve.isPending} disabled={!canWrite} onClick={submitReserve}>{tr('발송 하기', 'Reserve')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Callout tone="info">{tr('예약된 문자는 기존 사이트의 예약 발송기(크론)가 예약 시각에 발송합니다. 예약문자발송 메뉴에서 확인·삭제할 수 있습니다.', 'Reserved messages are sent by the legacy scheduler at the chosen time. Review or delete them under Scheduled SMS.')}</Callout>
          <FieldRow label={tr('예약 날짜', 'Date')} htmlFor="sn-resdate" required><DateField id="sn-resdate" value={res.date} min={addDaysIso(todayIso(), 1)} onChange={(v) => setRes({ ...res, date: v })} /></FieldRow>
          <FieldRow label={tr('예약 시간', 'Hour')} htmlFor="sn-reshour"><ASelect id="sn-reshour" value={res.hour} onChange={(e) => setRes({ ...res, hour: e.target.value })} options={HOUR_OPTIONS} /></FieldRow>
          <FieldRow label={tr('예약 메세지', 'Message')} htmlFor="sn-resmsg" required help={tr('#{이름} #{과정명} #{시작} #{종료} #{회사명} #{소속업체명} #{도메인} #{아이디} 사용 가능', 'Variables: #{이름} #{과정명} #{시작} #{종료} #{회사명} #{소속업체명} #{도메인} #{아이디}')} error={resErr}><ATextarea id="sn-resmsg" rows={8} value={res.message} onChange={(e) => setRes({ ...res, message: e.target.value })} /></FieldRow>
        </div>
      </DetailDrawer>

      <ConfirmDialog open={!!batch} title={batch === 'email' ? tr('이메일 발송', 'Send e-mail') : tr('알림톡 발송', 'Send Kakao/SMS')} loading={sendBatch.isPending} onCancel={() => setBatch(null)} onConfirm={() => batch && sendBatch.mutate(batch)}
        body={<div><p>{tr(`선택한 ${checked.size}명에게 `, `To ${checked.size} selected learner(s): `)}{batch === 'email' ? tr('이메일을 발송합니다.', 'send e-mail.') : tr('알림톡을 발송합니다. (템플릿과 내용이 같으면 카톡, 다르면 문자로 대체 발송)', 'send Kakao alimtalk (SMS fallback when the text differs from the template).')}</p><p><b>{tr('현재는 발송 로그만 기록되고 실제 전송은 되지 않습니다.', 'Currently only the log rows are written; nothing is transmitted.')}</b></p></div>} />
    </AdminPage>
  );
}
