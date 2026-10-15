import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AButton, ConfirmDialog } from '../../../../shared/ui/admin';
import { Modal } from '../../../../shared/ui/Modal';
import { Icon } from '../../../../shared/ui/Icon';
import { tr } from '../../../../shared/i18n/adminLang';
import { staffParityApi, type StaffCategory } from './staffApi';
import { STAFF_DEPT_TEXT, treeByIdx, visibleTree, type StaffDept } from './staffParity';

/**
 * 카테고리 찾기 (dept_category_select.php): the department tree starts with its roots, a name with children ("이름 [N]") expands them,
 * 선택 asks "[이름] 선택하시겠습니까?" and hands back Dept_idx + the full path (dept_category_select_script.php → DeptCategorySelected).
 */
export function StaffDeptPicker({ dept, value, onChange, invalid }: { dept: StaffDept; value: string; onChange: (idx: string, path: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<StaffCategory | null>(null);
  const q = useQuery({ queryKey: ['admin', 'staff-categories', dept], queryFn: ({ signal }) => staffParityApi.categories(dept, signal), staleTime: 5 * 60_000 });
  const ordered = useMemo(() => treeByIdx(q.data?.items ?? []), [q.data]);
  const rows = useMemo(() => visibleTree(ordered, expanded), [ordered, expanded]);
  const selected = ordered.find((n) => String(n.idx) === value);
  const toggle = (idx: number) => setExpanded((s) => { const n = new Set(s); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  const title = tr(`${STAFF_DEPT_TEXT[dept].name} 카테고리 선택`, `Choose a ${STAFF_DEPT_TEXT[dept].nameEn} category`);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
        <span data-testid="dept-picked" style={{ fontWeight: 600, color: invalid ? 'var(--c-danger)' : undefined }}>{selected?.path ?? ''}</span>
        <AButton size="sm" icon="folders" onClick={() => setOpen(true)}>{tr('카테고리 찾기', 'Find category')}</AButton>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={title} actions={<AButton onClick={() => setOpen(false)}>{tr('닫기', 'Close')}</AButton>}>
        {q.isPending ? <p className="muted">{tr('불러오는 중…', 'Loading…')}</p> : !ordered.length ? <p className="muted" style={{ textAlign: 'center' }}>{tr(`등록된 ${STAFF_DEPT_TEXT[dept].name}가 없습니다.`, 'No categories.')}</p> : (
          <ul role="tree" aria-label={title} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '60vh', overflow: 'auto' }}>
            {rows.map((n) => (
              <li key={n.idx} role="treeitem" aria-level={n.deep} aria-expanded={n.children > 0 ? expanded.has(n.idx) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', paddingLeft: 6 + (n.deep - 1) * 20 }}>
                <Icon name="folders" size={15} style={{ color: 'var(--c-muted)' }} />
                {n.children > 0
                  ? <button type="button" className="linklike" onClick={() => toggle(n.idx)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--c-primary)', font: 'inherit' }}>{n.name} [{n.children}]</button>
                  : <span>{n.name}</span>}
                <AButton size="xs" variant="primary" onClick={() => setPending(n)}>{tr('선택', 'Select')}</AButton>
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <ConfirmDialog open={!!pending} title={title} tone="info" onCancel={() => setPending(null)} confirmLabel={tr('선택', 'Select')}
        onConfirm={() => { if (pending) { onChange(String(pending.idx), pending.path); setPending(null); setOpen(false); } }}
        body={<p>{tr(`[${pending?.name ?? ''}] 선택하시겠습니까?`, `Select [${pending?.name ?? ''}]?`)}</p>} />
    </>
  );
}
