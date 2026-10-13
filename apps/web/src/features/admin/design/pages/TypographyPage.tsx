import type { CSSProperties } from 'react';
import { CURATED_FONTS } from '@ainex/contracts';
import styles from '../../Admin.module.css';
import { AInput, ASelect, Card, FieldRow } from '../../../../shared/ui/admin';
import { useDesignStudio } from '../DesignStudioContext';
import { scopedVars } from '../designHelpers';
import { adm } from '../../strings';

const FONTS = CURATED_FONTS.map((f) => ({ value: f, label: f }));
const WEIGHTS = ['regular', 'semibold', 'bold', 'black'] as const;

export default function TypographyPage() {
  const { draft, update, canWrite } = useDesignStudio();
  if (!draft) return null;
  const ty = draft.typography;
  const t = adm.design.typography;
  const set = (patch: Partial<typeof ty>) => update((d) => ({ ...d, typography: { ...d.typography, ...patch } }));
  const vars = scopedVars(draft) as unknown as CSSProperties;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '420px minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
      <Card title={adm.design.nav.typography}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FieldRow label={t.fontFamily} htmlFor="ty-font"><ASelect id="ty-font" value={ty.fontFamily} onChange={(e) => set({ fontFamily: e.target.value as typeof ty.fontFamily })} options={FONTS} disabled={!canWrite} /></FieldRow>
          <FieldRow label={t.headingFont} htmlFor="ty-hfont"><ASelect id="ty-hfont" value={ty.headingFont} onChange={(e) => set({ headingFont: e.target.value as typeof ty.headingFont })} options={FONTS} disabled={!canWrite} /></FieldRow>
          <FieldRow label={t.baseFontSize} htmlFor="ty-size"><div className={styles.range}><input id="ty-size" type="range" min={14} max={18} step={1} value={ty.baseFontSize} onChange={(e) => set({ baseFontSize: Number(e.target.value) })} disabled={!canWrite} /><output>{ty.baseFontSize}px</output></div></FieldRow>
          <FieldRow label={t.headingScale} htmlFor="ty-scale" help="1.10 ~ 1.35"><div className={styles.range}><input id="ty-scale" type="range" min={1.1} max={1.35} step={0.01} value={ty.headingScale} onChange={(e) => set({ headingScale: Number(e.target.value) })} disabled={!canWrite} /><output>{ty.headingScale.toFixed(2)}</output></div></FieldRow>
          <FieldRow label={t.lineHeight} htmlFor="ty-lh" help="1.4 ~ 2.0"><div className={styles.range}><input id="ty-lh" type="range" min={1.4} max={2} step={0.05} value={ty.lineHeight} onChange={(e) => set({ lineHeight: Number(e.target.value) })} disabled={!canWrite} /><output>{ty.lineHeight.toFixed(2)}</output></div></FieldRow>
          <FieldRow label={t.letterSpacing} htmlFor="ty-ls" help="-0.05 ~ 0.05 em"><div className={styles.range}><input id="ty-ls" type="range" min={-0.05} max={0.05} step={0.005} value={ty.letterSpacing} onChange={(e) => set({ letterSpacing: Number(e.target.value) })} disabled={!canWrite} /><output>{ty.letterSpacing.toFixed(3)}</output></div></FieldRow>
          <FieldRow label={t.weights}>
            <div className={styles.weightGrid}>
              {WEIGHTS.map((w) => <label key={w} style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>{w}<AInput type="number" min={100} max={900} step={100} value={ty.weights[w]} onChange={(e) => set({ weights: { ...ty.weights, [w]: Number(e.target.value) } })} disabled={!canWrite} /></label>)}
            </div>
          </FieldRow>
        </div>
      </Card>
      <Card title={t.specimen}>
        <div className={styles.specimen} style={vars}>
          <h1>필요한 배움을, 필요한 순간에.</h1>
          <h2>AI를 배우는 교육에서, AI로 일하는 교육으로.</h2>
          <h3>직무역량 12개 분야 · 리더십역량 · 공통역량</h3>
          <p>AINEX 아카이브는 환급형과 비환급형 두 가지 운영 방식으로 같은 자유학습을 제공합니다. 학습시간은 Progress 합계로 계산하며, 15시간(54,000초)을 채우면 수료 기준을 달성합니다.</p>
          <p style={{ fontWeight: 'var(--fw-semibold)' as unknown as number }}>Semibold · 굵은 보조 문장 — The quick brown fox jumps over the lazy dog 0123456789</p>
          <p style={{ color: 'var(--c-muted)', fontSize: '.9em' }}>보조 설명 텍스트(muted). 사전역량진단 → 추천 학습로드맵 → 콘텐츠 학습 → 사후진단·보고서.</p>
          <span className="btn">콘텐츠 둘러보기</span>
        </div>
      </Card>
    </div>
  );
}
