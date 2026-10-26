import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { MANAGER_FILE, downloadManagerFile, managerApi, type CohortParams, type EducationReport } from '../../../shared/api/endpoints/manager';
import { useToast } from '../../../app/providers/ToastProvider';
import { AButton, Callout, StatusBadge } from '../../../shared/ui/admin';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { isAppError } from '../../../shared/api/client';
import { BarList, ManagerError } from '../managerUi';
import { mgr } from '../strings';

const r = mgr.reports;
const AI_SECTIONS = [1, 2, 3, 4];

/** One "AI 분석결과" box, kept outside the formal report body (AR-21: AI text is not part of the report until a person confirms it). */
function AiPanel({ params }: { params: CohortParams }) {
  const results = useQueries({ queries: AI_SECTIONS.map((section) => ({ queryKey: ['manager', 'report-ai', params, section], queryFn: ({ signal }: { signal: AbortSignal }) => managerApi.educationReportAi({ ...params, section }, signal), staleTime: 10 * 60_000, retry: false })) });
  return (
    <section className={`${styles.panel} ${styles.noPrint}`} style={{ marginTop: 18 }}>
      <h2>{r.ai}</h2>
      <p className={styles.note} style={{ marginTop: 0 }}>{r.aiNote}</p>
      {results.map((q, i) => (
        <div key={AI_SECTIONS[i]} className={styles.aiBox}>
          <h4>{r.aiSections[i]}{q.data ? ` · ${q.data.model === 'ai' ? 'AI' : '대체 문구'}` : ''}</h4>
          {q.isPending ? <span className="muted">{mgr.common.loading}</span> : q.isError ? <span className="muted">{r.aiFail}</span> : <span style={{ whiteSpace: 'pre-line' }}>{q.data?.feedback}</span>}
        </div>
      ))}
    </section>
  );
}

function ReportBody({ d }: { d: EducationReport }) {
  const S = d.summary; const v = d.v1; const C = d.competence;
  const monthMax = Math.max(1, ...d.monthly.map((m) => m.avgTime));
  return (
    <article className={styles.report}>
      <table><tbody><tr><th style={{ width: '18%' }}>문서번호</th><td /><th style={{ width: '18%' }}>접수일자</th><td>{v.receiptDate}</td></tr></tbody></table>
      <table><tbody><tr><th rowSpan={2} style={{ width: '12%' }}>결재</th><th>담당</th><th /><th /><th>대표이사</th></tr><tr><td style={{ height: 40 }} /><td /><td /><td /></tr></tbody></table>
      <span className={styles.banner}>디지털 원격 훈련 아카이브</span>
      <h1>{v.title}</h1>
      <p className={styles.meta}>{d.meta.companyName}</p>
      <table><tbody>
        <tr><th style={{ width: '22%' }}>훈련과정</th><td colSpan={3}>{d.meta.courseName}</td></tr>
        <tr><th>훈련기관</th><td colSpan={3}>{d.meta.trainingPeriod}</td></tr>
        <tr><th>훈련인원</th><td colSpan={3}>총 {S.totalTrainees}명</td></tr>
        <tr><th>훈련목표</th><td colSpan={3} className={styles.left}>1. 재직근로자의 직무역량 강화<br />2. 직무 전문성 향상 및 실무 적용도 강화</td></tr>
        <tr><th>제출기관</th><td colSpan={3}>{v.submitOrg}</td></tr>
        <tr><th rowSpan={2}>작성자</th><th>소속</th><th colSpan={2}>성명</th></tr>
        <tr><td>{v.authorDept}</td><td colSpan={2}>{v.authorName}</td></tr>
        <tr><th>제출일자</th><td colSpan={3}>{v.submitDate}</td></tr>
      </tbody></table>

      <h2>학습 성과 요약</h2>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>총 학습인원</span><b>{S.totalTrainees}명</b></div>
        <div className={styles.metric}><span>평균 진도율</span><b>{S.avgProgressRate}%</b></div>
        <div className={styles.metric}><span>평균 학습시간</span><b>{S.avgStudyHours}시간 {S.avgStudyMinutes}분</b></div>
      </div>
      <div className={styles.grid2}>
        <div><h3 style={{ fontSize: 13 }}>수료 상태 분포</h3><BarList unit="%" max={100} items={v.statusLabels.map((label, i) => ({ label, value: v.statusPercents[i] ?? 0 }))} /></div>
        <div><h3 style={{ fontSize: 13 }}>월별 평균 학습시간 (훈련기간 기준 5개월)</h3><BarList unit="시간" max={monthMax} items={d.monthly.map((m) => ({ label: m.month, value: m.avgTime }))} /></div>
      </div>

      <h2>역량 변화 및 만족도 분석 리포트</h2>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>만족도</span><b>{S.avgSatisfaction}/5</b><small>설문 응답자 {S.satisfactionRespondents}명 기준입니다.</small></div>
        <div className={styles.metric}><span>평균 역량 점수</span><b>{C.overallAfter}점</b><small className={C.overallChange > 0 ? styles.up : C.overallChange < 0 ? styles.down : undefined}>{C.overallChange > 0 ? `${C.overallChange}점 상승했습니다.` : C.overallChange < 0 ? `${Math.abs(C.overallChange)}점 하락했습니다.` : '변화가 없습니다.'}</small></div>
        <div className={styles.metric}><span>참여자 수</span><b>{S.totalTrainees}명</b></div>
      </div>
      <table><thead><tr><th>영역</th><th>사전</th><th>사후</th><th>변화율</th></tr></thead>
        <tbody>{v.competenceRows.map((x) => <tr key={x.label}><td>{x.label}</td><td>{x.before}점</td><td>{x.after}점</td><td className={x.change.startsWith('-') ? styles.down : styles.up}>{x.change}</td></tr>)}</tbody></table>

      <h2>훈련생별 수료현황표</h2>
      <table><thead><tr><th>번호</th><th>성명</th><th>진도율</th><th>공통점수</th><th>직무점수</th><th>리더십점수</th><th>만족도</th><th>수료여부</th></tr></thead>
        <tbody>{v.trainees.length ? v.trainees.map((t) => <tr key={t.id}><td>{t.no}</td><td>{t.name}</td><td>{t.progress}%</td><td>{t.commonScore}점</td><td>{t.jobScore}점</td><td>{t.leadershipScore}점</td><td>{t.satisfaction}점</td><td>{t.status}</td></tr>) : <tr><td colSpan={8}>선택한 과정·수강기간의 학습자가 없습니다.</td></tr>}</tbody></table>

      <h2>AI 종합 분석 및 개선</h2>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>참여율</span><b>{S.participationRate}%</b></div>
        <div className={styles.metric}><span>수료율</span><b>{S.completionRatePercent}%</b></div>
        <div className={styles.metric}><span>재참여 의향</span><b>{S.reParticipationRate}%</b></div>
      </div>
      <p className={styles.note}>{r.disclaimer}</p>
      <p className={styles.note}>{r.personalNote} {mgr.reports.asOfLine(d.asOf, d.digest)}</p>
    </article>
  );
}

