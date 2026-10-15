import type { CSSProperties, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminStudiesParityApi, type AiDetail } from '../../../../shared/api/endpoints/admin-studies-parity';
import { AButton, Callout } from '../../../../shared/ui/admin';
import { Modal } from '../../../../shared/ui/Modal';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';

/** hrd_manager ai_user_detail_pop.php — AI 로그·로드맵 상세 분석, opened from the 학습관리 "AI 분석" button. */

const th: CSSProperties = { background: 'var(--c-surface-2, #f4f6f9)', border: '1px solid var(--c-line, #ddd)', padding: '6px 8px', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' };
const td: CSSProperties = { border: '1px solid var(--c-line, #ddd)', padding: '6px 8px', textAlign: 'center' };
const tdLeft: CSSProperties = { ...td, textAlign: 'left' };
const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13, margin: '6px 0 14px' };
const h3: CSSProperties = { fontSize: 15, margin: '18px 0 6px' };
const STEP_COLOR = ['#4CAF50', '#2196F3', '#FF9800'];
const TONE: Record<string, string> = { ok: 'green', warn: 'orange', neutral: 'gray' };
const BAR: Record<string, string> = { ok: '#4CAF50', warn: '#FF9800', danger: '#F44336' };

function InfoGrid({ rows }: { rows: [ReactNode, ReactNode][][] }) {
  return (
    <table style={table}><tbody>
      {rows.map((r, i) => <tr key={i}>{r.map(([k, v], j) => [<th key={`h${j}`} scope="row" style={th}>{k}</th>, <td key={`d${j}`} style={tdLeft}>{v}</td>])}</tr>)}
    </tbody></table>
  );
}

