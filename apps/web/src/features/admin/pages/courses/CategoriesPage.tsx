import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpCategories } from '../../../../shared/api/endpoints/admin-courses-parity';
import { AButton, AdminPage, AInput, Card, ConfirmDialog, DetailDrawer, FieldRow, StatusBadge } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { useFormErrors } from './courses-parity.shared';

type Cat = CpCategories['categories'][number];
type Edit = { mode: 'New'; parent: Cat | null } | { mode: 'Edit'; row: Cat; parent: Cat | null };

/** course_category.php — 과정 카테고리 (1차 카테고리 + 하부 카테고리, 5개씩 한 줄) with the course_category_reg.php popup as a drawer. */
export default function CategoriesPage() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'categories'], queryFn: ({ signal }) => cp.categories(signal) });
  const d = q.data;
  const [edit, setEdit] = useState<Edit | null>(null);
  const unused = <> <StatusBadge tone="danger">{tr('[미사용]', '[not used]')}</StatusBadge></>;
  return (
    <AdminPage title={tr('과정 카테고리', 'Course categories')} lead={tr('1차 카테고리와 하부 카테고리를 등록·수정·삭제합니다. 정렬 순서 기본값은 같은 단계의 최대값 + 1입니다.', 'Add, edit and delete main and sub categories. The default order is the current max + 1.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEdit({ mode: 'New', parent: null })}>{tr('1차 카테고리 추가', 'Add main category')}</AButton>}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {d && d.tree.length === 0 ? <p className="muted">{tr('등록된 카테고리가 없습니다.', 'No categories.')}</p> : null}
          {(d?.tree ?? []).map((t) => (
            <Card key={t.idx} title={<span><b style={{ color: 'var(--danger, #c00)' }}>{t.name}</b>{t.useYN === 'N' ? unused : null}</span>}
              aside={<span style={{ display: 'inline-flex', gap: 6 }}><AButton size="xs" disabled={!canWrite} onClick={() => setEdit({ mode: 'Edit', row: t, parent: null })}>{tr('수정', 'Edit')}</AButton><AButton size="xs" disabled={!canWrite} onClick={() => setEdit({ mode: 'New', parent: t })}>{tr('하부 카테고리 추가', 'Add sub category')}</AButton></span>}>
              {t.children.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, fontSize: 13 }}>
                  {t.children.map((c) => <div key={c.idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span>{c.order ?? ''}. {c.name}{c.useYN === 'N' ? unused : null}</span><AButton size="xs" disabled={!canWrite} onClick={() => setEdit({ mode: 'Edit', row: c, parent: t })}>{tr('수정', 'Edit')}</AButton></div>)}
                </div>
              ) : <p className="muted" style={{ textAlign: 'center', margin: 0, fontSize: 13 }}>{tr('등록된 하부 카테고리가 없습니다.', 'No sub categories.')}</p>}
            </Card>
          ))}
        </div>
      )}
      {edit && d ? <CategoryDrawer edit={edit} data={d} onClose={() => setEdit(null)} /> : null}
    </AdminPage>
  );
}

