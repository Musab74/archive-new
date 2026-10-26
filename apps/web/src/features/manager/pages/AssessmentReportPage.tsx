import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi, type AssessmentReport } from '../../../shared/api/endpoints/manager';
import { useManager } from '../ManagerContext';
import { AButton, Callout } from '../../../shared/ui/admin';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { BarList, ManagerError } from '../managerUi';
import { mgr } from '../strings';

const r = mgr.reports;

function Body({ d }: { d: AssessmentReport }) {
  const S = d.summary; const C = d.competence;
  return (
    <article className={styles.report}>
      <table><tbody><tr><th style={{ width: '18%' }}>문서번호</th><td /><th style={{ width: '18%' }}>접수일자</th><td>{d.meta.receiptDate}</td></tr></tbody></table>
      <table><tbody><tr><th rowSpan={2} style={{ width: '12%' }}>결재</th><th>담당</th><th /><th /><th>대표이사</th></tr><tr><td style={{ height: 40 }} /><td /><td /><td /></tr></tbody></table>
      <span className={styles.banner}>디지털 원격 훈련 아카이브</span>
      <h1>디지털 원격 훈련 아카이브</h1>
      <table><tbody>
        <tr><th style={{ width: '22%' }}>훈련과정</th><td colSpan={3}>{d.meta.courseName}</td></tr>
        <tr><th>훈련기간</th><td colSpan={3}>{d.meta.trainingPeriod}</td></tr>
        <tr><th>훈련인원</th><td colSpan={3}>총 {S.totalTrainees}명</td></tr>
        <tr><th>훈련목표</th><td colSpan={3} className={styles.left}>1. 재직근로자의 직무역량 강화<br />2. 직무 전문성 향상 및 실무 적용도 강화</td></tr>
        <tr><th>제출기관</th><td colSpan={3}>(주)HRDE</td></tr>
        <tr><th rowSpan={2}>작성자</th><th>소속</th><th colSpan={2}>성명</th></tr>
        <tr><td>아카이브</td><td colSpan={2}>{d.meta.authorName}</td></tr>
        <tr><th>제출일자</th><td colSpan={3}>{d.meta.submitDate}</td></tr>
      </tbody></table>

      <h2>역량변화 결과 요약 · 학습 성과 요약</h2>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>총 학습인원</span><b>{S.totalTrainees}명</b></div>
        <div className={styles.metric}><span>평균 진도율</span><b>{S.avgProgressRate}%</b></div>
        <div className={styles.metric}><span>평균 역량 점수</span><b>{C.overallAfter}점</b><small className={C.overallChange > 0 ? styles.up : C.overallChange < 0 ? styles.down : undefined}>{C.overallChange > 0 ? `${C.overallChange}점 상승했습니다.` : C.overallChange < 0 ? `${Math.abs(C.overallChange)}점 하락했습니다.` : '변화가 없습니다.'}</small></div>
      </div>
      <div className={styles.grid2}>
        <div><h3 style={{ fontSize: 13 }}>수료 상태 분포</h3><BarList unit="%" max={100} items={[{ label: '완료', value: d.statusPercents.completed }, { label: '진행중', value: d.statusPercents.inProgress }, { label: '미시작', value: d.statusPercents.notStarted }]} /></div>
        <div><h3 style={{ fontSize: 13 }}>영역별 사전 사후 역량 비교</h3>
          <table><thead><tr><th>영역</th><th>사전</th><th>사후</th><th>변화율</th></tr></thead>
            <tbody>{C.rows.map((x) => <tr key={x.label}><td>{x.label}</td><td>{x.before}점</td><td>{x.after}점</td><td className={x.change.startsWith('-') ? styles.down : styles.up}>{x.change}</td></tr>)}</tbody></table>
        </div>
      </div>

      <h2>역량 변화 및 만족도 분석 리포트</h2>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>만족도</span><b>{S.avgSatisfaction}/5</b></div>
        <div className={styles.metric}><span>평균 역량 점수</span><b>{C.overallAfter}점</b></div>
        <div className={styles.metric}><span>참여자 수</span><b>{S.totalTrainees}명</b></div>
      </div>

      <h2>훈련생별 수료현황표</h2>
      <table><thead><tr><th>번호</th><th>성명</th><th>진도율</th><th>공통점수</th><th>직무점수</th><th>리더십점수</th><th>만족도</th><th>수료여부</th></tr></thead>
        <tbody>{d.trainees.length ? d.trainees.map((t) => <tr key={t.id}><td>{t.no}</td><td>{t.name}</td><td>{t.progress}%</td><td>{t.commonScore}점</td><td>{t.jobScore}점</td><td>{t.leadershipScore}점</td><td>{t.satisfaction}점</td><td>{t.status}</td></tr>) : <tr><td colSpan={8}>해당 조건에 맞는 수강생 데이터가 없습니다.</td></tr>}</tbody></table>

      <h2>훈련생별 역량진단 결과 현황표</h2>
      <table><thead><tr><th>연번</th><th>성명</th><th>사전역량 진단일</th><th>사후역량 진단일</th><th>공통 점수 변화</th><th>직무점수 변화</th><th>리더십점수 변화</th><th>총점 변화</th></tr></thead>
        <tbody>{d.changes.length ? d.changes.map((t) => <tr key={t.id}><td>{t.no}</td><td>{t.name}</td><td>{t.preDate}</td><td>{t.postDate}</td><td>{t.common}</td><td>{t.job}</td><td>{t.leadership}</td><td>{t.total}</td></tr>) : <tr><td colSpan={8}>역량진단 데이터가 없습니다.</td></tr>}</tbody></table>

      <h2>AI 종합 분석 및 개선</h2>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>참여율</span><b>{S.participationRate}%</b></div>
        <div className={styles.metric}><span>수료율</span><b>{S.completionRatePercent}%</b></div>
        <div className={styles.metric}><span>재참여 의향</span><b>{S.reParticipationRate}%</b></div>
      </div>
      <p className={styles.note}>{r.disclaimer}</p>
      <p className={styles.note}>{r.personalNote}</p>
    </article>
  );
}