function StepTable({ step }: { step: AiDetail['roadmap']['steps'][number] }) {
  if (!step.items.length) return null;
  const color = STEP_COLOR[step.step - 1] ?? '#666';
  return (
    <div style={{ background: 'var(--c-surface-2, #f8f9fa)', padding: 12, marginBottom: 12, borderRadius: 6, borderLeft: `4px solid ${color}` }}>
      <h4 style={{ margin: '0 0 6px', color, fontSize: 15 }}>{step.title}</h4>
      <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>{step.reason}</p>
      <table style={{ ...table, margin: 0 }}>
        <thead><tr>{[tr('번호', 'No.'), tr('과정명', 'Course'), tr('카테고리', 'Category'), tr('시간', 'Time'), tr('차시', 'Chapters')].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{step.items.map((c, i) => (
          <tr key={`${c.code}-${i}`}>
            <td style={td}>{i + 1}</td>
            <td style={tdLeft}>{c.name}{step.showReasons && c.recommendReason ? <><br /><small className="muted" style={{ fontStyle: 'italic' }}>{c.recommendReason}</small></> : null}</td>
            <td style={td}>{c.category}</td><td style={td}>{c.time}{tr('분', ' min')}</td><td style={td}>{c.chapter}{tr('차시', ' ch.')}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function AiDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'studies', 'ai-detail', id], queryFn: ({ signal }) => adminStudiesParityApi.aiDetail(id!, signal), enabled: !!id });
  const d = q.data;
  const maxMin = Math.max(1, ...(d?.pattern ?? []).map((p) => p.minutes));
  return (
    <Modal open={!!id} onClose={onClose} title={tr('AI 로그·로드맵 상세 분석', 'AI log & roadmap detail')} size="lg" actions={<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton>}>
      {q.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void q.refetch()} /> : !d ? <p className="muted">…</p> : (
        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <InfoGrid rows={[
            [[tr('사용자 ID', 'User ID'), d.user.id], [tr('이름', 'Name'), d.user.name ?? ''], [tr('소속기관', 'Company'), d.user.companyName]],
            [[tr('부서', 'Dept.'), d.user.depart], [tr('직위', 'Position'), d.user.position], [tr('가입일', 'Joined'), d.user.regDate ?? '']],
            [[tr('이메일', 'E-mail'), d.user.email], [tr('휴대폰', 'Mobile'), d.user.mobile], ['', '']],
          ]} />

          <h3 style={h3}>{tr('학습 요약 통계', 'Learning summary')}</h3>
          <InfoGrid rows={[
            [[tr('전체 과정 수', 'Courses'), tr(`${d.summary.totalCourses.toLocaleString('ko-KR')}개`, String(d.summary.totalCourses))], [tr('평균 진도율', 'Avg. progress'), `${d.summary.avgProgress}%`], [tr('수료 완료', 'Completed'), tr(`${d.summary.completedCount.toLocaleString('ko-KR')}개 / ${d.summary.totalStudyCount.toLocaleString('ko-KR')}개`, `${d.summary.completedCount} / ${d.summary.totalStudyCount}`)]],
            [[tr('총 학습시간', 'Study time'), d.summary.studyTimeLabel], [tr('수료율', 'Completion rate'), `${d.summary.completionRate}%`], [tr('학습 상태', 'State'), <span key="s" style={{ color: TONE[d.summary.stateTone], fontWeight: d.summary.stateTone === 'neutral' ? 400 : 700 }}>{d.summary.state}</span>]],
          ]} />

          {d.assessment ? (
            <>
              <h3 style={h3}>{tr('사전역량진단 결과', 'Pre-assessment result')}</h3>
              <div style={{ background: '#f0f7ff', padding: 12, borderRadius: 6, borderLeft: '4px solid #2196F3' }}>
                <h4 style={{ margin: '0 0 6px', color: '#2196F3' }}>{tr('역량 진단 결과', 'Competency result')}</h4>
                <InfoGrid rows={[
                  [[tr('사용자 유형', 'User type'), d.assessment.userGroupLabel], [tr('진단일', 'Date'), d.assessment.diagnosisDate ?? '-']],
                  [[tr('공통역량 평균', 'Common avg.'), <strong key="c" style={{ color: '#4CAF50' }}>{d.assessment.averages.common ?? '-'}{tr('점', '')}</strong>], [tr('리더십역량 평균', 'Leadership avg.'), <strong key="l" style={{ color: '#2196F3' }}>{d.assessment.averages.leadership ?? '-'}{tr('점', '')}</strong>]],
                  [[tr('직무역량 평균', 'Job avg.'), <strong key="j" style={{ color: '#FF9800' }}>{d.assessment.averages.job ?? '-'}{tr('점', '')}</strong>], [tr('개선 필요 역량', 'To improve'), d.assessment.weakAreas.length ? d.assessment.weakAreas.slice(0, 5).join(', ') : tr('없음', 'None')]],
                ]} />
                {d.assessment.weakAreas.length ? <Callout tone="warn"><strong>{tr('개선 권장 역량:', 'Recommended to improve:')}</strong> {d.assessment.weakAreas.slice(0, 5).join(', ')}<br /><small className="muted">{tr('위 역량을 보완할 수 있는 AI 과정이 추천됩니다.', 'AI courses covering these are recommended.')}</small></Callout> : null}
              </div>
            </>
          ) : null}

          <h3 style={h3}>{tr('AI 추천 과정 (AI Zone / HRDe 로드맵)', 'AI recommended courses (AI Zone / HRDe roadmap)')}</h3>
          {d.roadmap.steps.some((s) => s.items.length) ? d.roadmap.steps.map((s) => <StepTable key={s.step} step={s} />) : (
            <div className="muted" style={{ padding: 24, textAlign: 'center', background: 'var(--c-surface-2, #f8f9fa)', borderRadius: 6 }}>
              <p style={{ margin: 0 }}>{tr('AI Zone 로드맵 추천 과정이 없습니다.', 'No roadmap recommendations.')}</p>
              <p style={{ margin: '8px 0 0', fontSize: 12 }}>{tr('사용자가 수강 중인 과정이 없거나 추천할 과정이 없습니다.', 'No open enrollment or no course to recommend.')}<br /><small>{d.roadmap.recommendedCount ? tr(`추천 과정 수: ${d.roadmap.recommendedCount}개`, `Recommended: ${d.roadmap.recommendedCount}`) : tr(`사용 가능한 과정 수: ${d.roadmap.availableCount}개`, `Available courses: ${d.roadmap.availableCount}`)}</small></p>
            </div>
          )}

          <h3 style={h3}>{tr('과정별 학습 로드맵 (수강 중인 과정)', 'Course roadmap (open enrollments)')}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead><tr>{[tr('번호', 'No.'), tr('과정명', 'Course'), tr('학습시작일', 'Start'), tr('학습종료일', 'End'), tr('진도율', 'Progress'), tr('학습시간', 'Study time'), tr('수료상태', 'Completion'), tr('학습상태', 'State')].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{d.courses.length ? d.courses.map((c) => (
                <tr key={c.studySeq}>
                  <td style={td}>{c.no}</td><td style={tdLeft}>{c.courseName}</td><td style={td}>{c.lectureStart}</td><td style={td}>{c.lectureEnd}</td>
                  <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ flex: 1, background: '#e0e0e0', height: 14, borderRadius: 3, overflow: 'hidden', minWidth: 60 }}><div style={{ background: BAR[c.progressTone], height: '100%', width: `${Math.min(100, c.progress)}%` }} /></div><span style={{ minWidth: 44, textAlign: 'right' }}>{c.progress}%</span></div></td>
                  <td style={td}>{c.studyTimeLabel}</td>
                  <td style={td}><span style={{ color: c.status === '수료완료' ? 'green' : c.status === '종료' ? 'gray' : 'orange', fontWeight: c.status === '수료완료' ? 700 : 400 }}>{c.status}</span></td>
                  <td style={td}><span style={{ color: c.studyState === '학습중' ? '#2196F3' : '#9E9E9E' }}>{c.studyState}</span></td>
                </tr>
              )) : <tr><td colSpan={8} style={{ ...td, height: 50 }}>{tr('수강 중인 과정이 없습니다.', 'No open enrollment.')}</td></tr>}</tbody>
            </table>
          </div>

          <h3 style={h3}>{tr('학습 패턴 분석', 'Learning pattern')}</h3>
          <div style={{ border: '1px solid var(--c-line, #ddd)', borderRadius: 6, padding: 12 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{tr(`최근 30일 학습 시간 추이 (사용자: ${d.user.id})`, `Last 30 days (user ${d.user.id})`)}</h4>
            {d.pattern.length ? (
              <div role="img" aria-label={tr('최근 30일 학습시간(분)', 'Minutes per day, last 30 days')} style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, overflowX: 'auto' }}>
                {d.pattern.map((p) => (
                  <div key={p.date} title={`${p.date} · ${p.minutes}${tr('분', ' min')}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 28, flex: '0 0 auto' }}>
                    <span style={{ fontSize: 10 }}>{p.minutes}</span>
                    <div style={{ width: 16, height: Math.max(2, Math.round((p.minutes / maxMin) * 120)), background: '#2196F3', borderRadius: '3px 3px 0 0' }} />
                    <span className="muted" style={{ fontSize: 10 }}>{p.label}</span>
                  </div>
                ))}
              </div>
            ) : <p className="muted" style={{ textAlign: 'center', padding: 24 }}>{tr(`최근 30일간 학습 기록이 없습니다. (사용자 ID: ${d.user.id})`, `No study in the last 30 days (user ${d.user.id}).`)}</p>}
            <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>{tr('학습시간 (분) = 그날 갱신된 Progress.StudyTime 합 ÷ 60', 'Minutes = SUM(Progress.StudyTime) of rows updated that day ÷ 60')}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
