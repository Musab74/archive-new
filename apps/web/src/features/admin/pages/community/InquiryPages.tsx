import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { CheatingRow, CounselRow, InquiryRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, DataTable, DescList, DetailDrawer, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const SIZE = 20;
const statusBadge = (s: string | null | undefined, answered?: boolean) => <StatusBadge tone={s === 'B' || answered ? 'ok' : 'warn'} dot>{s === 'B' || answered ? '완료' : '대기'}</StatusBadge>;

// ---------------------------------------------------------------- /admin/inquiries
export function InquiriesPage() {
  const t = adm.community.inquiries;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [p, setP, reset] = useSearchState({ status: '', q: '', page: 1 });
  const [form, setForm] = useState({ status: p.status, q: p.q });
  const query = useMemo(() => ({ status: p.status || undefined, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'inquiries', query], queryFn: ({ signal }) => adminApi.inquiries(query, signal), placeholderData: keepPreviousData });
  const [sel, setSel] = useState<InquiryRow | null>(null);
  const [answer, setAnswer] = useState('');
  useEffect(() => { setAnswer(sel?.answer.contents ?? ''); }, [sel]);
  const save = useAdminMutation({ fn: ({ idx, text }: { idx: number; text: string }) => adminApi.answerInquiry(idx, text), invalidate: [['admin', 'inquiries'], ['admin', 'dashboard']], success: t.answered, onSuccess: () => setSel(null) });
  const columns: Column<InquiryRow>[] = [
    { key: 'idx', header: t.cols.idx, align: 'right', sortable: true },
    { key: 'status', header: t.cols.status, align: 'center', render: (r) => statusBadge(r.status) },
    { key: 'companyName', header: t.cols.company, sortable: true, render: (r) => <b>{r.companyName ?? ''}</b> },
    { key: 'name', header: t.cols.name, render: (r) => r.name ?? '' },
    { key: 'phone', header: t.cols.phone, render: (r) => r.phone ?? '' },
    { key: 'email', header: t.cols.email, render: (r) => r.email ?? '' },
    { key: 'personnel', header: t.cols.personnel, align: 'right', render: (r) => String(r.personnel ?? '') },
    { key: 'serviceType', header: t.cols.type, render: (r) => r.serviceType ?? '' },
    { key: 'regDate', header: t.cols.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '' },
  ];
  return (
    <AdminPage title={t.title} lead={t.lead}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ status: '', q: '' }); reset(); }}>
        <FilterField label={t.status} htmlFor="iq-st" width={120}><ASelect id="iq-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={t.statuses} /></FilterField>
        <FilterField label={t.q} htmlFor="iq-q" width={220}><AInput id="iq-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(x) => setP({ page: x })} onRowClick={setSel} selectedKey={sel?.idx} dense />
      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={`${t.title} · #${sel?.idx ?? ''}`} subtitle={sel ? `${sel.companyName ?? ''} · ${sel.name ?? ''} · ${sel.regDate ?? ''}` : ''} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="primary" disabled={!canWrite || !answer.trim()} title={readOnlyTitle} loading={save.isPending} onClick={() => sel && save.mutate({ idx: sel.idx, text: answer.trim() })}>{t.answer} {adm.common.save}</AButton></>}>
        {sel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DescList cols={2} items={[['회사', sel.companyName], ['담당자', sel.name], ['연락처', sel.phone], ['이메일', sel.email], ['인원', String(sel.personnel ?? '')], ['유형', sel.serviceType], ['개인정보 동의', sel.agreeYN], ['상태', statusBadge(sel.status)]]} />
            <div><h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{t.question}</h3><div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, padding: 12, background: 'var(--c-soft)', borderRadius: 6 }}>{sel.contents ?? ''}</div></div>
            {sel.answer.contents ? <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t.prevAnswer}: {sel.answer.name ?? ''} · {sel.answer.regDate ?? ''}{sel.answer.mdfDate ? ` (수정 ${sel.answer.mdfDate})` : ''}</p> : null}
            <div><label htmlFor="iq-answer" style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>{t.answer}</label><ATextarea id="iq-answer" rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t.answerPlaceholder} maxLength={20000} disabled={!canWrite} /></div>
          </div>
        ) : null}
      </DetailDrawer>
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/counsel
export function CounselPage() {
  const t = adm.community.counsel;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [p, setP, reset] = useSearchState({ status: '', q: '', category: '', page: 1 });
  const [form, setForm] = useState({ status: p.status, q: p.q, category: p.category });
  const query = useMemo(() => ({ status: p.status || undefined, q: p.q || undefined, category: p.category || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'counsel', query], queryFn: ({ signal }) => adminApi.counsel(query, signal), placeholderData: keepPreviousData });
  const [sel, setSel] = useState<CounselRow | null>(null);
  const [answer, setAnswer] = useState('');
  useEffect(() => { setAnswer(sel?.answer.contents ?? ''); }, [sel]);
  const save = useAdminMutation({ fn: ({ idx, text }: { idx: number; text: string }) => adminApi.answerCounsel(idx, text), invalidate: [['admin', 'counsel'], ['admin', 'dashboard']], success: adm.community.inquiries.answered, onSuccess: () => setSel(null) });
  const columns: Column<CounselRow>[] = [
    { key: 'idx', header: t.cols.idx, align: 'right', sortable: true },
    { key: 'answered', header: t.cols.answered, align: 'center', render: (r) => statusBadge(r.status, r.answered) },
    { key: 'id', header: t.cols.id, sortable: true, render: (r) => r.id ?? '' },
    { key: 'name', header: t.cols.name, render: (r) => r.name ?? '' },
    { key: 'category', header: t.cols.category, render: (r) => r.category ?? '' },
    { key: 'title', header: t.cols.title, sortable: true, render: (r) => <b>{r.title ?? ''}</b> },
    { key: 'regDate', header: t.cols.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '' },
  ];
  return (
    <AdminPage title={t.title} lead={t.lead}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ status: '', q: '', category: '' }); reset(); }}>
        <FilterField label={t.status} htmlFor="cs-st" width={120}><ASelect id="cs-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={adm.community.inquiries.statuses} /></FilterField>
        <FilterField label={t.category} htmlFor="cs-cat" width={140}><AInput id="cs-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></FilterField>
        <FilterField label={t.q} htmlFor="cs-q" width={220}><AInput id="cs-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(x) => setP({ page: x })} onRowClick={setSel} selectedKey={sel?.idx} dense />
      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={`${t.title} · #${sel?.idx ?? ''}`} subtitle={sel ? `${sel.id ?? ''} · ${sel.name ?? ''} · ${sel.regDate ?? ''}` : ''} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="primary" disabled={!canWrite || !answer.trim()} title={readOnlyTitle} loading={save.isPending} onClick={() => sel && save.mutate({ idx: sel.idx, text: answer.trim() })}>{adm.community.inquiries.answer} {adm.common.save}</AButton></>}>
        {sel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DescList cols={2} items={[['아이디', sel.id], ['이름', sel.name], ['휴대폰', sel.mobile], ['이메일', sel.email], ['분류', sel.category], ['관련 수강', [sel.lectureCode, sel.studySeq ? `Seq ${sel.studySeq}` : null, sel.contentsIdx ? `Contents ${sel.contentsIdx}` : null].filter(Boolean).join(' · ')], ['첨부', sel.file ? sel.file.name ?? sel.file.file : null], ['학습자 첨부', sel.studentFile ? sel.studentFile.name ?? sel.studentFile.file : null]]} />
            <div><h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{sel.title}</h3><div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, padding: 12, background: 'var(--c-soft)', borderRadius: 6 }}>{sel.contents ?? ''}</div></div>
            {sel.answer.contents ? <p className="muted" style={{ fontSize: 12, margin: 0 }}>{adm.community.inquiries.prevAnswer}: {sel.answer.name ?? ''} · {sel.answer.regDate ?? ''}</p> : null}
            <div><label htmlFor="cs-answer" style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>{adm.community.inquiries.answer}</label><ATextarea id="cs-answer" rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={adm.community.inquiries.answerPlaceholder} maxLength={20000} disabled={!canWrite} /></div>
          </div>
        ) : null}
      </DetailDrawer>
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/cheating
export function CheatingPage() {
  const t = adm.community.cheating;
  const [p, setP, reset] = useSearchState({ status: '', page: 1 });
  const [status, setStatus] = useState(p.status);
  const query = useMemo(() => ({ status: p.status || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'cheating', query], queryFn: ({ signal }) => adminApi.cheating(query, signal), placeholderData: keepPreviousData });
  const [sel, setSel] = useState<CheatingRow | null>(null);
  const columns: Column<CheatingRow>[] = [
    { key: 'idx', header: t.cols.idx, align: 'right', sortable: true },
    { key: 'status', header: t.cols.status, align: 'center', render: (r) => statusBadge(r.status, !!r.answeredAt) },
    { key: 'name', header: t.cols.name, render: (r) => r.name ?? '' },
    { key: 'category', header: t.cols.category, render: (r) => r.category ?? '' },
    { key: 'title', header: t.cols.title, sortable: true, render: (r) => <b>{r.title ?? ''}</b> },
    { key: 'mobile', header: t.cols.contact, render: (r) => [r.mobile, r.email].filter(Boolean).join(' · ') },
    { key: 'regDate', header: t.cols.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '' },
    { key: 'answeredAt', header: t.cols.answered, nowrap: true, render: (r) => [r.answeredBy, r.answeredAt].filter(Boolean).join(' · ') },
  ];
  return (
    <AdminPage title={t.title} lead={t.lead}>
      <FilterBar onSubmit={() => setP({ status }, true)} onReset={() => { setStatus(''); reset(); }}>
        <FilterField label={adm.community.inquiries.status} htmlFor="ch-st" width={120}><AInput id="ch-st" value={status} onChange={(e) => setStatus(e.target.value)} maxLength={10} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(x) => setP({ page: x })} onRowClick={setSel} selectedKey={sel?.idx} dense />
      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={`${t.title} · #${sel?.idx ?? ''}`} subtitle={sel?.regDate ?? ''}>
        {sel ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><DescList items={[['제보자', sel.name], ['분류', sel.category], ['연락처', [sel.mobile, sel.email].filter(Boolean).join(' · ')], ['상태', sel.status], ['처리', [sel.answeredBy, sel.answeredAt].filter(Boolean).join(' · ')]]} /><div><h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{sel.title}</h3><div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, padding: 12, background: 'var(--c-soft)', borderRadius: 6 }}>{sel.contents ?? ''}</div></div></div> : null}
      </DetailDrawer>
    </AdminPage>
  );
}
