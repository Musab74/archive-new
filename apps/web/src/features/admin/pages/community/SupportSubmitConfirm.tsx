import { useState } from 'react';
import { ConfirmDialog } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';

/** SubmitOk() of the hrd_manager write/read pages: `confirm("등록하시겠습니까?")` before the form is posted. */
export const SUBMIT_CONFIRM_TEXT = '등록하시겠습니까?';

/**
 * Confirm step in front of a save: `ask()` after validation opens the dialog, 확인 runs `onConfirm` (the mutation), and the dialog
 * shows the waiting state while `loading` (PHP: the button row is replaced by "처리중입니다...").
 */
export function useSubmitConfirm() {
  const [open, setOpen] = useState(false);
  return { open, ask: () => setOpen(true), close: () => setOpen(false) };
}

export function SupportSubmitConfirm({ open, loading, onConfirm, onCancel, body }: { open: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void; body?: string }) {
  const text = body ?? tr(SUBMIT_CONFIRM_TEXT, 'Save now?');
  return (
    <ConfirmDialog open={open} tone="info" title={tr('확인', 'Confirm')} body={<p style={{ margin: 0 }}>{loading ? tr('처리중입니다...', 'Processing...') : text}</p>}
      confirmLabel={tr('확인', 'OK')} cancelLabel={tr('취소', 'Cancel')} loading={loading} onCancel={onCancel} onConfirm={() => onConfirm()} />
  );
}
