import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import styles from './PlayerPage.module.css';
import { playerApi } from '../../shared/api/endpoints/player';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import { Skeleton } from '../../shared/ui/Skeleton';
import { FormField, FormMessage, Input, Select, Textarea } from '../../shared/ui/Form';
import { player as copy } from '../../shared/strings/ko';

export type BridgeLayer = { kind: 'info'; lectureCode: string; contentsIdx: number } | { kind: 'counsel'; lectureCode: string; contentsIdx: number } | null;

type BridgeWindow = Window & Record<string, unknown>;
/** Parent-window functions packaged lessons call (include/function.js:1924-2025, 2296, 2088; player2.php:1253, 2181, 3233). */
const BRIDGE_NAMES = ['PlayStudyInfo', 'PlayStudyCounsel', 'PlayInfoClose', 'StudyInfoClose', 'DataResultClose', 'PlayDenyClose', 'handleIframeLoad', 'resizeIframe'] as const;

/**
 * Installs the legacy parent functions while the learning window is open. Packages run in a same-origin frame and call
 * `parent.PlayStudyInfo(LectureCode, Contents_idx)` / `parent.PlayStudyCounsel(LectureCode, [Study_Seq,] Contents_idx)` from their
 * "?" and 질문 buttons; DataResultClose / PlayDenyClose (close the player in PHP) open the exit dialog here; the sizing hooks are no-ops.
 */
export function usePackageBridge(defaults: { lectureCode: string; contentsIdx: number } | null, onExitRequest: () => void) {
  const [layer, setLayer] = useState<BridgeLayer>(null);
  const lc = defaults?.lectureCode ?? '';
  const ci = defaults?.contentsIdx ?? 0;
  useEffect(() => {
    if (!lc) return;
    const w = window as unknown as BridgeWindow;
    const asIdx = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : ci; };
    const fns: Record<(typeof BRIDGE_NAMES)[number], (...a: unknown[]) => void> = {
      PlayStudyInfo: (code, contentsIdx) => setLayer({ kind: 'info', lectureCode: String(code || lc), contentsIdx: asIdx(contentsIdx ?? ci) }),
      // 3-arg (legacy packages / replayer): (LectureCode, Study_Seq, Contents_idx); 2-arg (archive): (LectureCode, Contents_idx)
      PlayStudyCounsel: (...a) => setLayer({ kind: 'counsel', lectureCode: String(a[0] || lc), contentsIdx: asIdx(a.length >= 3 ? (a[2] ?? a[1]) : a[1]) }),
      PlayInfoClose: () => setLayer(null),
      StudyInfoClose: () => setLayer(null),
      DataResultClose: () => onExitRequest(),
      PlayDenyClose: () => onExitRequest(),
      handleIframeLoad: () => undefined,
      resizeIframe: () => undefined,
    };
    const previous = BRIDGE_NAMES.map((n) => [n, w[n]] as const);
    BRIDGE_NAMES.forEach((n) => { w[n] = fns[n]; });
    return () => { previous.forEach(([n, v]) => { if (v === undefined) delete w[n]; else w[n] = v; }); };
  }, [lc, ci, onExitRequest]);
  return { layer, close: () => setLayer(null) };
}

/** 학습요점 (study_info.php) and 학습내용 질문하기 (study_counsel.php / study_counsel_ok.php) layers. */
export function PackageBridgeDialogs({ layer, onClose }: { layer: BridgeLayer; onClose: () => void }) {
  return (
    <>
      <StudyInfoDialog layer={layer?.kind === 'info' ? layer : null} onClose={onClose} />
      <StudyCounselDialog layer={layer?.kind === 'counsel' ? layer : null} onClose={onClose} />
    </>
  );
}

const lines = (t: string) => t.split(/\r?\n/).map((l, i) => <span key={i}>{l}<br /></span>);

function StudyInfoDialog({ layer, onClose }: { layer: { lectureCode: string; contentsIdx: number } | null; onClose: () => void }) {
  const h = copy.help2;
  const q = useQuery({ queryKey: ['player', 'study-info', layer?.lectureCode, layer?.contentsIdx], queryFn: ({ signal }) => playerApi.studyInfo(layer!.lectureCode, layer!.contentsIdx, signal), enabled: !!layer, staleTime: 5 * 60_000 });
  const d = q.data;
  const rows: [string, string][] = d ? [[h.professor, d.professor], [h.goal, d.goal], [h.content, d.content], [h.activity, d.activity]] : [];
  return (
    <Modal open={!!layer} onClose={onClose} title={d?.title ? `${h.infoTitle} · ${d.title}` : h.infoTitle} symbol="info" actions={<Button onClick={onClose}>{h.close}</Button>}>
      {q.isPending ? <Skeleton height={80} /> : q.isError ? <FormMessage>{h.infoFail}</FormMessage> : rows.some(([, v]) => v.trim()) ? (
        <dl className={styles.infoList}>
          {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v.trim() ? lines(v) : '-'}</dd></div>)}
        </dl>
      ) : <p>{h.infoEmpty}</p>}
    </Modal>
  );
}

function StudyCounselDialog({ layer, onClose }: { layer: { lectureCode: string; contentsIdx: number } | null; onClose: () => void }) {
  const h = copy.help2;
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [contents, setContents] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  useEffect(() => { if (layer) { setTitle(''); setCategory(''); setContents(''); setMsg(null); } }, [layer]);
  const send = useMutation({
    mutationFn: () => playerApi.counsel({ lectureCode: layer!.lectureCode, contentsIdx: layer!.contentsIdx, category, title, contents }),
    onSuccess: () => { setMsg({ tone: 'ok', text: h.done }); setTimeout(onClose, 800); },
    onError: () => setMsg({ tone: 'error', text: h.fail.replace(/\\n/g, ' ') }),
  });
  // include/function.js:1933-1957: 문의종류 → 제목 → 내용, then confirm
  const submit = () => {
    if (!category) { setMsg({ tone: 'error', text: h.needCategory }); return; }
    if (!title.trim()) { setMsg({ tone: 'error', text: h.needTitle }); return; }
    if (!contents.trim()) { setMsg({ tone: 'error', text: h.needBody }); return; }
    if (!window.confirm(h.confirm)) return;
    setMsg(null);
    send.mutate();
  };
  return (
    <Modal open={!!layer} onClose={onClose} title={h.counselTitle} symbol="info"
      actions={<><Button variant="secondary" onClick={onClose}>{h.close}</Button><Button onClick={submit} loading={send.isPending} disabled={send.isSuccess}>{h.submit}</Button></>}>
      <p className={styles.modalNote}>{h.counselNote}</p>
      <FormField label={h.subject} required htmlFor="pc-title"><Input id="pc-title" value={title} maxLength={250} placeholder={h.subjectPlaceholder} onChange={(e) => setTitle(e.target.value)} /></FormField>
      <FormField label={h.category} required><Select value={category} placeholder={h.categoryPlaceholder} options={h.categories} onValueChange={setCategory} aria-label={h.category} /></FormField>
      <FormField label={h.body} required htmlFor="pc-body"><Textarea id="pc-body" rows={8} value={contents} placeholder={h.bodyPlaceholder} onChange={(e) => setContents(e.target.value)} /></FormField>
      {msg ? <FormMessage tone={msg.tone}>{msg.text}</FormMessage> : null}
    </Modal>
  );
}
