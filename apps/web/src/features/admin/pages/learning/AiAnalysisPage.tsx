import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type AiRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Bar, Card, DataTable, DateField, FilterBar, FilterField, Kpi, StatusBadge, adminStyles, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { MemberLink, useCsvDownload } from './learningShared';

const DEFAULTS = { col: 'ID', q: '', startDate: '', endDate: '', passOK: '', companyCode: '', progress1: '', progress2: '', page: 1 };
const SIZE = 30;

function Dist({ label, value, total, tone }: { label: string; value: number; total: number; tone?: 'ok' | 'warn' }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px', gap: 10, alignItems: 'center', fontSize: 13 }}><span>{label}</span><Bar value={total ? (value / total) * 100 : 0} tone={tone} /><span style={{ textAlign: 'right' }}>{tr(`${value.toLocaleString('ko-KR')}명`, value.toLocaleString('en-US'))}</span></div>;
}

/** ai_log_roadmap_analysis.php — AI 로그·로드맵 분석 (B9): per-member summary of active enrollments + overall statistics. */
export default function AiAnalysisPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q, startDate: p.startDate, endDate: p.endDate, passOK: p.passOK, companyCode: p.companyCode, progress1: p.progress1, progress2: p.progress2 });
  const [exporting, download] = useCsvDownload();
  const filters = useMemo(() => ({ col: p.col, q: p.q || undefined, startDate: p.startDate || undefined, endDate: p.endDate || undefined, passOK: p.passOK || undefined, companyCode: p.companyCode || undefined, progress1: p.progress1 || undefined, progress2: p.progress2 || undefined }), [p]);
  const query = useMemo(() => ({ ...filters, page: p.page, size: SIZE }), [filters, p.page]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'ai-analysis', query], queryFn: ({ signal }) => adminLearningApi.aiAnalysis(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const s = list.data?.summary;
  const pb = s?.progressBuckets; const sb = s?.statusBuckets;
  const pbTotal = pb ? pb.high + pb.medium + pb.low : 0; const sbTotal = sb ? sb.completed + sb.notCompleted : 0;
  const columns: Column<AiRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'id', header: tr('사용자 ID', 'User ID'), nowrap: true, render: (r) => <MemberLink id={r.id} /> },
    { key: 'name', header: tr('이름', 'Name'), nowrap: true, render: (r) => <MemberLink id={r.id}>{r.name ?? ''}</MemberLink> },
    { key: 'courseNames', header: tr('과정명', 'Courses'), render: (r) => r.courseNames ?? <span className="muted">{tr('수강 없음', 'No enrollment')}</span> },
    { key: 'companyName', header: tr('사업주', 'Company'), render: (r) => r.companyName ?? '-' },
    { key: 'progressLabel', header: tr('진도율', 'Progress'), align: 'right', nowrap: true },
    { key: 'studyTimeLabel', header: tr('학습시간', 'Study time'), align: 'right', nowrap: true },
    { key: 'period', header: tr('학습기간', 'Period'), nowrap: true, render: (r) => (r.lectureStart && r.lectureEnd ? `${r.lectureStart} ~ ${r.lectureEnd}` : '-') },
    { key: 'completion', header: tr('수료상태', 'Status'), align: 'center', render: (r) => r.completion === '-' ? <span className="muted">-</span> : <StatusBadge tone={r.completion === '수료' ? 'ok' : 'warn'}>{r.completion === '수료' ? tr('수료', 'Completed') : tr('미수료', 'In progress')}</StatusBadge> },
  ];
  return (
    <AdminPage title={tr('AI 로그·로드맵 분석', 'AI log · roadmap analysis')} lead={tr('활성 회원별 진행 중 수강(StudyEnd=N) 요약입니다. 전체 통계·분포는 필터와 무관(5분 캐시), 평균 진도율은 검색된 사용자 기준입니다.', 'Per-member summary of active enrollments. Overall statistics ignore the filters (5-min cache); the average progress follows the search.')}
      actions={<AButton onClick={() => void download(() => adminLearningApi.downloadAiCsv(filters))} loading={exporting} disabled={total === 0}>{tr('Excel(CSV) 다운로드', 'Download CSV')}</AButton>}>
      <Card title={tr('전체 통계', 'Overall statistics')}>
        <div className={adminStyles.kpis} aria-busy={list.isPending}>
          <Kpi icon="user" label={tr('전체 사용자', 'Members')} value={s?.totalUsers} unit={tr('명', '')} />
          <Kpi icon="book" label={tr('전체 과정', 'Enrollments')} value={s?.totalCourses} unit={tr('개', '')} hint={tr('진행 중 수강(회원×과정)', 'active member × course pairs')} />
          <Kpi icon="activity" label={tr('평균 진도율', 'Average progress')} value={s ? `${s.avgProgress}%` : undefined} tone="navy" hint={s ? tr(`전체 평균 ${s.generalAvgProgress}% · 검색 대상 ${s.filteredUsersWithCourses}명`, `overall ${s.generalAvgProgress}% · ${s.filteredUsersWithCourses} filtered`) : undefined} />
          <Kpi icon="award" label={tr('수료 완료', 'Completed')} value={s?.completedCount} unit={tr('건', '')} tone="ok" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          <Card title={tr('진도율 분포', 'Progress distribution')}>{pb ? <div style={{ display: 'grid', gap: 8 }}><Dist label={tr('80% 이상', '80% +')} value={pb.high} total={pbTotal} tone="ok" /><Dist label="50-80%" value={pb.medium} total={pbTotal} tone="warn" /><Dist label={tr('50% 미만', 'Below 50%')} value={pb.low} total={pbTotal} /></div> : <p className="muted">{adm.common.loading}</p>}</Card>
          <Card title={tr('학습 상태 분포', 'Status distribution')}>{sb ? <div style={{ display: 'grid', gap: 8 }}><Dist label={tr('수료', 'Completed')} value={sb.completed} total={sbTotal} tone="ok" /><Dist label={tr('미수료', 'In progress')} value={sb.notCompleted} total={sbTotal} tone="warn" /></div> : <p className="muted">{adm.common.loading}</p>}</Card>
        </div>
      </Card>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'ID', q: '', startDate: '', endDate: '', passOK: '', companyCode: '', progress1: '', progress2: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="ai-col" width={130}><ASelect id="ai-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ID', label: tr('사용자 ID', 'User ID') }, { value: 'Name', label: tr('이름', 'Name') }, { value: 'ContentsName', label: tr('과정명', 'Course') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="ai-q" width={240}><AInput id="ai-q" value={form.q} placeholder={tr('검색어 입력', 'Keyword')} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={tr('학습시작일 (부터)', 'Start date from')} htmlFor="ai-sd"><DateField id="ai-sd" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} /></FilterField>
        <FilterField label={tr('학습시작일 (까지)', 'Start date to')} htmlFor="ai-ed"><DateField id="ai-ed" value={form.endDate} min={form.startDate || undefined} onChange={(v) => setForm({ ...form, endDate: v })} /></FilterField>
        <FilterField label={tr('수료상태', 'Status')} htmlFor="ai-po" width={140}><ASelect id="ai-po" value={form.passOK} onChange={(e) => setForm({ ...form, passOK: e.target.value })} options={[{ value: '', label: tr('수료상태 전체', 'All') }, { value: 'N', label: tr('미수료', 'In progress') }, { value: 'Y', label: tr('수료', 'Completed') }]} /></FilterField>
        <FilterField label={tr('사업주 코드', 'Company code')} htmlFor="ai-cc" width={150}><AInput id="ai-cc" value={form.companyCode} onChange={(e) => setForm({ ...form, companyCode: e.target.value.trim() })} /></FilterField>
        <FilterField label={tr('진도율 (%)', 'Progress (%)')} width={180}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AInput aria-label={tr('진도율 시작', 'Progress from')} value={form.progress1} inputMode="numeric" style={{ width: 64 }} onChange={(e) => setForm({ ...form, progress1: e.target.value.replace(/\D/g, '') })} /> ~ <AInput aria-label={tr('진도율 끝', 'Progress to')} value={form.progress2} inputMode="numeric" style={{ width: 64 }} onChange={(e) => setForm({ ...form, progress2: e.target.value.replace(/\D/g, '') })} /></div></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.id} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('등록된 내용이 없습니다.', 'No records.')} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} dense />
    </AdminPage>
  );
}
