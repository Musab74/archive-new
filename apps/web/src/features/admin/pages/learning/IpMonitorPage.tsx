import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useCourseInfo } from './learningCourseInfo';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type IpDetailRow, type IpGroupRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Card, DataTable, DescList, DetailDrawer, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { EXPORT_CONFIRM, MONTH_ALL, MemberLink, PendingHint, StudyLink, TERM_PARAM_DEFAULTS, TermSearchFields, progressValidationError, termFromParams, termQuery, termToParams, termValidationError, useCsvDownload, useLearningOptions, type TermForm } from './learningShared';

const DEFAULTS = { ...TERM_PARAM_DEFAULTS, viewMode: 'group', ip: '', id: '', progress1: '', progress2: '', page: 1, go: 0 };
const riskTone = (level: IpGroupRow['riskLevel']): 'danger' | 'warn' | 'info' => (level === 'danger' ? 'danger' : level === 'warn' ? 'warn' : 'info');

/** study_ip.php — IP모니터링 (B1): 묶음 보기(사업장+IP) / 상세 보기 + 차시별 상세 수강내역. */
export default function IpMonitorPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [sp] = useSearchParams();
  const [term, setTerm] = useState(termFromParams(p));
  const [form, setForm] = useState({ viewMode: p.viewMode, ip: p.ip, id: p.id, progress1: p.progress1, progress2: p.progress2 });
  /** study_ip.php?ID= / ?ip_addr= (이상데이터 links): fill ID/IP, 월=전체, 상세 보기, search at once. */
  useEffect(() => {
    if (p.go === 1) return;
    const id = sp.get('ID') ?? sp.get('id') ?? ''; const ip = sp.get('ip_addr') ?? sp.get('ip') ?? '';
    if (!id && !ip) return;
    const t = { ...termFromParams(DEFAULTS), month: MONTH_ALL };
    setTerm(t); setForm({ viewMode: 'detail', ip, id, progress1: '', progress2: '' });
    setP({ ...termToParams(t), viewMode: 'detail', ip, id, progress1: '', progress2: '', go: 1 }, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const options = useLearningOptions();
  const [exporting, download] = useCsvDownload();
  const { toast } = useToast();
  const [courseLink, courseDrawer] = useCourseInfo();
  const go = p.go === 1;
  const filters = useMemo(() => ({ ...termQuery(p), ip: p.ip || undefined, id: p.id || undefined, progress1: p.progress1 || undefined, progress2: p.progress2 || undefined }), [p]);
  const size = p.viewMode === 'group' ? 20 : 30;
  const query = useMemo(() => ({ ...filters, viewMode: p.viewMode, page: p.page, size }), [filters, p.viewMode, p.page, size]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'ip-monitor', query], queryFn: ({ signal }) => adminLearningApi.ipMonitor(query, signal), placeholderData: keepPreviousData, enabled: go });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * size;
  /** function.js StudyIPSearch(): 사업주명 required in 사업주 검색; 진도율 both digits or both empty. */
  const submit = (t: TermForm = term) => { const err = termValidationError(t) ?? progressValidationError(form.progress1, form.progress2); if (err) { toast(err, { tone: 'danger' }); return; } setP({ ...termToParams(t), ...form, go: 1 }, true); };
  const commit = (t: TermForm) => { setTerm(t); if (t.searchGubun === 'A') submit(t); };
  /** Excel uses the current form (the PHP posted the form), after the PHP confirm. */
  const exportCsv = () => { const err = termValidationError(term); if (err) { toast(err, { tone: 'danger' }); return; } if (!EXPORT_CONFIRM()) return; const tp = termToParams(term); void download(() => adminLearningApi.downloadIpCsv({ ...termQuery(tp), ip: form.ip || undefined, id: form.id || undefined, progress1: form.progress1 || undefined, progress2: form.progress2 || undefined })); };

  const [group, setGroup] = useState<IpGroupRow | null>(null);
  const members = useQuery({ queryKey: ['admin', 'learning', 'ip-group', group?.companyCode, group?.ip], queryFn: ({ signal }) => adminLearningApi.ipGroup(group!.companyCode, group!.ip, signal), enabled: !!group });
  const [seq, setSeq] = useState<number | null>(null);
  const chapters = useQuery({ queryKey: ['admin', 'learning', 'ip-chapters', seq], queryFn: ({ signal }) => adminLearningApi.ipChapters(seq!, signal), enabled: seq !== null });

  const groupCols: Column<IpGroupRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'companyName', header: tr('사업장', 'Company'), render: (r) => <b title={r.companyCode}>{r.companyName ?? r.companyCode}</b> },
    { key: 'address', header: tr('사업장 주소', 'Address'), render: (r) => <>{r.address01 ?? ''}<br />{r.address02 ?? ''}</> },
    { key: 'ip', header: tr('수강 IP', 'Study IP'), nowrap: true, render: (r) => <b className="mono">{r.ip}</b> },
    { key: 'userCount', header: tr('인원수', 'Learners'), align: 'right', render: (r) => <b>{tr(`${r.userCount}명`, String(r.userCount))}</b> },
    { key: 'recordCount', header: tr('학습레코드', 'Records'), align: 'right', render: (r) => tr(`${r.recordCount}건`, String(r.recordCount)) },
    { key: 'courseCount', header: tr('과정수', 'Courses'), align: 'right' },
    { key: 'avgProgress', header: tr('평균진도', 'Avg progress'), align: 'right', render: (r) => `${r.avgProgress}%` },
    { key: 'progressDiff', header: tr('진도편차', 'Spread'), align: 'right', render: (r) => `${r.progressDiff}%p` },
    { key: 'riskLabel', header: tr('위험도', 'Risk'), align: 'center', render: (r) => <StatusBadge tone={riskTone(r.riskLevel)}>{r.riskLabel}</StatusBadge> },
    { key: 'detail', header: tr('상세', 'Details'), align: 'center', render: (r) => <AButton size="xs" onClick={() => setGroup(r)}>{tr('펼치기', 'Expand')}</AButton> },
  ];
  const detailCols: Column<IpDetailRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'sales', header: <>{tr('영업자', 'Sales rep')}<br />{tr('영업자 소속', 'Team')}</>, render: (r) => <>{r.salesName ?? ''}<br />{r.salesTeam ?? ''}</> },
    { key: 'companyName', header: tr('사업자', 'Company'), render: (r) => r.companyName ?? r.companyCode ?? '' },
    { key: 'address', header: tr('사업자 주소', 'Address'), render: (r) => <>{r.address01 ?? ''}<br />{r.address02 ?? ''}</> },
    { key: 'id', header: <>{tr('이름', 'Name')}<br />ID</>, nowrap: true, render: (r) => <MemberLink id={r.id}>{r.name ?? ''}<br />{r.id}</MemberLink> },
    { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => courseLink(r.lectureCode, r.courseName) },
    { key: 'period', header: tr('수강기간', 'Term'), nowrap: true, render: (r) => <>{r.lectureStart} ~ {r.lectureEnd}<br /><span className="muted">{tr('첨삭완료', 'Tutoring by')} : {r.tutorLimit}{tr('까지', '')}</span></> },
    { key: 'ip', header: tr('수강IP', 'Study IP'), nowrap: true, render: (r) => <><span className="mono">{r.ip ?? ''}</span>{r.duplicate ? <> <StatusBadge tone="danger">{tr('중복', 'Duplicate')}</StatusBadge></> : null}{r.similarPattern ? <> <StatusBadge tone="info">{tr('유사패턴', 'Similar')}</StatusBadge></> : null}</> },
    { key: 'chapters', header: tr('차시별 내역', 'Chapters'), align: 'center', render: (r) => <AButton size="xs" onClick={() => setSeq(r.studySeq)}>{tr('상세 보기', 'Details')}</AButton> },
  ];
  const d = chapters.data;
  return (
    <AdminPage title={tr('IP모니터링', 'IP monitoring')} lead={tr('묶음 보기: 동일 사업장에서 같은 IP로 2명 이상이 학습한 경우만 표시합니다. 위험도 — 주의(2명) · 의심(3~4명) · 위험(5명+).', 'Grouped view lists (company, IP) pairs shared by 2+ learners. Risk: caution (2) · suspicious (3–4) · danger (5+).')}>
      <FilterBar onSubmit={() => submit()} onReset={() => { setTerm(termFromParams(DEFAULTS)); setForm({ viewMode: 'group', ip: '', id: '', progress1: '', progress2: '' }); reset(); }}
        extra={<AButton onClick={exportCsv} loading={exporting}>{tr('검색 결과 엑셀(CSV) 출력', 'Export CSV')}</AButton>}>
        <TermSearchFields value={term} onChange={setTerm} onCommit={commit} options={options.data} idPrefix="ip" termOnCompanySearch={false} />
        <FilterField label="IP" htmlFor="ip-ip" width={180}><AInput id="ip-ip" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value.trim() })} className="mono" /></FilterField>
        <FilterField label={tr('보기 방식', 'View')} htmlFor="ip-mode" width={190}><ASelect id="ip-mode" value={form.viewMode} onChange={(e) => setForm({ ...form, viewMode: e.target.value })} options={[{ value: 'group', label: tr('묶음 보기 (사업장+IP)', 'Grouped (company + IP)') }, { value: 'detail', label: tr('상세 보기', 'Detail rows') }]} /></FilterField>
        <FilterField label={tr('이름, ID', 'Name / ID')} htmlFor="ip-id" width={150}><AInput id="ip-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></FilterField>
        <FilterField label={tr('진도율 (%)', 'Progress (%)')} width={180}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AInput aria-label={tr('진도율 시작', 'Progress from')} value={form.progress1} inputMode="numeric" style={{ width: 64 }} onChange={(e) => setForm({ ...form, progress1: e.target.value.replace(/\D/g, '') })} /> ~ <AInput aria-label={tr('진도율 끝', 'Progress to')} value={form.progress2} inputMode="numeric" style={{ width: 64 }} onChange={(e) => setForm({ ...form, progress2: e.target.value.replace(/\D/g, '') })} /></div></FilterField>
      </FilterBar>
      {!go ? <PendingHint /> : list.data?.mode === 'detail' || (p.viewMode === 'detail' && !list.data) ? (
        <DataTable columns={detailCols} rows={list.data?.mode === 'detail' ? list.data.items : undefined} rowKey={(r) => r.studySeq} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')} page={p.page} size={size} total={total} onPageChange={(n) => setP({ page: n })} dense />
      ) : (
        <DataTable caption={tr(`총 ${total.toLocaleString('ko-KR')}건`, `${total} groups`)} columns={groupCols} rows={list.data?.mode === 'group' ? list.data.items : undefined} rowKey={(r) => `${r.companyCode}|${r.ip}`} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('2명 이상이 동일 IP로 학습한 묶음이 없습니다.', 'No (company, IP) pair shared by 2+ learners.')} page={p.page} size={size} total={total} onPageChange={(n) => setP({ page: n })} dense />
      )}

      <DetailDrawer open={!!group} onClose={() => setGroup(null)} title={group ? `${group.companyName ?? group.companyCode} · ${group.ip}` : ''} subtitle={group ? tr(`${group.userCount}명 · ${group.recordCount}건 · ${group.riskLabel}`, `${group.userCount} learners · ${group.recordCount} records · ${group.riskLabel}`) : ''} wide footer={<AButton onClick={() => setGroup(null)}>{adm.common.close}</AButton>}>
        <DataTable columns={[
          { key: 'no', header: 'No', align: 'right', width: 48, render: (_r, i) => i + 1 },
          { key: 'id', header: tr('이름 / ID', 'Name / ID'), nowrap: true, render: (r) => <MemberLink id={r.id}>{r.name ?? ''}<br />{r.id}</MemberLink> },
          { key: 'sales', header: tr('영업자', 'Sales rep'), render: (r) => <>{r.salesName ?? ''}<br />{r.salesTeam ?? ''}</> },
          { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => courseLink(r.lectureCode, r.courseName) },
          { key: 'period', header: tr('수강기간', 'Term'), nowrap: true, render: (r) => <>{r.lectureStart} ~<br />{r.lectureEnd}</> },
          { key: 'progress', header: tr('진도', 'Progress'), align: 'right', render: (r) => `${r.progress}%` },
          { key: 'passOk', header: tr('수료', 'Passed'), align: 'center', render: (r) => (r.passOk ? tr('수료', 'Passed') : tr('미수료', 'Not passed')) },
          { key: 'certCount', header: tr('실명인증', 'Identity'), align: 'right', render: (r) => tr(`${r.certCount}회`, String(r.certCount)) },
          { key: 'seq', header: tr('상세보기', 'Details'), align: 'center', render: (r) => <AButton size="xs" onClick={() => setSeq(r.studySeq)}>{tr('차시별', 'Chapters')}</AButton> },
        ]} rows={members.data?.items} rowKey={(r) => r.studySeq} loading={members.isPending} error={members.error} dense />
      </DetailDrawer>

      <DetailDrawer open={seq !== null} onClose={() => setSeq(null)} title={tr('차시별 상세 수강내역', 'Chapter-by-chapter record')} subtitle={d ? <>{d.courseName} · <StudyLink seq={d.studySeq}>Seq {d.studySeq}</StudyLink></> : ''} wide footer={<AButton onClick={() => setSeq(null)}>{tr('닫  기', 'Close')}</AButton>}>
        {d ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <Card><DescList items={[[tr('과정명', 'Course'), d.courseName], [tr('수강 기간', 'Term'), `${d.lectureStart} ~ ${d.lectureEnd}`], [tr('학습자', 'Learner'), <MemberLink key="m" id={d.id} />], [tr('저장된 진도율', 'Stored progress'), `${d.storedProgress}%`]]} cols={2} /></Card>
            <DataTable columns={[
              { key: 'chapterNumber', header: tr('차시', 'Chapter'), align: 'center', render: (r) => r.chapterNumber ?? '' },
              { key: 'title', header: tr('차시명', 'Title'), render: (r) => r.title ?? '' },
              { key: 'progress', header: tr('진도', 'Progress'), align: 'right', render: (r) => `${r.progress}%` },
              { key: 'formatted', header: tr('수강시간', 'Study time'), align: 'right', nowrap: true },
              { key: 'ip', header: tr('수강IP', 'IP'), nowrap: true, render: (r) => <span className="mono">{r.ip ?? ''}</span> },
              { key: 'at', header: tr('수강일', 'Studied at'), nowrap: true, render: (r) => r.at ?? '' },
            ]} rows={d.items} rowKey={(r, i) => `${r.contentsIdx}-${i}`} dense emptyTitle={tr('학습 내역이 없습니다.', 'No records.')}
              footer={<b>{tr(`총 수강시간 (${d.chapterCount}개 차시): ${d.totalFormatted}`, `Total (${d.chapterCount} chapters): ${d.totalFormatted}`)}</b>} />
          </div>
        ) : chapters.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>
      {courseDrawer}
    </AdminPage>
  );
}
