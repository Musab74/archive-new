import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DesignValidationIssue } from '@ainex/contracts';
import { designApi } from '../../../shared/api/endpoints/design';
import { isAppError } from '../../../shared/api/client';
import { useToast } from '../../../app/providers/ToastProvider';
import { Modal } from '../../../shared/ui/Modal';
import { AButton, AInput, Callout, StatusBadge } from '../../../shared/ui/admin';
import { useDesignStudio } from './DesignStudioContext';
import { adm } from '../strings';
import { tr } from '../../../shared/i18n/adminLang';

export function IssueList({ issues }: { issues: DesignValidationIssue[] }) {
  if (!issues.length) return <Callout tone="ok">{adm.design.tokens.noIssues}</Callout>;
  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      {issues.map((i, k) => <li key={`${i.path}${k}`}><StatusBadge tone={i.level === 'error' ? 'danger' : 'warn'}>{i.level === 'error' ? tr('오류', 'Error') : tr('경고', 'Warning')}</StatusBadge> <span className="mono">{i.path}</span> — {i.message}</li>)}
    </ul>
  );
}

/** 게시: validation summary (draft issues) → description → POST /design/publish → toast with the version number. */
export function PublishDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { server, dirty, issues, refetchLive } = useDesignStudio();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverIssues, setServerIssues] = useState<DesignValidationIssue[] | null>(null);
  const all = serverIssues ?? (server ? [...server.issues.filter((s) => !issues.some((i) => i.path === s.path)), ...issues] : issues);
  const errors = all.filter((i) => i.level === 'error');
  const p = adm.design.publish;

  const publish = async () => {
    setBusy(true);
    setServerIssues(null);
    try {
      const res = await designApi.publish(description.trim() || undefined);
      toast(p.done(res.versionNumber), { tone: 'ok', duration: 6000 });
      void qc.invalidateQueries({ queryKey: ['design'] });
      refetchLive();
      setDescription('');
      onClose();
    } catch (err) {
      if (isAppError(err) && err.status === 400 && err.details && typeof err.details === 'object' && Array.isArray((err.details as { issues?: unknown }).issues)) {
        setServerIssues((err.details as { issues: DesignValidationIssue[] }).issues);
        toast(err.message, { tone: 'danger', duration: 8000 });
      } else if (isAppError(err) && err.code === 'LOCK_BUSY') toast(err.message, { tone: 'warn' });
      else toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={p.title} symbol="flag" size="lg"
      actions={<><AButton onClick={onClose} disabled={busy}>{adm.common.cancel}</AButton><AButton variant="primary" onClick={() => void publish()} loading={busy} disabled={errors.length > 0 || dirty}>{adm.design.actions.publish}</AButton></>}>
      <p style={{ margin: '0 0 12px' }}>{p.body}</p>
      {dirty ? <Callout tone="warn" className="u-mb-8">{p.unsaved}</Callout> : null}
      <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{adm.design.overview.issues} · {errors.length ? <StatusBadge tone="danger">{adm.design.overview.errors(errors.length)}</StatusBadge> : <StatusBadge tone="ok">{adm.design.overview.noIssues}</StatusBadge>} {all.length - errors.length ? <StatusBadge tone="warn">{adm.design.overview.warnings(all.length - errors.length)}</StatusBadge> : null}</h3>
      <IssueList issues={all} />
      {errors.length ? <Callout tone="warn" className="u-mt-8">{p.blocked}</Callout> : all.length ? <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{p.warnings}</p> : null}
      <div className="u-mt-16"><label htmlFor="pub-desc" style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>{p.description}</label><AInput id="pub-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder={tr('예) 2026 봄 테마 적용', 'e.g. Applied the spring 2026 theme')} /></div>
    </Modal>
  );
}
