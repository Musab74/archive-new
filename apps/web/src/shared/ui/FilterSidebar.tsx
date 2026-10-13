import { useEffect, useState } from 'react';
import styles from './FilterSidebar.module.css';
import { Pill, Chip } from './Pill';
import { Button } from './Button';
import { Sheet } from './Modal';
import { Icon } from './Icon';
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

/** Filter controls (competency pills → field list → type pills); used inline (desktop sidebar) and inside FilterSheet. */
export function FilterControls({ value, onChange, fields, types, competencyOptions = defaultCompetencies, className }: FilterSidebarProps) {
  return (
    <div className={cx(styles.box, className)}>
      <div className={styles.group}>
        <span className={styles.groupTitle}>{copy.competency}</span>
        <div className={styles.pills} role="group" aria-label={copy.competency}>
          {competencyOptions.map((c) => (
            <Pill key={c.key} small pressed={value.competency === c.key} onClick={() => onChange({ ...value, competency: value.competency === c.key ? '' : c.key, field: '' })}>{c.label}</Pill>
          ))}
        </div>
      </div>
      {fields.length > 0 ? (
        <div className={styles.group}>
          <span className={styles.groupTitle}>{copy.field}</span>
          <div className={styles.list} role="group" aria-label={copy.field}>
            {fields.map((f) => (
              <button key={f.value} type="button" className={styles.item} aria-pressed={value.field === f.value} onClick={() => onChange({ ...value, field: value.field === f.value ? '' : f.value })}>
                <span>{f.label}</span>
                {f.count !== undefined ? <span className={styles.count}>{f.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className={styles.group}>
        <span className={styles.groupTitle}>{copy.type}</span>
        <div className={styles.pills} role="group" aria-label={copy.type}>
          <Pill small soft pressed={value.type === ''} onClick={() => onChange({ ...value, type: '' })}>{copy.allTypes}</Pill>
          {types.map((t) => <Pill key={t.value} small soft pressed={value.type === t.value} onClick={() => onChange({ ...value, type: value.type === t.value ? '' : t.value })}>{t.label}</Pill>)}
        </div>
      </div>
    </div>
  );
}

/** Desktop sticky sidebar (hidden on mobile). */
export function FilterSidebar(props: FilterSidebarProps) {
  return <aside className={styles.sidebar} aria-label={copy.filterTitle}><FilterControls {...props} /></aside>;
}

/** Mobile trigger + bottom sheet with apply/reset. */
export function FilterSheet(props: FilterSidebarProps & { activeCount?: number }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterValue>(props.value);
  useEffect(() => { setDraft(props.value); }, [props.value]);
  return (
    <>
      <Button variant="secondary" size="sm" square className={styles.trigger} onClick={() => setOpen(true)} icon={<Icon name="filter" size={16} />} aria-haspopup="dialog" aria-expanded={open}>
        {copy.filterTrigger}{props.activeCount ? ` (${props.activeCount})` : ''}
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
    <div className={styles.selected} aria-label={copy.selected}>
      {chips.map((c) => <Chip key={c.key} label={c.label} onRemove={c.onRemove} />)}
      <Button variant="text" size="xs" onClick={onClear}>{copy.clear}</Button>
    </div>
  );
}