/** 교육결과보고서 (education_results_report.php) — formal company report, re-aggregated on every request. */
export default function EducationReportPage() {
  const [sp] = useSearchParams();
  const { toast } = useToast();
  const params = useMemo<CohortParams>(() => ({ companyCode: sp.get('companyCode') ?? '', lectureCode: sp.get('lectureCode') ?? '', lectureStart: sp.get('lectureStart') ?? '', lectureEnd: sp.get('lectureEnd') ?? '', serviceType: sp.get('serviceType') || undefined }), [sp]);
  const ready = !!(params.companyCode && params.lectureCode && params.lectureStart && params.lectureEnd);
  const q = useQuery({ queryKey: ['manager', 'education-report', params], queryFn: ({ signal }) => managerApi.educationReport(params, signal), enabled: ready, retry: false });
  const d = q.data;
  const seen = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (!d) return; if (seen.current && seen.current !== d.digest) setChanged(true); seen.current = d.digest; const prev = document.title; document.title = `${d.meta.companyName}_교육결과보고서`; return () => { document.title = prev; }; }, [d]);

  /** 반출 직전 재검사: re-aggregate and stop when the digest moved (보고서 집계 변경). */
  const recheck = async () => {
    const before = seen.current;
    const fresh = await q.refetch();
    if (fresh.data && before && fresh.data.digest !== before) { setChanged(true); return false; }
    return !!fresh.data;
  };
  const print = async () => { if (await recheck()) window.print(); };
  const exportFile = async (kind: 'csv' | 'html') => {
    setBusy(kind);
    try {
      if (!(await recheck())) return;
      await downloadManagerFile(kind === 'csv' ? MANAGER_FILE.reportCsv : MANAGER_FILE.reportHtml, { ...params }, `교육결과보고서.${kind}`);
      toast(r.exportDone, { tone: 'ok' });
    } catch (e) { toast(e instanceof Error && e.message ? e.message : r.exportFail, { tone: 'danger' }); } finally { setBusy(null); }
  };

  return (
    <div>
      <div className={`${styles.head} ${styles.noPrint}`}>
        <div><h1>{r.education}</h1><p>{r.lead}</p></div>
        <div className={styles.headActions}>
          <AButton to="/manager/reports">{r.back}</AButton>
          <AButton icon="download" onClick={() => void exportFile('csv')} loading={busy === 'csv'} disabled={!d}>{r.csv}</AButton>
          <AButton icon="download" onClick={() => void exportFile('html')} loading={busy === 'html'} disabled={!d}>{r.html}</AButton>
          <AButton variant="primary" icon="file" onClick={() => void print()} disabled={!d}>{r.print}</AButton>
        </div>
      </div>
      {!ready ? <Callout tone="warn">회사·과정·수강기간 정보가 올바르지 않습니다.</Callout> : null}
      {q.isError ? (isAppError(q.error) && (q.error.status === 404 || q.error.status === 409 || q.error.status === 400) ? <Callout tone="warn">{q.error.message}</Callout> : <ManagerError error={q.error} onRetry={() => void q.refetch()} />) : null}
      {ready && q.isPending ? <Skeleton lines={10} /> : null}
      {d ? (
        <>
          <div className={`${styles.noPrint} stack`} style={{ marginBottom: 14 }}>
            <div className={styles.badges}>
              <StatusBadge tone={d.confirmed ? 'ok' : 'warn'}>{d.confirmed ? r.confirmed : r.unconfirmed}</StatusBadge>
              <StatusBadge tone="neutral">{mgr.asOf(d.asOf)}</StatusBadge>
              <StatusBadge tone="neutral">{r.digest(d.digest)}</StatusBadge>
              <StatusBadge tone="neutral">{r.deadline(d.reportDeadline)}</StatusBadge>
            </div>
            {changed ? <Callout tone="warn">{r.changed}</Callout> : null}
            <Callout>{r.hrdNote} {r.blocked}</Callout>
          </div>
          <ReportBody d={d} />
          <AiPanel params={params} />
        </>
      ) : null}
    </div>
  );
}
