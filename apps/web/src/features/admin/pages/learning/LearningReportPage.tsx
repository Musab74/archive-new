import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi, type Report } from '../../../../shared/api/endpoints/admin-learning';
import { AButton, AdminPage, Callout } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { isAppError } from '../../../../shared/api/client';
import { LEGACY_SITE_ROOT } from './learningShared';

type RType = 'training_progress' | 'education_results';

const CSS = `
.rp-print{display:grid;gap:16px;justify-items:center}
.rp-page{width:210mm;min-height:297mm;padding:14mm 14mm;box-sizing:border-box;background:#fff;color:#111;font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;font-size:10.5pt;border:1px solid #ddd;page-break-after:always;break-after:page}
.rp-page:last-child{page-break-after:auto;break-after:auto}
.rp-page table{width:100%;border-collapse:collapse;margin:0 0 6mm}
.rp-page th,.rp-page td{border:1px solid #444;padding:7px 6px;text-align:center;vertical-align:middle}
.rp-page th,.rp-page .rp-group{background:#dbe5f1;font-weight:600}
.rp-page td.l{text-align:left}
.rp-title{text-align:center;margin:10mm 0 8mm}.rp-title .k{display:inline-block;background:#1e3a5f;color:#fff;padding:4px 14px;border-radius:2px;font-size:11pt}.rp-title h1{font-size:28pt;margin:6mm 0 0;letter-spacing:.2em}
.rp-sec{font-size:13pt;margin:4mm 0 3mm;padding-left:8px;border-left:4px solid #1e3a5f}
.rp-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 5mm}.rp-metric{border:1px solid #ccd;border-radius:6px;padding:10px;text-align:center}.rp-metric b{display:block;font-size:16pt;margin-top:4px}.rp-metric small{color:#555}
.rp-ai{border:1px solid #c7d2fe;background:#f5f7ff;border-radius:6px;padding:10px 12px;margin:3mm 0 0;page-break-inside:avoid}.rp-ai h4{margin:0 0 4px;font-size:10.5pt;color:#3730a3}
.rp-charts{display:grid;grid-template-columns:1fr 1.6fr;gap:10px;margin:0 0 4mm}
.rp-chart{border:1px solid #e5e7eb;border-radius:6px;padding:8px}.rp-chart h3{font-size:10.5pt;margin:0 0 6px;text-align:center}
.rp-legend{display:flex;gap:12px;justify-content:center;font-size:9pt;margin-top:4px}.rp-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.rp-cover-foot{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:14mm;text-align:center}
.rp-notice{margin-top:8mm;text-align:center;font-size:10pt;border-top:1px solid #999;padding-top:4mm}
.rp-disclaimer{color:#666;font-size:9pt;margin-top:4mm}
@media print{body *{visibility:hidden}.rp-print,.rp-print *{visibility:visible}.rp-print{position:absolute;left:0;top:0;width:100%;display:block}.rp-page{border:0;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4 portrait;margin:0}}
`;

