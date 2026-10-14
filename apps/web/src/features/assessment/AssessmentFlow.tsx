import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './Assessment.module.css';
import { assessmentApi, type Phase } from '../../shared/api/endpoints/assessment';
import { isAppError } from '../../shared/api/client';
import type { AssessmentQuestion } from '../../shared/api/schemas';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Stepper } from '../../shared/ui/Stepper';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Modal } from '../../shared/ui/Modal';
import { FormField, Input, Select, FormMessage } from '../../shared/ui/Form';
import { TypeLabel } from '../../shared/ui/Pill';
import { assessment as copy, nav, common } from '../../shared/strings/ko';
import { qk, useCurrentEnrollment, useMyStatus } from '../my/queries';
import { clearDraft, emptyDraft, readDraft, writeDraft, type Draft } from './draft';
import { answersFor, groupQuestions, validateAnswers, validateProfile, type AnswerMap } from './validation';
import { cx } from '../../shared/utils/format';

type Step = 'intro' | 'step01' | 'step02' | 'step03' | 'done';
const ORDER: Step[] = ['step01', 'step02', 'step03', 'done'];
const stepIndex = (s: Step) => Math.max(0, ORDER.indexOf(s));

/** AR-07 (pre) / AR-10 (post): intro → step01 profile → step02 Likert C/L → step03 job-track → done. */
export function AssessmentFlow({ phase }: { phase: Phase }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const current = useCurrentEnrollment();
  const myStatus = useMyStatus();
  const studySeq = current.data?.studySeq ?? null;
  const preStatus = current.data?.preAssessment ?? null;
  const postSubmitted = myStatus.data?.postAssessment?.submitted ?? false;
  const preSubmitted = preStatus?.submitted ?? myStatus.data?.preAssessment?.submitted ?? false;
  const isPre = phase === 'pre';
  const c = isPre ? copy.pre : copy.post;

  const [step, setStep] = useState<Step>('intro');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [msg, setMsg] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [invalidIdx, setInvalidIdx] = useState<number | null>(null);
  const restored = useRef(false);

  // Restore the per-enrollment draft once; the server status decides where an unfinished pre flow resumes.
  useEffect(() => {
    if (studySeq === null || restored.current) return;
    restored.current = true;
    const d = readDraft(phase, studySeq);
    if (d) { setDraft(d); setDraftNote(copy.draftRestored); }
    if (isPre && preStatus?.col1 && !d?.col1) setDraft((x) => ({ ...x, col1: preStatus.col1 }));
  }, [studySeq, phase, isPre, preStatus]);

  const submitted = isPre ? preSubmitted : postSubmitted;
  const nextStep: Step = isPre ? (preStatus?.nextStep ?? 'step01') : 'step01';
  const resumeStep: Step = useMemo(() => {
    if (submitted) return 'done';
    if (isPre) return nextStep === 'done' ? 'done' : nextStep;
    const d = studySeq !== null ? readDraft(phase, studySeq) : null;
    return (d?.step as Step | undefined) && ORDER.includes(d!.step as Step) ? (d!.step as Step) : 'step01';
  }, [submitted, isPre, nextStep, phase, studySeq]);

  const tracks = useQuery({ queryKey: ['assessment', 'questions', phase, 'step03', ''], queryFn: ({ signal }) => assessmentApi.questions({ phase, depth: 'step03' }, signal), enabled: step !== 'intro' && step !== 'done' });
  const step02 = useQuery({ queryKey: ['assessment', 'questions', phase, 'step02', ''], queryFn: ({ signal }) => assessmentApi.questions({ phase, depth: 'step02' }, signal), enabled: step === 'step02' });
  const step03 = useQuery({ queryKey: ['assessment', 'questions', phase, 'step03', draft.col1], queryFn: ({ signal }) => assessmentApi.questions({ phase, depth: 'step03', group: draft.col1 }, signal), enabled: step === 'step03' && !!draft.col1 });

  const persist = useCallback((d: Draft, s: Step) => { if (studySeq !== null) { const ok = writeDraft(phase, studySeq, { ...d, step: s }); setDraftNote(ok ? copy.draftSaved : copy.saveFail); } }, [phase, studySeq]);
  const patch = (p: Partial<Draft>) => setDraft((d) => { const n = { ...d, ...p }; return n; });
  const setAnswer = (idx: number, value: number) => { setDraft((d) => ({ ...d, answers: { ...d.answers, [idx]: value } })); if (invalidIdx === idx) setInvalidIdx(null); };

  const invalidate = () => { void qc.invalidateQueries({ queryKey: qk.current }); void qc.invalidateQueries({ queryKey: qk.status }); void qc.invalidateQueries({ queryKey: ['assessment'] }); };

  const profile = useMutation({
    mutationFn: async (): Promise<unknown> => (isPre ? assessmentApi.preProfile({ studySeq: studySeq!, col1: draft.col1, col2: draft.col2, col3: draft.col3, col4: draft.col4 }) : assessmentApi.postProfile({ studySeq: studySeq!, col1: draft.col1, col2: draft.col2, col3: draft.col3, col4: draft.col4 })),
    onSuccess: () => { persist(draft, 'step02'); setStep('step02'); setMsg(null); window.scrollTo({ top: 0 }); },
    onError: (e) => setMsg(isAppError(e) ? e.message : copy.saveFail),
  });
  const answers = useMutation({
    mutationFn: async (qs: AssessmentQuestion[]): Promise<unknown> => (isPre ? assessmentApi.preAnswers({ studySeq: studySeq!, answers: answersFor(qs, draft.answers) }) : assessmentApi.postAnswers({ studySeq: studySeq!, answers: answersFor(qs, draft.answers) })),
    onError: (e) => setMsg(isAppError(e) ? e.message : copy.submitFail),
  });

  const scrollToInvalid = (idx: number | null) => {
    setInvalidIdx(idx);
    if (idx === null) return;
    requestAnimationFrame(() => { const el = document.getElementById(`q-${idx}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); (el?.querySelector('input') as HTMLInputElement | null)?.focus(); });
  };

  const goStep01 = () => {
    const v = validateProfile(draft.col1, copy.validation);
    if (!v.ok) { setMsg(v.message); return; }
    profile.mutate();
  };
  const goStep02 = () => {
    const qs = step02.data?.questions ?? [];
    const v = validateAnswers(qs, draft.answers, copy.validation);
    if (!v.ok) { setMsg(v.message); scrollToInvalid(v.firstUnansweredIdx); return; }
    answers.mutate(qs, { onSuccess: () => { setMsg(null); persist(draft, 'step03'); setStep('step03'); window.scrollTo({ top: 0 }); } });
  };
  const finish = () => {
    const qs = step03.data?.questions ?? [];
    if (qs.length > 0) {
      const v = validateAnswers(qs, draft.answers, copy.validation);
      if (!v.ok) { setMsg(v.message); scrollToInvalid(v.firstUnansweredIdx); setConfirm(false); return; }
      answers.mutate(qs, { onSuccess: () => { setConfirm(false); if (studySeq !== null) clearDraft(phase, studySeq); invalidate(); setStep('done'); window.scrollTo({ top: 0 }); } });
    } else {
      // No job-track questions for this track: step02 already completed the phase.
      setConfirm(false); if (studySeq !== null) clearDraft(phase, studySeq); invalidate(); setStep('done'); window.scrollTo({ top: 0 });
    }
  };

  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: copy.crumbResult.replace('결과', ''), to: '/my/assessment' }, { label: isPre ? copy.crumbPre : copy.crumbPost }];

  // ---- gate states
  if (current.isPending) return <div className={styles.page} aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={5} /></div>;
  if (current.isError) {
    const code = isAppError(current.error) && current.error.isAuth ? 'SESSION_EXPIRED' : 'ACCESS_ERROR';
    return <div className={styles.page}><StateBlock code={code} title={copy.loadFailTitle} body={copy.loadFailBody} onRetry={() => void current.refetch()} /></div>;
  }
  if (studySeq === null) return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code="NO_ACCESS" title={copy.noEnrollmentTitle} body={copy.noEnrollmentBody} actions={<><Button square size="sm" to="/catalog">{common.goCatalog}</Button><Button variant="secondary" square size="sm" to="/my/profile">{common.goMy}</Button></>} /></div>;
  if (!isPre && !preSubmitted) return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code="AUTH" kicker={copy.crumbPost} title={copy.post.preRequired} body={copy.post.note} actions={<Button square size="sm" to="/assessment/pre">{copy.crumbPre}</Button>} /></div>;

  const statusLabel = submitted ? copy.statusLabel.complete : (isPre ? preStatus?.started : (studySeq !== null && !!readDraft(phase, studySeq))) ? copy.statusLabel.inProgress : copy.statusLabel.not_started;

  // ---- intro
  if (step === 'intro') {
    const target = resumeStep;
    return (
      <div className={styles.page}>
        <Breadcrumb items={crumbs} />
        <section className={styles.intro}>
          <div className={styles.introCopy}>
            <span className="eyebrow">{c.eyebrow}</span>
            <h1 style={{ whiteSpace: 'pre-line' }}>{c.title}</h1>
            <p>{c.lead}</p>
            {!isPre ? <p className={styles.note}>{copy.post.note}</p> : null}
            <div className="action-row">
              {target === 'done' ? <Button square to="/assessment/result" iconRight={<Icon name="arrow" size={14} />}>{copy.viewResult}</Button>
                : <Button square onClick={() => { setStep(target); window.scrollTo({ top: 0 }); }} iconRight={<Icon name="arrow" size={14} />}>{target === 'step01' && !(isPre ? preStatus?.started : false) ? copy.pre.start : copy.pre.resume}</Button>}
              <Button variant="secondary" square to="/home">{copy.backToLearning}</Button>
            </div>
          </div>
          <dl className={styles.infoList}>
            <div><dt>{copy.info.target}</dt><dd>{copy.info.targetValue}</dd></div>
            <div><dt>{copy.info.steps}</dt><dd>{copy.info.stepsValue}</dd></div>
            <div><dt>{copy.info.status}</dt><dd><TypeLabel tone={submitted ? 'mint' : 'gray'} small>{statusLabel}</TypeLabel>{isPre && preStatus && !submitted && preStatus.required > 0 ? <span className={styles.muted}> {copy.progress(preStatus.answered, preStatus.required)}</span> : null}</dd></div>
            <div><dt>{copy.info.use}</dt><dd>{copy.info.useValue}</dd></div>
            <div><dt>{copy.info.enrollment}</dt><dd>#{studySeq}</dd></div>
          </dl>
        </section>
      </div>
    );
  }

  // ---- done
  if (step === 'done') {
    return (
      <div className={styles.page}>
        <Breadcrumb items={crumbs} />
        <Stepper steps={copy.steps.map((s) => ({ label: s.label }))} current={3} className={styles.stepper} />
        <StateBlock code="EMPTY" symbol="check" center kicker={isPre ? copy.crumbPre : copy.crumbPost} title={isPre ? copy.doneTitle : copy.postDoneTitle} body={isPre ? copy.doneBody : copy.postDoneBody}
          actions={<><Button square size="sm" to="/assessment/result">{copy.viewResult}</Button><Button variant="secondary" square size="sm" to="/roadmap">{copy.toRoadmap}</Button><Button variant="secondary" square size="sm" to="/home">{copy.backToLearning}</Button></>} />
      </div>
    );
  }

  // ---- steps
  const stepQ = step === 'step02' ? step02 : step === 'step03' ? step03 : null;
  const questions = stepQ?.data?.questions ?? [];
  const answeredCount = questions.filter((q) => draft.answers[q.idx] !== undefined).length;
  const busy = profile.isPending || answers.isPending;

  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.stepHead}>
        <div>
          <span className="eyebrow">{isPre ? copy.crumbPre : copy.crumbPost}</span>
          <h1>{copy.stepTitle[step]}</h1>
          <p>{copy.stepLead[step]}</p>
        </div>
        {step !== 'step01' ? <span className={styles.progressPill} aria-live="polite">{copy.progress(answeredCount, questions.length)}</span> : null}
      </div>
      <Stepper steps={copy.steps.map((s) => ({ label: s.label }))} current={stepIndex(step)} className={styles.stepper} />
      {draftNote ? <p className={styles.draftNote} role="status">{draftNote}</p> : null}

      {step === 'step01' ? (
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); goStep01(); }} noValidate>
          {tracks.isPending ? <Skeleton lines={3} /> : tracks.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void tracks.refetch()} /> : (
            <>
              <FormField label={copy.profile.col1} required htmlFor="col1" error={msg && !draft.col1 ? msg : undefined}>
                <Select id="col1" value={draft.col1} invalid={!!msg && !draft.col1} placeholder={copy.profile.col1Placeholder} options={(tracks.data.jobTracks.length ? tracks.data.jobTracks : [draft.col1].filter(Boolean)).map((t) => ({ value: t, label: t }))} onValueChange={(v) => { patch({ col1: v }); setMsg(null); }} />
              </FormField>
              <div className={styles.grid3}>
                <FormField label={copy.profile.col2} optional htmlFor="col2"><Input id="col2" value={draft.col2} maxLength={100} onChange={(e) => patch({ col2: e.target.value })} /></FormField>
                <FormField label={copy.profile.col3} optional htmlFor="col3"><Input id="col3" value={draft.col3} maxLength={100} onChange={(e) => patch({ col3: e.target.value })} /></FormField>
                <FormField label={copy.profile.col4} optional htmlFor="col4"><Input id="col4" value={draft.col4} maxLength={100} onChange={(e) => patch({ col4: e.target.value })} /></FormField>
              </div>
            </>
          )}
          <FormMessage>{msg && draft.col1 ? msg : null}</FormMessage>
          <div className={styles.actions}>
            <Button variant="secondary" square onClick={() => setStep('intro')}>{copy.prev}</Button>
            <Button variant="secondary" square onClick={() => persist(draft, 'step01')}>{copy.saveDraft}</Button>
            <Button square type="submit" loading={busy} disabled={tracks.isPending}>{copy.next}</Button>
          </div>
        </form>
      ) : (
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (step === 'step02') goStep02(); else setConfirm(true); }} noValidate>
          {stepQ?.isPending ? <Skeleton lines={6} /> : stepQ?.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void stepQ.refetch()} /> : questions.length === 0 ? (
            <StateBlock code="EMPTY" title={copy.questionsEmptyTitle} body={copy.questionsEmptyBody} hideActions />
          ) : groupQuestions(questions).map((g) => (
            <section key={g.group} className={styles.group} aria-label={copy.groupLabel[g.group] ?? g.group}>
              <h2>{copy.groupLabel[g.group] ?? (step === 'step03' ? copy.result.jobTrack(draft.col1) : g.group)}</h2>
              <table className={styles.likert}>
                <thead><tr><th scope="col">{copy.info.steps.replace('진행 단계', '문항')}</th>{copy.likert.map((l, i) => <th key={l} scope="col"><span className={styles.likertNum}>{copy.likertShort[i]}</span><span className={styles.likertLabel}>{l}</span></th>)}</tr></thead>
                <tbody>
                  {g.items.map((q, i) => (
                    <tr key={q.idx} id={`q-${q.idx}`} className={cx(invalidIdx === q.idx && styles.invalidRow)} aria-invalid={invalidIdx === q.idx || undefined}>
                      <th scope="row"><span className={styles.qNum}>{String(i + 1).padStart(2, '0')}</span><b>{q.text}</b>{q.detail ? <small>{q.detail}</small> : null}</th>
                      {copy.likertShort.map((v) => (
                        <td key={v}>
                          <label className={styles.radio}>
                            <input type="radio" name={`q-${q.idx}`} value={v} checked={draft.answers[q.idx] === Number(v)} onChange={() => setAnswer(q.idx, Number(v))} aria-label={`${q.text} · ${copy.likert[Number(v) - 1]}`} />
                            <span aria-hidden="true">{v}</span>
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
          <FormMessage>{msg}</FormMessage>
          <div className={styles.actions}>
            <Button variant="secondary" square onClick={() => { setMsg(null); setStep(step === 'step02' ? 'step01' : 'step02'); window.scrollTo({ top: 0 }); }}>{copy.prev}</Button>
            <Button variant="secondary" square onClick={() => persist(draft, step)}>{copy.saveDraft}</Button>
            <Button square type="submit" loading={busy} disabled={!!stepQ?.isPending}>{step === 'step02' ? copy.next : copy.submit}</Button>
          </div>
        </form>
      )}

      <p className={styles.foot}><Link to="/support/counsel">{copy.result.toPre.replace('사전진단 확인', '진단·이용 문의')}</Link></p>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={copy.submitConfirmTitle} symbol="check" symbolTone="ok"
        actions={<><Button variant="secondary" onClick={() => setConfirm(false)}>{copy.prev}</Button><Button onClick={finish} loading={answers.isPending}>{copy.submit}</Button></>}>
        {copy.submitConfirmBody}
      </Modal>
    </div>
  );
}

export function PreAssessmentPage() { return <AssessmentFlow phase="pre" />; }
export function PostAssessmentPage() { return <AssessmentFlow phase="post" />; }
