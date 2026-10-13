import { CARD_VARIANTS, FOOTER_VARIANTS, HEADER_VARIANTS, HERO_VARIANTS } from '@ainex/contracts';
import styles from '../../Admin.module.css';
import { AButton, ACheckbox, AInput, Card, FieldRow } from '../../../../shared/ui/admin';
import { cx } from '../../../../shared/utils/format';
import { useDesignStudio } from '../DesignStudioContext';
import { HOME_SECTION_LABELS, moveSection, normalizeHomeSections, toggleSection } from '../designHelpers';
import { adm } from '../../strings';

const LABELS: Record<string, string> = { standard: '기본', compact: '컴팩트', centered: '가운데 정렬', split: '좌우 분할', 'visual-right': '이미지 우측', columns: '다단', elevated: '그림자', outlined: '외곽선' };

/** Simple CSS thumbnails per variant. */
function Thumb({ kind, variant }: { kind: 'header' | 'hero' | 'footer' | 'card'; variant: string }) {
  if (kind === 'header') return <div className={styles.thumb}><u style={{ left: 0, right: 0, top: 0, height: variant === 'compact' ? 8 : 14, background: '#fff', borderBottom: '1px solid #c9d3e0' }} /><i style={{ left: variant === 'centered' ? '42%' : 6, top: variant === 'compact' ? 2 : 4, width: 20, height: variant === 'compact' ? 4 : 6 }} /><u style={{ left: variant === 'centered' ? '30%' : 34, top: variant === 'compact' ? 3 : 6, width: 40, height: 3 }} /></div>;
  if (kind === 'hero') return <div className={styles.thumb}>{variant === 'split' ? <><i style={{ left: 8, top: 14, width: 50, height: 7 }} /><u style={{ left: 8, top: 26, width: 40, height: 3 }} /><u style={{ left: 8, top: 34, width: 24, height: 6, background: '#4873b8' }} /><u style={{ right: 8, top: 10, width: 50, height: 42, background: '#dbe4f0' }} /></> : variant === 'centered' ? <><i style={{ left: '25%', top: 14, width: '50%', height: 7 }} /><u style={{ left: '35%', top: 26, width: '30%', height: 3 }} /><u style={{ left: '42%', top: 36, width: '16%', height: 6, background: '#4873b8' }} /></> : <><i style={{ left: 8, top: 10, width: 44, height: 7 }} /><u style={{ left: 8, top: 22, width: 36, height: 3 }} /><u style={{ right: 0, top: 0, bottom: 0, width: '45%', background: '#dbe4f0' }} /></>}</div>;
  if (kind === 'footer') return <div className={styles.thumb}>{variant === 'columns' ? <>{[0, 1, 2, 3].map((i) => <u key={i} style={{ left: 8 + i * 34, top: 12, width: 24, height: 3 }} />)}{[0, 1, 2, 3].map((i) => <u key={`b${i}`} style={{ left: 8 + i * 34, top: 20, width: 18, height: 3 }} />)}<u style={{ left: 8, right: 8, bottom: 8, height: 3 }} /></> : <><u style={{ left: 8, top: 24, width: 60, height: 3 }} /><u style={{ left: 8, top: 32, width: 90, height: 3 }} /></>}</div>;
  return <div className={styles.thumb}>{[0, 1].map((i) => <u key={i} style={{ left: 8 + i * 66, top: 8, width: 58, height: 48, background: '#fff', border: variant === 'outlined' ? '1px solid #8a97ab' : '1px solid #e4e7ec', boxShadow: variant === 'elevated' ? '0 4px 10px rgba(21,63,115,.15)' : 'none' }} />)}</div>;
}

function VariantPicker({ kind, label, options, value, onChange, disabled }: { kind: 'header' | 'hero' | 'footer' | 'card'; label: string; options: readonly string[]; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <FieldRow label={label}>
      <div className={styles.variantGrid} role="group" aria-label={label}>
        {options.map((o) => <button key={o} type="button" className={styles.variant} aria-pressed={o === value} onClick={() => onChange(o)} disabled={disabled}><Thumb kind={kind} variant={o} /><span><b>{LABELS[o] ?? o}</b> <span className="muted">({o})</span></span></button>)}
      </div>
    </FieldRow>
  );
}

export default function LayoutPage() {
  const { draft, update, canWrite } = useDesignStudio();
  if (!draft) return null;
  const l = draft.layout;
  const t = adm.design.layout;
  const set = (patch: Partial<typeof l>) => update((d) => ({ ...d, layout: { ...d.layout, ...patch } }));
  const sections = normalizeHomeSections(l.homeSections, { missingVisible: false });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title="구성 변형">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <VariantPicker kind="header" label={t.header} options={HEADER_VARIANTS} value={l.headerVariant} onChange={(v) => set({ headerVariant: v as typeof l.headerVariant })} disabled={!canWrite} />
          <VariantPicker kind="hero" label={t.hero} options={HERO_VARIANTS} value={l.heroVariant} onChange={(v) => set({ heroVariant: v as typeof l.heroVariant })} disabled={!canWrite} />
          <VariantPicker kind="footer" label={t.footer} options={FOOTER_VARIANTS} value={l.footerVariant} onChange={(v) => set({ footerVariant: v as typeof l.footerVariant })} disabled={!canWrite} />
          <VariantPicker kind="card" label={t.card} options={CARD_VARIANTS} value={l.cardVariant} onChange={(v) => set({ cardVariant: v as typeof l.cardVariant })} disabled={!canWrite} />
          <FieldRow label={t.radius} help="sm / md / lg (px)"><div style={{ display: 'flex', gap: 8 }}>{(['sm', 'md', 'lg'] as const).map((k) => <label key={k} style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3, width: 90 }}>{k}<AInput type="number" min={0} max={40} value={l.radius[k]} onChange={(e) => set({ radius: { ...l.radius, [k]: Number(e.target.value) } })} disabled={!canWrite} /></label>)}</div></FieldRow>
          <FieldRow label={t.container} htmlFor="ly-container" help="960 ~ 1440 px"><div className={styles.range}><input id="ly-container" type="range" min={960} max={1440} step={20} value={l.container} onChange={(e) => set({ container: Number(e.target.value) })} disabled={!canWrite} /><output>{l.container}px</output></div></FieldRow>
        </div>
      </Card>
      <Card title={t.sections}>
        <div className={styles.sectionList}>
          {sections.map((s, i) => (
            <div key={s.key} className={cx(styles.sectionRow, !s.visible && styles.hidden)}>
              <ACheckbox label={<span className="sr-only">{t.show}</span>} checked={s.visible} onChange={(e) => set({ homeSections: toggleSection(sections, s.key, e.target.checked) })} disabled={!canWrite} aria-label={`${HOME_SECTION_LABELS[s.key]} ${t.show}`} />
              <span style={{ fontSize: 13 }}><b>{i + 1}. {HOME_SECTION_LABELS[s.key]}</b> <span className="muted mono" style={{ fontSize: 11 }}>{s.key}</span></span>
              <span style={{ display: 'inline-flex', gap: 4 }}><AButton size="xs" aria-label={`${HOME_SECTION_LABELS[s.key]} ${t.up}`} disabled={!canWrite || i === 0} onClick={() => set({ homeSections: moveSection(sections, i, -1) })}>▲</AButton><AButton size="xs" aria-label={`${HOME_SECTION_LABELS[s.key]} ${t.down}`} disabled={!canWrite || i === sections.length - 1} onClick={() => set({ homeSections: moveSection(sections, i, 1) })}>▼</AButton></span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