function CategoryDrawer({ edit, data, onClose }: { edit: Edit; data: CpCategories; onClose: () => void }) {
  const { canWrite } = useWriteGate();
  const { errors, setErrors, onError } = useFormErrors();
  const nextOrder = edit.parent ? data.nextOrder.byParent[String(edit.parent.idx)] ?? 1 : data.nextOrder.root;
  const [f, setF] = useState({ CategoryName: '', OrderByNum: '', UseYN: 'Y' as 'Y' | 'N' });
  useEffect(() => { setF(edit.mode === 'Edit' ? { CategoryName: edit.row.name ?? '', OrderByNum: edit.row.order != null ? String(edit.row.order) : String(nextOrder), UseYN: edit.row.useYN === 'N' ? 'N' : 'Y' } : { CategoryName: '', OrderByNum: String(nextOrder), UseYN: 'Y' }); setErrors({}); }, [edit, nextOrder, setErrors]);
  const inv = [['admin', 'categories'], ['admin', 'courses', 'meta']];
  const save = useAdminMutation({
    fn: () => (edit.mode === 'New'
      ? cp.createCategory({ ParentCategory: edit.parent?.idx ?? 0, Deep: edit.parent ? 2 : 1, CategoryName: f.CategoryName.trim(), OrderByNum: Number(f.OrderByNum), UseYN: f.UseYN })
      : cp.patchCategory(edit.row.idx, { CategoryName: f.CategoryName.trim(), OrderByNum: Number(f.OrderByNum), UseYN: f.UseYN })),
    invalidate: inv, success: tr('처리되었습니다.', 'Saved.'), onSuccess: onClose, onError,
  });
  const [del, setDel] = useState(false);
  const remove = useAdminMutation({ fn: () => cp.deleteCategory((edit as { row: Cat }).row.idx), invalidate: inv, success: tr('처리되었습니다.', 'Deleted.'), onSuccess: () => { setDel(false); onClose(); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.CategoryName.trim()) e.CategoryName = '카테고리명을 등록하세요.';
    if (!f.OrderByNum.trim()) e.OrderByNum = '정렬순서를 등록하세요.';
    else if (!/^\d+$/.test(f.OrderByNum.trim())) e.OrderByNum = '정렬순서는 숫자만 등록하세요.';
    setErrors(e);
    if (!Object.keys(e).length) save.mutate();
  };
  return (
    <DetailDrawer open onClose={onClose} title={tr(`과정 카테고리 ${edit.mode === 'New' ? '등록' : '수정'}`, edit.mode === 'New' ? 'New category' : 'Edit category')}
      footer={<>{edit.mode === 'Edit' ? <AButton variant="danger" disabled={!canWrite} onClick={() => setDel(true)}>{tr('삭 제', 'Delete')}</AButton> : null}<AButton variant="primary" disabled={!canWrite} loading={save.isPending} onClick={submit}>{edit.mode === 'New' ? tr('등록 하기', 'Register') : tr('수정 하기', 'Save')}</AButton><AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldRow label={tr('상위 카테고리', 'Parent')}><div style={{ paddingTop: 6 }}>{edit.parent?.name ?? tr('없음', 'None')}</div></FieldRow>
        <FieldRow label={tr('카테고리명', 'Name')} htmlFor="cat-name" required error={errors.CategoryName}><AInput id="cat-name" value={f.CategoryName} onChange={(e) => setF({ ...f, CategoryName: e.target.value })} maxLength={250} invalid={!!errors.CategoryName} /></FieldRow>
        <FieldRow label={tr('정렬 순서', 'Order')} htmlFor="cat-order" required error={errors.OrderByNum}><AInput id="cat-order" value={f.OrderByNum} onChange={(e) => setF({ ...f, OrderByNum: e.target.value })} style={{ width: 90 }} invalid={!!errors.OrderByNum} /></FieldRow>
        <FieldRow label={tr('사용 여부', 'In use')}>
          <div style={{ display: 'flex', gap: 12, paddingTop: 6 }}>
            <label><input type="radio" name="cat-use" checked={f.UseYN === 'Y'} onChange={() => setF({ ...f, UseYN: 'Y' })} /> {tr('사용', 'Yes')}</label>
            <label><input type="radio" name="cat-use" checked={f.UseYN === 'N'} onChange={() => setF({ ...f, UseYN: 'N' })} /> {tr('미사용', 'No')}</label>
          </div>
        </FieldRow>
      </div>
      <ConfirmDialog open={del} tone="danger" title={tr('카테고리 삭제', 'Delete category')} body={<p>{tr('삭제 하시겠습니까? (Del=Y로 표시됩니다)', 'Delete? (marked Del=Y)')}</p>} loading={remove.isPending} onCancel={() => setDel(false)} onConfirm={() => remove.mutate()} />
    </DetailDrawer>
  );
}

