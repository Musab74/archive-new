import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi, type AiUserDetail } from '../../../../shared/api/endpoints/admin-learning';
import { AButton, Bar, Card, DataTable, DescList, DetailDrawer, StatusBadge } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { StudyLink } from './learningShared';

const stateTone = (s: string) => (s === '수료완료' ? 'ok' : s === '진행중' ? 'warn' : 'neutral') as 'ok' | 'warn' | 'neutral';

/** 최근 30일 학습시간 추이 (minutes per day) — single-series line, hover tooltip per point, table fallback below. */
function PatternChart({ id, points }: { id: string; points: AiUserDetail['pattern'] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>{tr(`최근 30일간 학습 기록이 없습니다. (사용자 ID: ${id})`, `No study in the last 30 days. (user: ${id})`)}</p>;
  const W = 640; const H = 220; const L = 44; const R = 12; const T = 14; const B = 40;
  const max = Math.max(1, ...points.map((p) => p.minutes)); const nice = Math.ceil(max / 10) * 10 || 10;
  const x = (i: number) => (points.length === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / nice);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.minutes).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(nice * f));
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ fontSize: 13, marginBottom: 4 }}>{tr(`학습시간 (분) — 사용자: ${id}`, `Study minutes — user: ${id}`)}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={tr('최근 30일 일별 학습시간(분) 추이', 'Daily study minutes, last 30 days')} style={{ maxWidth: W, overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--c-line, #e5e7eb)" strokeWidth={1} /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--c-muted, #6b7280)">{t}</text></g>)}
        <text x={12} y={T + (H - T - B) / 2} fontSize={11} fill="var(--c-muted, #6b7280)" transform={`rotate(-90 12 ${T + (H - T - B) / 2})`} textAnchor="middle">{tr('학습시간 (분)', 'Minutes')}</text>
        <path d={area} fill="var(--c-primary, #2563eb)" opacity={0.1} />
        <path d={line} fill="none" stroke="var(--c-primary, #2563eb)" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => <g key={p.date}>
          <rect x={x(i) - 12} y={T} width={24} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
          <circle cx={x(i)} cy={y(p.minutes)} r={hover === i ? 5 : 4} fill="var(--c-paper, #fff)" stroke="var(--c-primary, #2563eb)" strokeWidth={2} pointerEvents="none" />
          {points.length <= 12 || i % Math.ceil(points.length / 10) === 0 ? <text x={x(i)} y={H - B + 16} textAnchor="middle" fontSize={11} fill="var(--c-muted, #6b7280)">{p.label}</text> : null}
        </g>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--c-muted, #6b7280)">{tr('날짜', 'Date')}</text>
        {hover !== null ? (() => { const p = points[hover]!; const tx = Math.min(W - R - 110, Math.max(L, x(hover) - 55)); return <g pointerEvents="none"><line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--c-muted, #9ca3af)" strokeDasharray="3 3" /><rect x={tx} y={T} width={110} height={36} rx={6} fill="var(--c-ink, #111827)" opacity={0.92} /><text x={tx + 8} y={T + 15} fontSize={11} fill="#fff">{p.label}</text><text x={tx + 8} y={T + 29} fontSize={12} fill="#fff" fontWeight={600}>{tr(`${p.minutes}분`, `${p.minutes} min`)}</text></g>; })() : null}
      </svg>
      <details style={{ fontSize: 12 }}><summary>{tr('표로 보기', 'Show table')}</summary><table className="mono" style={{ borderCollapse: 'collapse' }}><tbody>{points.map((p) => <tr key={p.date}><td style={{ padding: '2px 8px' }}>{p.date}</td><td style={{ padding: '2px 8px', textAlign: 'right' }}>{p.minutes}</td></tr>)}</tbody></table></details>
    </figure>
  );
}

/** ai_user_detail_pop.php — AI 로그·로드맵 상세 분석 (opened from the ID / 이름 cells and from 학습관리 "AI 분석"). */
export function AiUserDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'learning', 'ai-user', id], queryFn: ({ signal }) => adminLearningApi.aiUserDetail(id!, signal), enabled: !!id });
  const d = q.data;
  const allEmpty = d ? d.recommend.steps.every((s) => !s.items.length) : false;
  return (
    <DetailDrawer open={!!id} onClose={onClose} title={tr('AI 로그·로드맵 상세 분석', 'AI log · roadmap details')} subtitle={d ? `${d.basic.name ?? ''} (${d.basic.id})` : id ?? ''} wide footer={<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton>}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : !d ? <p className="muted">{adm.common.loading}</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          <Card>
            <DescList cols={2} items={[
              [tr('사용자 ID', 'User ID'), d.basic.id], [tr('이름', 'Name'), d.basic.name], [tr('소속기관', 'Company'), d.basic.companyName],
              [tr('부서', 'Department'), d.basic.depart], [tr('직위', 'Position'), d.basic.position], [tr('가입일', 'Joined'), d.basic.regDate],
              [tr('이메일', 'E-mail'), d.basic.email], [tr('휴대폰', 'Mobile'), d.basic.mobile],
            ]} />
          </Card>
          <Card title={tr('학습 요약 통계', 'Learning summary')}>
            <DescList cols={2} items={[
              [tr('전체 과정 수', 'Courses'), tr(`${d.summary.totalCourses.toLocaleString('ko-KR')}개`, String(d.summary.totalCourses))], [tr('평균 진도율', 'Avg progress'), `${d.summary.avgProgress}%`],
              [tr('수료 완료', 'Completed'), tr(`${d.summary.completedCount}개 / ${d.summary.totalStudyCount}개`, `${d.summary.completedCount} / ${d.summary.totalStudyCount}`)], [tr('총 학습시간', 'Study time'), d.summary.studyTimeLabel],
              [tr('수료율', 'Pass rate'), `${d.summary.passRate}%`], [tr('학습 상태', 'State'), <StatusBadge key="s" tone={stateTone(d.summary.state)}>{d.summary.state}</StatusBadge>],
            ]} />
          </Card>
          {d.preAssessment ? (
            <Card title={tr('사전역량진단 결과', 'Pre-assessment')}>
              <DescList cols={2} items={[
                [tr('사용자 유형', 'User type'), d.preAssessment.userGroup], [tr('진단일', 'Date'), d.preAssessment.diagnosisDate],
                [tr('개선 필요 역량', 'Needs work'), d.preAssessment.weakAreasTop5.length ? d.preAssessment.weakAreasTop5.join(', ') : tr('없음', 'None')],
              ]} />
              <div style={{ marginTop: 12, padding: 10, background: 'var(--c-warn-soft, #fff3cd)', borderRadius: 6, fontSize: 13 }}>
                <b>{tr('개선 권장 역량', 'Recommended to improve')}:</b> {d.preAssessment.weakAreasTop5.join(', ')}<br /><small className="muted">{tr('위 역량을 보완할 수 있는 AI 과정이 추천됩니다.', 'AI courses that cover these are recommended.')}</small>
              </div>
            </Card>
          ) : null}
          <Card title={tr('AI 추천 과정 (AI Zone / HRDe 로드맵)', 'AI recommended courses (AI Zone / roadmap)')}>
            {allEmpty ? <p className="muted" style={{ textAlign: 'center' }}>{tr('AI Zone 로드맵 추천 과정이 없습니다.', 'No roadmap recommendations.')}<br /><small>{tr(`추천 과정 수: ${d.recommend.recommendedCount}개 · 사용 가능한 과정 수: ${d.recommend.candidateCount}개`, `${d.recommend.recommendedCount} recommended · ${d.recommend.candidateCount} available`)}</small></p> : (
              <div style={{ display: 'grid', gap: 12 }}>
                {d.recommend.steps.filter((s) => s.items.length).map((s) => (
                  <section key={s.title}>
                    <h4 style={{ margin: '0 0 4px' }}>{s.title}</h4>
                    <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>{s.description}</p>
                    <DataTable dense rows={s.items} rowKey={(r) => r.code} columns={[
                      { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 50, render: (_r, i) => i + 1 },
                      { key: 'name', header: tr('과정명', 'Course'), render: (r) => <>{r.name}{s.showReason && r.recommendReason ? <div className="muted" style={{ fontSize: 12 }}>💡 {r.recommendReason}</div> : null}</> },
                      { key: 'category', header: tr('카테고리', 'Category'), render: (r) => r.category },
                      { key: 'time', header: tr('시간', 'Time'), align: 'right', nowrap: true, render: (r) => tr(`${r.time}분`, `${r.time} min`) },
                      { key: 'chapter', header: tr('차시', 'Chapters'), align: 'right', nowrap: true, render: (r) => tr(`${r.chapter}차시`, String(r.chapter)) },
                    ]} />
                  </section>
                ))}
              </div>
            )}
          </Card>
          <Card title={tr('과정별 학습 로드맵 (수강 중인 과정)', 'Roadmap (active enrollments)')}>
            <DataTable dense rows={d.roadmap} rowKey={(r) => r.studySeq} emptyTitle={tr('수강 중인 과정이 없습니다.', 'No active enrollment.')} columns={[
              { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 50, render: (r) => r.no },
              { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => <StudyLink seq={r.studySeq}>{r.courseName}</StudyLink> },
              { key: 'start', header: tr('학습시작일', 'Start'), nowrap: true, render: (r) => r.lectureStart },
              { key: 'end', header: tr('학습종료일', 'End'), nowrap: true, render: (r) => r.lectureEnd },
              { key: 'progress', header: tr('진도율', 'Progress'), width: 160, render: (r) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px', gap: 6, alignItems: 'center' }}><Bar value={r.progress} tone={r.progressTone === 'ok' ? 'ok' : r.progressTone === 'warn' ? 'warn' : undefined} /><span style={{ color: r.progressTone === 'danger' ? 'var(--c-danger)' : undefined }}>{r.progress.toFixed(1)}%</span></div> },
              { key: 'time', header: tr('학습시간', 'Time'), nowrap: true, render: (r) => r.studyTimeLabel },
              { key: 'pass', header: tr('수료상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={r.passLabel === '수료완료' ? 'ok' : r.passLabel === '종료' ? 'neutral' : 'warn'}>{r.passLabel}</StatusBadge> },
              { key: 'learning', header: tr('학습상태', 'Learning'), align: 'center', render: (r) => r.learningLabel },
            ]} />
          </Card>
          <Card title={tr('학습 패턴 분석', 'Study pattern')}><PatternChart id={d.basic.id} points={d.pattern} /></Card>
        </div>
      )}
    </DetailDrawer>
  );
}
