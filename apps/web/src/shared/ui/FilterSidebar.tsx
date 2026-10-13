import { useEffect, useId, useState } from 'react';
import styles from './FilterSidebar.module.css';
import { Pill, Chip } from './Pill';
import { Button } from './Button';
import { Sheet } from './Modal';
import { Icon, type IconName } from './Icon';
import { IconTile, type IconTone } from './IconTile';
import { catalog as copy, competencies, type CompetencyKey } from '../strings/ko';
import { cx } from '../utils/format';

export interface FilterValue { competency: CompetencyKey | ''; field: string; type: string }
export interface FilterOption { value: string; label: string; count?: number }
export interface FilterSidebarProps {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  /** Sub-fields for the selected competency (e.g. 12 job fields). */
  fields: FilterOption[];
  types: FilterOption[];
  competencyOptions?: { key: CompetencyKey; label: string }[];
  className?: string;
}

const defaultCompetencies = (Object.keys(competencies) as CompetencyKey[]).map((k) => ({ key: k, label: competencies[k].label }));
/** Competency → icon + support-palette tone (same mapping as the header nav and the home discovery panel). */
const COMPETENCY_STYLE: Record<string, { icon: IconName; tone: IconTone }> = {
  common: { icon: 'briefcase', tone: 'blue' }, job: { icon: 'target', tone: 'teal' }, leadership: { icon: 'users', tone: 'violet' }, ai: { icon: 'sparkles', tone: 'indigo' },
};
const TYPE_ICON: Record<string, IconName> = { elearning: 'monitor', micro: 'bolt', short: 'shorts' };
const isEmpty = (v: FilterValue) => !v.competency && !v.field && !v.type;

/** Filter controls (competency rows → field list → type pills); used inline (desktop sidebar) and inside FilterSheet. */
export function FilterControls({ value, onChange, fields, types, competencyOptions = defaultCompetencies, className }: FilterSidebarProps) {
  // rendered twice (sidebar + mobile sheet), so group label ids must be unique per instance
  const uid = useId();
  const ids = { competency: `${uid}-competency`, field: `${uid}-field`, type: `${uid}-type` };
  return (
    <div className={cx(styles.box, className)}>
      <div className={styles.group}>
        <span className={styles.groupTitle} id={ids.competency}>{copy.competency}</span>
        <div className={styles.rows} role="group" aria-labelledby={ids.competency}>
          {competencyOptions.map((c) => {
            const on = value.competency === c.key;
            const st = COMPETENCY_STYLE[c.key] ?? { icon: 'grid' as IconName, tone: 'navy' as IconTone };
            return (
              <button key={c.key} type="button" className={styles.row} aria-pressed={on} onClick={() => onChange({ ...value, competency: on ? '' : c.key, field: '' })}>
                <IconTile icon={st.icon} tone={st.tone} size="sm" />
                <span className={styles.rowLabel}>{c.label}</span>
                <span className={styles.radio} aria-hidden="true"><Icon name="check" size={12} strokeWidth={3} /></span>
              </button>
            );
          })}
        </div>
      </div>
      {fields.length > 0 ? (
        <div className={styles.group}>
          <span className={styles.groupTitle} id={ids.field}>{copy.field}</span>
          <div className={styles.list} role="group" aria-labelledby={ids.field}>
            {fields.map((f) => (
              <button key={f.value} type="button" className={styles.item} aria-pressed={value.field === f.value} onClick={() => onChange({ ...value, field: value.field === f.value ? '' : f.value })}>
                <span className={styles.box2} aria-hidden="true"><Icon name="check" size={11} strokeWidth={3} /></span>
                <span className={styles.itemLabel}>{f.label}</span>
                {f.count !== undefined ? <span className={styles.count}>{f.count.toLocaleString('ko-KR')}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className={styles.group}>
        <span className={styles.groupTitle} id={ids.type}>{copy.type}</span>
        <div className={styles.pills} role="group" aria-labelledby={ids.type}>
          <Pill small pressed={value.type === ''} onClick={() => onChange({ ...value, type: '' })}>{copy.allTypes}</Pill>
          {types.map((t) => (
            <Pill key={t.value} small pressed={value.type === t.value} onClick={() => onChange({ ...value, type: value.type === t.value ? '' : t.value })}>
              {TYPE_ICON[t.value] ? <Icon name={TYPE_ICON[t.value]!} size={14} className={styles.pillIcon} /> : null}{t.label}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Desktop sticky sidebar (hidden on mobile): a card with a head row (필터 + 초기화). */
export function FilterSidebar(props: FilterSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label={copy.filterTitle}>
      <div className={styles.head}>
        <span className={styles.headTitle}><Icon name="sliders" size={16} />{copy.filtersHead}</span>
        {!isEmpty(props.value) ? <button type="button" className={styles.reset} onClick={() => props.onChange({ competency: '', field: '', type: '' })}>{copy.clear}</button> : null}
      </div>
      <FilterControls {...props} />
    </aside>
  );
}

/** Mobile trigger + bottom sheet with apply/reset. */
export function FilterSheet(props: FilterSidebarProps & { activeCount?: number }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterValue>(props.value);
  useEffect(() => { setDraft(props.value); }, [props.value]);
  return (
    <>
      <Button variant="secondary" size="sm" className={styles.trigger} onClick={() => setOpen(true)} icon={<Icon name="sliders" size={16} />} aria-haspopup="dialog" aria-expanded={open}>
        {copy.filterTrigger}{props.activeCount ? <span className={styles.badge}>{props.activeCount}</span> : null}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={copy.filterTitle}
        actions={<><Button variant="secondary" onClick={() => setDraft({ competency: '', field: '', type: '' })}>{copy.clear}</Button><Button onClick={() => { props.onChange(draft); setOpen(false); }}>{copy.apply}</Button></>}>
        <FilterControls {...props} value={draft} onChange={setDraft} />
      </Sheet>
    </>
  );
}

/** Selected filter chips row with a clear-all. */
export function SelectedFilters({ chips, onClear }: { chips: { key: string; label: string; onRemove: () => void }[]; onClear: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className={styles.selected} role="group" aria-label={copy.selected}>
      {chips.map((c) => <Chip key={c.key} label={c.label} onRemove={c.onRemove} />)}
      <button type="button" className={styles.clearAll} onClick={onClear}><Icon name="close" size={13} />{copy.clear}</button>
    </div>
  );
}