/** Vertical bar chart (one value per category; hover = native tooltip). `max` is the axis top (PHP charts use 100 or 10). */
function Bars({ title, unit, max, items }: { title: string; unit: string; max: number; items: { label: string; value: number; display?: string; color: string }[] }) {
  const W = 360; const H = 180; const L = 30; const B = 34; const T = 18; const plotW = W - L - 6; const bw = Math.min(42, plotW / Math.max(1, items.length) - 10);
  const y = (v: number) => T + (H - T - B) * (1 - Math.max(0, Math.min(max, v)) / max);
  return (
    <figure className="rp-chart" style={{ margin: 0 }}>
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title} (${unit})`}>
        <text x={2} y={10} fontSize={9} fill="#555">{unit}</text>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - 6} y1={y(max * f)} y2={y(max * f)} stroke="#d9d9d9" /><text x={L - 4} y={y(max * f) + 3} fontSize={9} textAnchor="end" fill="#555">{Math.round(max * f)}</text></g>)}
        {items.map((it, i) => { const cx = L + (plotW / items.length) * (i + 0.5); return (
          <g key={it.label}>
            <rect x={cx - bw / 2} y={y(it.value)} width={bw} height={Math.max(0, y(0) - y(it.value))} rx={3} fill={it.color}><title>{`${it.label.replace(/\n/g, ' ')}: ${it.display ?? Math.round(it.value)}`}</title></rect>
            <text x={cx} y={y(it.value) - 3} fontSize={9.5} textAnchor="middle" fill="#111">{it.display ?? Math.round(it.value)}</text>
            {it.label.split('\n').map((ln, k) => <text key={k} x={cx} y={H - B + 12 + k * 11} fontSize={9} textAnchor="middle" fill="#333">{ln}</text>)}
          </g>); })}
      </svg>
    </figure>
  );
}

/** 사전 / 사후 grouped bars with a bottom legend (two series). */
function GroupBars({ title, unit, max, groups, colors }: { title: string; unit: string; max: number; groups: { label: string; before: number; after: number }[]; colors: [string, string] }) {
  const W = 420; const H = 190; const L = 30; const B = 34; const T = 18; const plotW = W - L - 6; const bw = Math.min(26, plotW / Math.max(1, groups.length) / 2 - 6);
  const y = (v: number) => T + (H - T - B) * (1 - Math.max(0, Math.min(max, v)) / max);
  return (
    <figure className="rp-chart" style={{ margin: 0 }}>
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title} (${unit})`}>
        <text x={2} y={10} fontSize={9} fill="#555">{unit}</text>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - 6} y1={y(max * f)} y2={y(max * f)} stroke="#d9d9d9" /><text x={L - 4} y={y(max * f) + 3} fontSize={9} textAnchor="end" fill="#555">{Math.round(max * f)}</text></g>)}
        {groups.map((g, i) => { const cx = L + (plotW / groups.length) * (i + 0.5); return (
          <g key={g.label}>
            {([['사전', g.before, colors[0], -1], ['사후', g.after, colors[1], 1]] as const).map(([lab, v, c, dir]) => (
              <g key={lab}><rect x={cx + (dir < 0 ? -bw - 1 : 1)} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))} rx={3} fill={c}><title>{`${g.label} ${lab}: ${Math.round(v)}`}</title></rect>
                <text x={cx + dir * (bw / 2 + 1)} y={y(v) - 3} fontSize={9} textAnchor="middle" fill="#111">{Math.round(v)}</text></g>))}
            <text x={cx} y={H - B + 12} fontSize={9} textAnchor="middle" fill="#333">{g.label}</text>
          </g>); })}
      </svg>
      <div className="rp-legend"><span><i style={{ background: colors[0] }} />사전</span><span><i style={{ background: colors[1] }} />사후</span></div>
    </figure>
  );
}

/** Doughnut with a legend (v1 학습 진행 상태 분포) or a single gauge (참여율 / 수료율 / 재참여 의향). */
function Donut({ parts, size = 140, center }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: string }) {
  const r = size / 2 - 12; const c = 2 * Math.PI * r; const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  let acc = 0;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}%`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f3" strokeWidth={20} />
        {parts.map((p) => { const len = (p.value / total) * c; const el = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={20} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`}><title>{`${p.label}: ${p.value}%`}</title></circle>; acc += len; return el; })}
        {center ? <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#111">{center}</text> : null}
      </svg>
      {parts.length > 1 ? <div className="rp-legend">{parts.map((p) => <span key={p.label}><i style={{ background: p.color }} />{p.label} {p.value}%</span>)}</div> : null}
    </div>
  );
}

/** One "AI 분석결과" box (api/ai-feedback.php, manager-report-section). */
function AiBox({ type, params, section }: { type: RType; params: Record<string, string>; section: number }) {
  const q = useQuery({ queryKey: ['admin', 'learning', 'report-ai', type, params, section], queryFn: ({ signal }) => adminLearningApi.reportAi(type, { ...params, section }, signal), staleTime: 10 * 60_000, retry: false });
  return <div className="rp-ai"><h4>AI 분석결과</h4><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{q.isPending ? <i style={{ color: '#9ca3af' }}>AI 분석 중...</i> : q.isError ? <span style={{ color: '#9ca3af' }}>AI 분석 결과를 불러올 수 없습니다.</span> : q.data.feedback}</p></div>;
}

