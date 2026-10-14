import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { CompanyTerms, MemberRow, StudyRow } from '../../../../shared/api/schemas';
import { AButton, ACheckbox, AdminPage, ASelect, Bar, BoolBadge, Callout, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, Kpi, StatusBadge, TabStrip, YnBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { formatNumber } from '../../../../shared/utils/format';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm, studyTime } from '../../strings';
import { CompanyForm, diffPatchBody, fromCompany, validateCompanyForm, type CompanyFormValues, type FormErrors } from './CompanyForm';

type TermRow = CompanyTerms['items'][number];
const SUB_SIZE = 10;
const thisYear = new Date().getFullYear();
const YEARS: { value: string; label: string }[] = [{ value: 'all', label: adm.companies.detail.termsAll }, ...Array.from({ length: 7 }, (_, i) => ({ value: String(thisYear - i), label: tr(`${thisYear - i}년`, String(thisYear - i)) }))];
const USE = { yes: tr('사용', 'On'), no: tr('미사용', 'Off') };

const termCols: Column<TermRow>[] = [
  { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => i + 1 },
  { key: 'courseName', header: adm.companies.detail.termsCols.course, render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
  { key: 'period', header: adm.companies.detail.termsCols.period, nowrap: true, render: (r) => `${r.start} ~ ${r.end}` },
  { key: 'count', header: adm.companies.detail.termsCols.count, align: 'right', nowrap: true, render: (r) => `${r.enrolled} / ${r.passed}` },
  { key: 'passRate', header: adm.companies.detail.termsCols.rate, width: 130, render: (r) => <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Bar value={r.passRate} tone={r.passRate >= 80 ? 'ok' : undefined} /><span style={{ fontSize: 12 }}>{r.passRate}%</span></div> },
  { key: 'price', header: adm.companies.detail.termsCols.price, align: 'right', render: (r) => formatNumber(r.price) },
  { key: 'refund', header: adm.companies.detail.termsCols.refund, align: 'right', render: (r) => formatNumber(r.refund) },
];
const memberCols: Column<MemberRow>[] = [
  { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> },
  { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
  { key: 'depart', header: tr('부서·직위', 'Dept · title'), render: (r) => [r.depart, r.position].filter(Boolean).join(' · ') },
  { key: 'eduManager', header: tr('교육담당자', 'Manager'), align: 'center', render: (r) => (r.eduManager ? <StatusBadge tone="info">{tr('담당자', 'Manager')}</StatusBadge> : '') },
  { key: 'enrollments', header: tr('수강', 'Courses'), align: 'right' },
  { key: 'lastLogin', header: tr('최종로그인', 'Last login'), nowrap: true, render: (r) => r.lastLogin ?? '—' },
  { key: 'regDate', header: tr('가입일', 'Joined'), nowrap: true, render: (r) => (r.regDate ?? '').slice(0, 10) },
  { key: 'useYN', header: tr('계정 사용', 'Active'), align: 'center', render: (r) => <YnBadge value={r.useYN} /> },
];
const studyCols: Column<StudyRow>[] = [
  { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <Link to={`/admin/studies/${r.studySeq}`}>{r.studySeq}</Link> },
  { key: 'name', header: tr('이름 / ID', 'Name / ID'), render: (r) => <span>{r.name ?? ''}<br /><small className="muted">{r.id}</small></span> },
  { key: 'courseName', header: tr('과정명 / 수강기간', 'Course / period'), render: (r) => <span title={r.lectureCode}>{r.courseName}<br /><small className="muted">{r.period.start} ~ {r.period.end}</small></span> },
  { key: 'percent', header: tr('진도율', 'Progress'), width: 120, render: (r) => <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Bar value={r.percent} tone={r.over15h ? 'ok' : undefined} /><span style={{ fontSize: 12 }}>{r.percent}%</span></div> },
  { key: 'formatted', header: tr('학습시간', 'Study time'), align: 'right', nowrap: true, render: (r) => studyTime(r.seconds, r.formatted) },
  { key: 'passOk', header: tr('수료', 'Completion'), align: 'center', render: (r) => <BoolBadge value={r.passOk} yes={tr('수료', 'Completed')} no={r.studyEnd ? tr('미수료', 'Not completed') : tr('진행', 'In progress')} /> },
  { key: 'tutor', header: tr('교·강사', 'Tutor'), render: (r) => r.tutor ?? '' },
];

export default function CompanyDetailPage() {
  const { idx: idxParam = '' } = useParams();
  const idx = Number(idxParam);
  const s = adm.companies.detail;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'company', idx], queryFn: ({ signal }) => adminApi.company(idx, signal), enabled: Number.isInteger(idx) && idx > 0 });
  const meta = useQuery({ queryKey: ['admin', 'companies', 'meta'], queryFn: ({ signal }) => adminApi.companyMeta(signal), staleTime: 5 * 60_000 });
  const d = q.data; const co = d?.company;

  const [year, setYear] = useState<string>(String(thisYear));
  const terms = useQuery({ queryKey: ['admin', 'company', idx, 'terms', year], queryFn: ({ signal }) => adminApi.companyTerms(idx, year === 'all' ? 'all' : Number(year), signal), enabled: !!co, placeholderData: keepPreviousData });

  const [tab, setTab] = useState<'members' | 'studies'>('members');
  const [mPage, setMPage] = useState(1); const [sPage, setSPage] = useState(1);
  const members = useQuery({ queryKey: ['admin', 'members', { companyCode: co?.companyCode, page: mPage, size: SUB_SIZE }], queryFn: ({ signal }) => adminApi.members({ companyCode: co!.companyCode, page: mPage, size: SUB_SIZE }, signal), enabled: !!co && tab === 'members', placeholderData: keepPreviousData });
  const studies = useQuery({ queryKey: ['admin', 'studies', { companyCode: co?.companyCode, page: sPage, size: SUB_SIZE }], queryFn: ({ signal }) => adminApi.studies({ companyCode: co!.companyCode, page: sPage, size: SUB_SIZE }, signal), enabled: !!co && tab === 'studies', placeholderData: keepPreviousData });

  // edit
  const [editOpen, setEditOpen] = useState(false);
  const base = useMemo(() => (co ? fromCompany(co) : null), [co]);
  const [form, setForm] = useState<CompanyFormValues | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [availBlocked, setAvailBlocked] = useState(false);
  useEffect(() => { if (editOpen && base) { setForm(base); setErrors({}); } }, [editOpen, base]);
  const patch = useAdminMutation({
    fn: (body: Record<string, unknown>) => adminApi.patchCompany(idx, body), invalidate: [['admin', 'company', idx], ['admin', 'companies']], success: adm.companies.form.saved, onSuccess: () => setEditOpen(false),
    onError: (err) => { if (isAppError(err) && Array.isArray(err.details)) { const e: FormErrors = {}; for (const x of err.details as { path?: string; message?: string }[]) if (x.path) e[x.path as keyof FormErrors] = x.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); },
  });
  const submitEdit = () => { if (!form || !base) return; const e = validateCompanyForm(form, 'edit'); setErrors(e); if (Object.keys(e).length || availBlocked) return; const body = diffPatchBody(base, form); if (!Object.keys(body).length) { toast(adm.companies.form.noChange); setEditOpen(false); return; } patch.mutate(body); };

  // delete (409 → force)
  const [delOpen, setDelOpen] = useState(false);
  const [blocked, setBlocked] = useState<{ members: number; studies: number } | null>(null);
  const [force, setForce] = useState(false);
  const del = useAdminMutation({
    fn: (f: boolean) => adminApi.deleteCompany(idx, f), invalidate: [['admin', 'companies']], success: s.deleted, onSuccess: () => navigate('/admin/companies'),
    onError: (err) => { if (isAppError(err) && err.code === 'CONFLICT' && (err.details as { requiresForce?: boolean } | undefined)?.requiresForce) { const x = err.details as { members: number; studies: number }; setBlocked({ members: x.members, studies: x.studies }); return; } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); },
  });

  const title = `${s.title}${co ? ` · ${co.companyName}` : ''}`;
  const unitP = tr('명', ''); const unitC = tr('건', '');
  return (
    <AdminPage title={title} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.companies.title, to: '/admin/companies' }, { label: co?.companyName ?? idxParam }]}
      actions={<><AButton to="/admin/companies">{adm.common.back}</AButton><AButton onClick={() => setEditOpen(true)} disabled={!canWrite || !d} title={readOnlyTitle}>{s.edit}</AButton><AButton variant="danger" onClick={() => { setBlocked(null); setForce(false); setDelOpen(true); }} disabled={!canWrite || !d} title={readOnlyTitle}>{s.delete}</AButton></>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d || !co ? <Skeleton lines={10} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Kpi label={s.kpi.members} value={d.stats.members} unit={unitP} tone="navy" />
            <Kpi label={s.kpi.activeMembers} value={d.stats.activeMembers} unit={unitP} />
            <Kpi label={s.kpi.eduManagers} value={d.stats.eduManagers} unit={unitP} />
            <Kpi label={s.kpi.enrollments} value={d.stats.enrollments} unit={unitC} />
            <Kpi label={s.kpi.passed} value={d.stats.passed} unit={unitC} tone="ok" hint={d.stats.enrollments ? `${Math.round((d.stats.passed / d.stats.enrollments) * 100)}%` : undefined} />
            <Kpi label={s.kpi.active} value={d.stats.activeEnrollments} unit={unitC} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
            <Card title={s.basic}>
              <DescList items={[[tr('회사 규모', 'Size'), co.scaleLabel], [tr('회사명', 'Company'), co.companyName], [tr('사업자 번호', 'Business no.'), <span key="b" className="mono">{co.bizNo}</span>], [tr('사업주 ID', 'Company ID'), <span key="i" className="mono">{co.companyId}</span>], [tr('HRD 번호', 'HRD number'), co.hrd], [tr('대표자명', 'CEO'), co.ceo], [tr('업태 / 업종', 'Type / industry'), [co.uptae, co.upjong].filter(Boolean).join(' / ')], [tr('등록일', 'Registered'), co.regDate]]} />
            </Card>
            <Card title={s.contact}>
              <DescList items={[[tr('대표 전화', 'Main phone'), co.tel], [tr('고객센터 전화', 'Help-desk phone'), <span key="t2">{co.tel2 ?? '—'} <YnBadge value={co.csEnabled} yes={USE.yes} no={USE.no} /></span>], [tr('대표 팩스', 'Main fax'), co.fax], [tr('고객센터 팩스', 'Help-desk fax'), co.fax2], [tr('이메일', 'E-mail'), co.email], [tr('주소', 'Address'), [co.zipcode ? `[${co.zipcode}]` : '', co.address01, co.address02].filter(Boolean).join(' ')], [tr('계좌정보', 'Bank account'), [co.bankName, co.bankNumber].filter(Boolean).join(' ')]]} />
            </Card>
            <Card title={s.manager}>
              <DescList items={[[tr('교육담당자', 'Manager'), co.eduManager], [tr('연락처', 'Mobile'), co.eduManagerPhone], [tr('이메일', 'E-mail'), co.eduManagerEmail], [s.managersAccounts, d.managers.length ? <ul key="m" style={{ margin: 0, paddingLeft: 16 }}>{d.managers.map((m) => <li key={m.id}><Link to={`/admin/members/${encodeURIComponent(m.id)}`}>{m.name ?? m.id}</Link> <span className="muted">({m.id}{m.useYN === 'N' ? tr(' · 미사용', ' · inactive') : ''})</span></li>)}</ul> : null]]} />
            </Card>
            <Card title={s.ops}>
              <DescList items={[[tr('기업관리코드', 'Management code'), <span key="h" className="mono">{co.manageCode}</span>], [tr('사이버교육센터', 'Cyber training centre'), <span key="c">{co.cyberUrl ?? '—'} <YnBadge value={co.cyberEnabled} yes={USE.yes} no={USE.no} /></span>], [tr('독려문자 수신', 'Nudge SMS'), <StatusBadge key="s" tone={co.sendSMS === 'N' ? 'warn' : 'ok'}>{co.sendSMSLabel}</StatusBadge>], [tr('메모', 'Memo'), co.remark]]} />
            </Card>
            <Card title={s.sales}>
              {d.sales ? <DescList items={[[tr('영업담당자', 'Sales rep'), `${d.sales.name ?? ''} (${d.sales.id ?? ''})${d.sales.useYN === 'N' ? tr(' · 미사용 계정', ' · inactive account') : ''}`], [tr('소속', 'Team'), d.sales.team], [tr('휴대폰', 'Mobile'), d.sales.mobile], [s.salesPath, d.sales.deptPath || d.sales.deptName]]} /> : <Callout tone="warn">{tr('영업담당자 정보가 없습니다.', 'No sales rep on record.')}</Callout>}
            </Card>
          </div>

          <Card title={s.terms} aside={<div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}><span>{s.termsYear}</span><div style={{ width: 130 }}><ASelect aria-label={s.termsYear} value={year} onChange={(e) => setYear(e.target.value)} options={YEARS} /></div></div>}>
            <DataTable columns={termCols} rows={terms.data?.items} rowKey={(r) => `${r.lectureCode}:${r.start}:${r.end}`} loading={terms.isPending || terms.isFetching} error={terms.error} onRetry={() => void terms.refetch()} emptyTitle={s.termsEmpty} dense />
          </Card>

          <Card title={tab === 'members' ? `${s.members} (${formatNumber(members.data?.total ?? d.stats.members)})` : `${s.studies} (${formatNumber(studies.data?.total ?? d.stats.enrollments)})`}
            aside={<Link to={tab === 'members' ? `/admin/members?companyCode=${encodeURIComponent(co.companyCode)}` : `/admin/studies?companyCode=${encodeURIComponent(co.companyCode)}`} style={{ fontSize: 12 }}>{s.viewAll}</Link>}>
            <TabStrip label={tr('연결 정보', 'Related records')} value={tab} onChange={(k) => setTab(k as 'members' | 'studies')} items={[{ key: 'members', label: s.members }, { key: 'studies', label: s.studies }]} />
            {tab === 'members'
              ? <DataTable columns={memberCols} rows={members.data?.items} rowKey={(r) => r.idx} loading={members.isPending || members.isFetching} error={members.error} onRetry={() => void members.refetch()} page={mPage} size={SUB_SIZE} total={members.data?.total} onPageChange={setMPage} emptyTitle={tr('수강생 정보가 없습니다.', 'No members.')} dense />
              : <DataTable columns={studyCols} rows={studies.data?.items} rowKey={(r) => r.studySeq} loading={studies.isPending || studies.isFetching} error={studies.error} onRetry={() => void studies.refetch()} page={sPage} size={SUB_SIZE} total={studies.data?.total} onPageChange={setSPage} emptyTitle={tr('수강 내역이 없습니다.', 'No enrollments.')} dense />}
          </Card>
        </div>
      )}

      <DetailDrawer open={editOpen} onClose={() => setEditOpen(false)} title={adm.companies.form.editTitle} subtitle={co ? `${co.companyName} · ${co.bizNo}` : ''} wide
        footer={<><AButton onClick={() => setEditOpen(false)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={patch.isPending} disabled={!canWrite || !form || availBlocked} onClick={submitEdit}>{adm.common.save}</AButton></>}>
        {form && base ? <CompanyForm mode="edit" values={form} onChange={setForm} meta={meta.data} errors={errors} excludeIdx={idx} original={base} onAvailability={setAvailBlocked} disabled={!canWrite} /> : null}
      </DetailDrawer>

      <ConfirmDialog open={delOpen} title={s.delete} tone="danger" confirmLabel={blocked ? s.forceDelete : s.delete} loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(!!blocked && force)}
        body={<div><p>{s.deleteBody}</p>{co ? <p className="u-mt-8"><b>{co.companyName}</b> <span className="mono">{co.bizNo}</span></p> : null}
          {blocked ? <div className="u-mt-16"><Callout tone="warn">{s.deleteBlocked(blocked.members, blocked.studies)}</Callout><div className="u-mt-8"><ACheckbox label={s.forceDelete} checked={force} onChange={(e) => setForce(e.target.checked)} /></div></div> : null}</div>} />
    </AdminPage>
  );
}