/** 역량진단 보고서 (manager_test_result.php, printed with the browser) — limited to the manager's companies. */
export default function AssessmentReportPage() {
  const [sp] = useSearchParams();
  const { companyCode: selected } = useManager();
  const query = useMemo(() => ({ companyCode: sp.get('companyCode') || selected || undefined, lectureCode: sp.get('lectureCode') || undefined, lectureStart: sp.get('lectureStart') || undefined, lectureEnd: sp.get('lectureEnd') || undefined }), [sp, selected]);
  const q = useQuery({ queryKey: ['manager', 'assessment-report', query], queryFn: ({ signal }) => managerApi.assessmentReport(query, signal), retry: false });
  const d = q.data;
  useEffect(() => { if (!d) return; const prev = document.title; document.title = d.fileTitle; return () => { document.title = prev; }; }, [d]);
  return (
    <div>
      <div className={`${styles.head} ${styles.noPrint}`}>
        <div><h1>{r.assessment}</h1><p>환급 과정의 진행 중 수강을 대상으로 한 역량진단 결과 보고서입니다. 브라우저 인쇄로 PDF 저장할 수 있습니다.</p></div>
        <div className={styles.headActions}><AButton to="/manager/trainees">{mgr.trainee.back}</AButton><AButton variant="primary" icon="file" onClick={() => window.print()} disabled={!d}>{r.print}</AButton></div>
      </div>
      {q.isError ? <ManagerError error={q.error} onRetry={() => void q.refetch()} /> : q.isPending ? <Skeleton lines={10} /> : d ? (
        <>
          <Callout className={styles.noPrint}>{r.personalNote}</Callout>
          <Body d={d} />
        </>
      ) : null}
    </div>
  );
}