function ReportV1({ d, type, params }: { d: Report; type: RType; params: Record<string, string> }) {
  const S = d.summary; const v = d.v1; const isP = type === 'training_progress';
  const status = v.statusLabels.map((label, i) => ({ label, value: v.statusPercents[i] ?? 0, color: ['#3b82f6', '#f59e0b', '#9ca3af'][i]! }));
  const maxMonth = Math.max(1, ...d.monthly.map((m) => m.avgTime)); const monthMax = Math.ceil(maxMonth / 5) * 5 || 5;
  return (
    <div className="rp-print">
      <section className="rp-page">
        <table><tbody><tr><th style={{ width: '18%' }}>문서번호</th><td /><th style={{ width: '18%' }}>접수일자</th><td>{v.receiptDate}</td></tr></tbody></table>
        <table><tbody><tr><th rowSpan={2} style={{ width: '12%' }}>결재</th><th>담당</th><th /><th /><th>대표이사</th></tr><tr><td style={{ height: 44 }} /><td /><td /><td /></tr></tbody></table>
        <div className="rp-title"><span className="k">디지털 원격 훈련 아카이브</span><h1>{v.title}</h1></div>
        <table><tbody>
          <tr><th style={{ width: '22%' }}>훈련과정</th><td colSpan={3}>{d.meta.courseName}</td></tr>
          <tr><th>훈련기관</th><td colSpan={3}>{d.meta.trainingPeriod}</td></tr>
          <tr><th>훈련인원</th><td colSpan={3}>총 {S.totalTrainees}명</td></tr>
          <tr><th>훈련목표</th><td colSpan={3} className="l">1. 재직근로자의 직무역량 강화<br />2. 직무 전문성 향상 및 실무 적용도 강화</td></tr>
          <tr><th>제출기관</th><td colSpan={3}>{v.submitOrg}</td></tr>
          <tr><th rowSpan={2}>작성자</th><th>소속</th><th colSpan={2}>성명</th></tr>
          <tr><td>{v.authorDept}</td><td colSpan={2}>{v.authorName}</td></tr>
          <tr><th>제출일자</th><td colSpan={3}>{v.submitDate}</td></tr>
        </tbody></table>
        <div className="rp-cover-foot"><img src={`${LEGACY_SITE_ROOT}/common/img/report-logo.png`} alt="logo-report" style={{ height: 48 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /></div>
      </section>
      <section className="rp-page">
        <h2 className="rp-sec">학습 성과 요약</h2>
        <div className="rp-metrics"><div className="rp-metric">총 학습인원<b>{S.totalTrainees}명</b></div><div className="rp-metric">평균 진도율<b>{S.avgProgressRate}%</b></div><div className="rp-metric">평균 학습시간<b>{S.avgStudyHours}시간 {S.avgStudyMinutes}분</b></div></div>
        <div className="rp-charts">
          <div className="rp-chart"><h3>{isP ? '학습 진행 상태 분포' : '수료 상태 분포'}</h3><Donut parts={status} /></div>
          <Bars title="월별 평균 학습시간(훈련기간 기준 5개월)" unit="시간" max={monthMax} items={d.monthly.map((m) => ({ label: m.month, value: m.avgTime, display: String(m.avgTime), color: '#3b82f6' }))} />
        </div>
        <AiBox type={type} params={params} section={1} />
        <h2 className="rp-sec" style={{ marginTop: '8mm' }}>역량 변화 및 만족도 분석 리포트</h2>
        <div className="rp-metrics">
          <div className="rp-metric">만족도<b>{S.avgSatisfaction}/5</b><small>설문 응답자 {S.satisfactionRespondents}명 기준입니다.</small></div>
          <div className="rp-metric">평균 역량 점수<b>{d.competence.overallAfter}점</b><small style={{ color: d.competence.overallChange > 0 ? '#16a34a' : d.competence.overallChange < 0 ? '#dc2626' : undefined }}>{d.competence.overallChange > 0 ? `▲${Math.abs(d.competence.overallChange)}점 상승했습니다.` : d.competence.overallChange < 0 ? `▼${Math.abs(d.competence.overallChange)}점 하락했습니다.` : '변화가 없습니다.'}</small></div>
          <div className="rp-metric">참여자 수<b>{S.totalTrainees}명</b></div>
        </div>
        <GroupBars title="영역별 사전 사후 역량 비교" unit="점" max={100} colors={['#94a3b8', '#3b82f6']} groups={v.competenceRows.slice(0, 3).map((r) => ({ label: r.label, before: r.before, after: r.after }))} />
        <table style={{ marginTop: '3mm' }}><thead><tr><th>영역</th><th>사전</th><th>사후</th><th>변화율</th></tr></thead>
          <tbody>{v.competenceRows.map((r) => <tr key={r.label} style={r.label === '평균' ? { fontWeight: 600 } : undefined}><td>{r.label}</td><td>{r.before}점</td><td>{r.after}점</td><td style={{ color: r.change.startsWith('-') ? '#dc2626' : '#16a34a' }}>{r.change}</td></tr>)}</tbody></table>
        <AiBox type={type} params={params} section={2} />
      </section>
      <section className="rp-page">
        <h2 className="rp-sec">{isP ? '훈련생별 진행현황표' : '훈련생별 수료현황표'}</h2>
        <table><thead><tr><th>번호</th><th>성명</th><th>진도율</th><th>공통점수</th><th>직무점수</th><th>리더십점수</th><th>만족도</th><th>{isP ? '학습상태' : '수료여부'}</th></tr></thead>
          <tbody>{v.trainees.length ? v.trainees.map((t) => <tr key={t.id}><td>{t.no}</td><td>{t.name}</td><td>{t.progress}%</td><td>{t.commonScore}점</td><td>{t.jobScore}점</td><td>{t.leadershipScore}점</td><td>{t.satisfaction}점</td><td>{t.status}</td></tr>) : <tr><td colSpan={8}>선택한 과정·수강기간의 학습자가 없습니다.</td></tr>}</tbody></table>
        <AiBox type={type} params={params} section={3} />
        <h2 className="rp-sec" style={{ marginTop: '8mm' }}>AI 종합 분석 및 개선</h2>
        <div className="rp-metrics">
          {([['참여율', S.participationRate, '#3b82f6'], ['수료율', S.completionRatePercent, '#10b981'], ['재참여 의향', S.reParticipationRate, '#f59e0b']] as const).map(([label, val, color]) => (
            <div key={label} className="rp-metric">{label}<Donut size={120} parts={[{ label, value: val, color }, { label: '-', value: Math.max(0, 100 - val), color: '#eef0f3' }]} center={`${val}%`} /></div>))}
        </div>
        <AiBox type={type} params={params} section={4} />
        <div className="rp-disclaimer">*본 보고서는 HRDe AI 자동분석 시스템을 통해 생성되었습니다.</div>
      </section>
    </div>
  );
}

function ReportV2({ d }: { d: Report }) {
  const o = d.v2!; const S = d.summary; const isP = d.reportType === 'training_progress';
  const satColors = ['#5B9BD5', '#ED7D31', '#FFC000', '#70AD47', '#C65911', '#F4B6C2', '#9DC3E6', '#F8CBAD', '#FFE699', '#548235'];
  return (
    <div className="rp-print">
      <section className="rp-page">
        <table><colgroup><col style={{ width: '15%' }} /><col style={{ width: '24.9%' }} /><col style={{ width: '6.1%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /></colgroup>
          <tbody><tr><th>문서번호</th><td className="l">{o.documentNo}</td><th rowSpan={2}>결<br />재</th><th>담당</th><th>검토</th><th>결재</th></tr><tr><th>접수일자</th><td className="l">{o.receiptDate}</td><td style={{ height: 50 }} /><td /><td /></tr></tbody></table>
        <div className="rp-title"><span className="k">디지털 원격훈련 아카이브</span><h1>{o.copy.title}</h1></div>
        <table><colgroup><col style={{ width: '22%' }} /><col style={{ width: '39%' }} /><col style={{ width: '39%' }} /></colgroup><tbody>
          {!isP ? <tr><th>고객사</th><td colSpan={2}>{d.meta.companyName}</td></tr> : null}
          <tr><th>훈련과정</th><td colSpan={2}>{d.meta.courseName}</td></tr>
          <tr><th>훈련기간</th><td colSpan={2}>{d.meta.trainingPeriod}</td></tr>
          <tr><th>훈련인원</th><td colSpan={2}>총 {S.totalTrainees}명</td></tr>
          <tr><th>훈련목표</th><td colSpan={2} className="l">{o.goal.map((g) => <div key={g}>{g}</div>)}</td></tr>
          <tr><th rowSpan={3}>작성기관</th><td colSpan={2}>{o.authorOrg}</td></tr>
          <tr><th>소속</th><th>성명</th></tr>
          <tr><td>{o.authorDept}</td><td>{o.authorName}</td></tr>
          <tr><th>작성일자</th><td colSpan={2}>{o.reportDate}</td></tr>
          <tr><td colSpan={3}>{o.copy.submitText}</td></tr>
        </tbody></table>
        <div className="rp-cover-foot">
          {isP ? <img src={`${LEGACY_SITE_ROOT}/common/img/report-logo.png`} alt="고용노동부 인증 HRDe평생교육원" style={{ height: 48 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <div><b style={{ fontSize: 18 }}>고용노동부인증</b><br />아이넥스평생교육원</div>}
          <img src={`${LEGACY_SITE_ROOT}/images/company_stamp.png`} alt="직인" style={{ height: 70 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        </div>
        {o.notice.length ? <div className="rp-notice">{o.notice.map((n) => <div key={n}>{n}</div>)}</div> : null}
      </section>
      <section className="rp-page">
        <h2 className="rp-sec">{o.copy.section1}</h2>
        <table><thead><tr><th style={{ width: '20%' }}>구분</th><th style={{ width: '33%' }}>내용</th><th>결과</th></tr></thead><tbody>
          <tr><td className="rp-group" rowSpan={3}>학습 진도 및 성과</td><td>평균 진도율</td><td>{o.progressPct}%</td></tr>
          <tr><td>최종 수료인원(수료율)</td><td>{S.completedCount}명({o.completePct}%)</td></tr>
          <tr><td>{o.studyTimeLabel}</td><td>{o.studyTimeValue}</td></tr>
        </tbody></table>
        <Bars title="학습 진도 및 성과" unit="단위(%)" max={100} items={[{ label: '평균 진도율', value: S.avgProgressRate, color: '#5B9BD5' }, { label: '최종 수료율', value: S.completionRatePercent, color: '#FFC000' }]} />
        <table style={{ marginTop: '4mm' }}><thead><tr><th style={{ width: '18%' }}>구분</th><th style={{ width: '20%' }}>내용</th><th>결과</th></tr></thead><tbody>
          {o.competence.map((c, i) => <tr key={c.label}>{i === 0 ? <td className="rp-group" rowSpan={6}>역량 진단 요약<br />(사전 vs. 사후)</td> : null}<td>{c.label}</td><td>{c.delta}</td></tr>)}
          <tr><td>우수 향상 항목</td><td>{o.improvedItems.length ? o.improvedItems.join(', ') : '-'}</td></tr>
          <tr><td>추가 보완 항목</td><td>{o.needsWorkItems.length ? o.needsWorkItems.join(', ') : '-'}</td></tr>
        </tbody></table>
        <GroupBars title="역량 진단 요약" unit="단위(점)" max={100} colors={['#2F5597', '#ED7D31']} groups={o.competence.map((c) => ({ label: c.chartLabel, before: c.before, after: c.after }))} />
      </section>
      <section className="rp-page">
        <h2 className="rp-sec">{o.copy.section2}</h2>
        <table><thead><tr><th style={{ width: '18%' }}>구분</th><th>결과</th></tr></thead><tbody>
          <tr><th>조사 대상</th><td>조사 참여 {S.satisfactionRespondents}명 / 총 학습자 {S.totalTrainees}명</td></tr>
          <tr><th>조사방식</th><td>LMS 별점(각 문항별 10점)</td></tr>
          <tr><th>전체 만족도</th><td>{o.overallSat100 === null ? '-' : `${o.overallSat100}점 / 총 100점`}</td></tr>
          {o.satItems.map((it, i) => <tr key={it.idx}>{i === 0 ? <td className="rp-group" rowSpan={o.satItems.length}>문항별<br />만족도</td> : null}<td className="l"><span>{it.label}</span><span style={{ float: 'right' }}>{it.avg10 === null ? '- / 10   (점)' : `${it.avg10Label} / 10   (점)`}</span></td></tr>)}
        </tbody></table>
        <Bars title={o.satChartTitle} unit="단위(점)" max={10} items={o.satItems.map((it, i) => ({ label: it.chartLabel, value: it.avg10 ?? 0, display: it.avg10 === null ? '-' : it.avg10Label, color: satColors[i % satColors.length]! }))} />
      </section>
      <section className="rp-page">
        <h2 className="rp-sec">{o.copy.section3}</h2>
        <table><colgroup><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '60%' }} /></colgroup><tbody>
          {o.effects.map((e, i) => <tr key={e.label}>{i === 0 ? <th className="rp-group" rowSpan={3}>훈련 효과</th> : null}<td>{e.label}</td><td className="l">{e.text}</td></tr>)}
          <tr><th>실무 적용도</th><td colSpan={2} className="l">{o.applyText}</td></tr>
          <tr><th>부정훈련 여부</th><td colSpan={2} className="l">{o.fraudCheck}</td></tr>
          <tr><th>추후 제안</th><td colSpan={2} className="l">{o.proposal.map((p) => <div key={p}>{p}</div>)}</td></tr>
        </tbody></table>
        <h2 className="rp-sec">{o.copy.section4}</h2>
        <table style={{ fontSize: '9pt' }}><thead>
          <tr><th rowSpan={2}>연번</th><th rowSpan={2}>성명</th><th rowSpan={2}>총 학습시간</th><th colSpan={2}>공통역량</th>{o.showLeadershipColumns ? <th colSpan={2}>리더십역량</th> : null}<th colSpan={2}>직무역량</th><th rowSpan={2}>만족도</th><th rowSpan={2}>{o.copy.completeHeader}</th></tr>
          <tr><th>학습전</th><th>학습후</th>{o.showLeadershipColumns ? <><th>학습전</th><th>학습후</th></> : null}<th>학습전</th><th>학습후</th></tr>
        </thead><tbody>
          {o.trainees.length ? o.trainees.map((t) => <tr key={t.id}><td>{t.no}</td><td>{t.name}</td><td>{t.studyTimeHms}</td><td>{t.cBefore}</td><td>{t.cAfter}</td>{o.showLeadershipColumns ? <><td>{t.lBefore}</td><td>{t.lAfter}</td></> : null}<td>{t.jobBefore}</td><td>{t.jobAfter}</td><td>{t.sat100}</td><td>{t.status}</td></tr>)
            : <tr><td colSpan={o.showLeadershipColumns ? 11 : 9}>선택한 과정·수강기간의 학습자가 없습니다.</td></tr>}
        </tbody></table>
      </section>
    </div>
  );
}

/**
 * 훈련진행보고서 / 교육결과보고서 (public/mypage/training_progress_report.php, education_results_report.php = v1;
 * training_progress_report_v2.php / education_results_report_v2.php = v2 official A4 form). Printed with the browser.
 */
export function LearningReport({ params }: { params: Record<string, string> }) {
  const type: RType = params.reportType === 'education_results' ? 'education_results' : 'training_progress';
  const version = params.version === 'v2' ? 'v2' : 'v1';
  const scope: Record<string, string> = {}; for (const k of ['companyCode', 'lectureStart', 'lectureEnd', 'lectureCode', 'serviceType', 'openChapter']) if (params[k]) scope[k] = params[k]!;
  const ready = !!(scope.companyCode && scope.lectureStart && scope.lectureEnd && scope.lectureCode);
  const q = useQuery({ queryKey: ['admin', 'learning', 'report', type, version, scope, params.authorName ?? ''], queryFn: ({ signal }) => adminLearningApi.report(type, { ...scope, version, authorName: params.authorName || undefined }, signal), enabled: ready, retry: false });
  const d = q.data;
  const title = type === 'training_progress' ? tr(`훈련진행보고서${version === 'v2' ? ' (new)' : ''}`, 'Training progress report') : tr('교육결과보고서', 'Education results report');
  useEffect(() => { if (!d) return; const prev = document.title; document.title = `${d.meta.companyName}_${type === 'training_progress' ? '훈련진행보고서' : '교육결과보고서'}`; return () => { document.title = prev; }; }, [d, type]);
  return (
    <AdminPage title={title} lead={tr('보고서를 브라우저 인쇄(Ctrl+P / ⌘P)로 출력하거나 PDF로 저장하세요. 수치는 저장된 학습시간·수료 여부·역량진단 응답으로 계산합니다.', 'Print or save as PDF with the browser. Figures come from stored study time, completion flags and assessment answers.')}
      actions={<AButton variant="primary" icon="file" onClick={() => window.print()} disabled={!d}>{tr('인쇄', 'Print')}</AButton>}>
      <style>{CSS}</style>
      {!ready ? <Callout tone="warn">{tr('회사·과정·수강기간 정보가 올바르지 않습니다.', 'Company, course and term are required.')}</Callout> : null}
      {q.isError ? (isAppError(q.error) && (q.error.status === 404 || q.error.status === 400) ? <Callout tone="warn">{q.error.message}</Callout> : <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} />) : null}
      {ready && q.isPending ? <p className="muted">{adm.common.loading}</p> : null}
      {d ? (version === 'v2' && d.v2 ? <ReportV2 d={d} /> : <ReportV1 d={d} type={type} params={scope} />) : null}
    </AdminPage>
  );
}

export default function LearningReportPage() {
  const [sp] = useSearchParams();
  const params: Record<string, string> = {}; sp.forEach((v, k) => { if (v) params[k] = v; });
  return <LearningReport params={params} />;
}
