import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import styles from './Assessment.module.css';
import { assessmentApi, type PreForm, type Question } from '../../shared/api/endpoints/assessment';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Breadcrumb, type Crumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Stepper } from '../../shared/ui/Stepper';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { FormMessage } from '../../shared/ui/Form';
import { assessment as copy, nav } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';
import { qk } from '../my/queries';
import { invalidateAfterSave, scopeFromSearch, usePreForm } from './queries';
import { QuestionTable } from './QuestionTable';
import { clearDraft, readDraft, writeDraft } from './draft';
import { answersFor, isLikert, mergeAnswers, profileMissing, togglePick, type AnswerMap } from './validation';

type Step = 'intro' | 'step01' | 'step02' | 'step03' | 'done';
const STEP_INDEX: Record<Step, number> = { intro: 0, step01: 0, step02: 1, step03: 2, done: 3 };

/** First unanswered question of a list → PHP message "{Qn. text} 문항을 선택해주세요." */
export function firstMissing(questions: Question[], answers: AnswerMap): Question | null {
  return questions.find((q) => !isLikert(answers[q.idx])) ?? null;
}

/** Shared gate / error states of the 사전·사후 forms (prev_test01.html:13-24, post_test01.html:13-62). */
export function FormGate({ error, onRetry, crumbs }: { error: unknown; onRetry: () => void; crumbs: Crumb[] }) {
  const wrap = (node: ReactNode) => <div className={styles.page}><Breadcrumb items={crumbs} />{node}</div>;
  if (isAppError(error) && error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  if (isAppError(error) && error.code === 'NO_ACCESS') return wrap(<StateBlock code="ENDED" title={copy.endedTitle} body={copy.endedBody} />);
  if (isAppError(error) && error.code === 'PRE_ASSESSMENT_REQUIRED') {
    return wrap(<StateBlock code="NO_ACCESS" kicker={copy.crumbPost} title={copy.post.preRequired} body={copy.pre.gateNote} actions={<Button square size="sm" to="/assessment/pre">{copy.pre.start}</Button>} />);
  }
  if (isAppError(error) && error.code === 'FORBIDDEN') {
    const studyTime = (error.details as { reason?: string } | undefined)?.reason === 'STUDY_TIME';
    return studyTime
      ? wrap(<StateBlock code="NO_ACCESS" symbol="clock" kicker={copy.crumbPost} title={copy.post.studyTimeTitle} body={<span style={{ whiteSpace: 'pre-line' }}>{error.message.replace(copy.post.studyTimeTitle, '').trim()}</span>} actions={<><Button square size="sm" to="/home">{copy.post.toLearn}</Button><Button variant="secondary" square size="sm" to="/my/assessment">{copy.toHub}</Button></>} />)
      : wrap(<StateBlock code="NO_ACCESS" title={copy.grantDeniedTitle} body={error.message || copy.grantDeniedBody} actions={<Button square size="sm" to="/my/assessment">{copy.toHub}</Button>} />);
  }
  return wrap(<StateBlock code="ACCESS_ERROR" title={copy.loadFailTitle} body={copy.loadFailBody} onRetry={onRetry} />);
}

/** AR-07 사전역량진단 — archive/prev/prev_test01-03.html on one screen: 공통·리더십 + 직급 → 직급별 역량 → 직무·관심분야·필요역량. */
export default function PreAssessmentPage() {
  const [params] = useSearchParams();
  const scope = scopeFromSearch(params);
  const form = usePreForm(scope.studySeq, scope.grant);
  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: copy.crumbResult, to: '/my/assessment' }, { label: copy.crumbPre }];
  if (form.isPending) return <div className={styles.page} aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={6} /></div>;
  if (form.isError && !form.data) return <FormGate error={form.error} onRetry={() => void form.refetch()} crumbs={crumbs} />;
  return <PreFlow key={form.data.studySeq} form={form.data} grantFlag={scope.grant} crumbs={crumbs} />;
}

function PreFlow({ form, grantFlag, crumbs }: { form: PreForm; grantFlag: boolean; crumbs: Crumb[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = useSession();
  const seq = form.studySeq;
  const grant = form.isGrant || grantFlag;
  const draft = useRef(readDraft('pre', seq)).current;
  const [status, setStatus] = useState(form.status);
  const [step, setStep] = useState<Step>('intro');
  const [role, setRole] = useState<string>(form.saved.role || draft?.col1 || '');
  const [answers, setAnswers] = useState<AnswerMap>(() => mergeAnswers(form.saved.answers, draft?.answers));
  const [job, setJob] = useState<number | null>(form.saved.job ?? draft?.job ?? null);
  const [interests, setInterests] = useState<number[]>(form.saved.interests.length ? form.saved.interests : draft?.interests ?? []);
  const [skills, setSkills] = useState<number[]>(form.saved.skills.length ? form.saved.skills : draft?.skills ?? []);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(draft ? copy.draftRestored : null);
  const [invalidIdx, setInvalidIdx] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [grantDone, setGrantDone] = useState(false);

  const common = form.common;
  const leader = form.leader;
  const roleQs = useMemo(() => (role ? form.roleQuestions[role] ?? [] : []), [form.roleQuestions, role]);
  const roleName = role === 'M' ? '관리자' : '실무자';
  const step01Qs = useMemo(() => [...common, ...leader], [common, leader]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  const invalidate = () => {
    void invalidateAfterSave(qc);
    void qc.invalidateQueries({ queryKey: qk.current });
    void qc.invalidateQueries({ queryKey: qk.status });
  };
  const answer = (idx: number, v: number) => { setAnswers((a) => ({ ...a, [idx]: v })); if (invalidIdx === idx) setInvalidIdx(null); };
  const saveDraft = (s: Step) => setNote(writeDraft('pre', seq, { col1: role, job, interests, skills, answers, step: s, savedAt: '' }) ? copy.draftSaved : copy.saveFail);
  const focus = (idx: number) => requestAnimationFrame(() => { const el = document.getElementById(`q-${idx}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); (el?.querySelector('input') as HTMLInputElement | null)?.focus(); });
  const fail = (e: unknown) => setMsg(isAppError(e) ? e.message : copy.submitFail);

  const step01 = useMutation({ mutationFn: () => assessmentApi.preStep01({ studySeq: seq, role: role as 'W' | 'M', answers: answersFor(step01Qs, answers), grant }), onSuccess: (r) => { setStatus(r.status); setMsg(null); setTouched(false); setStep('step02'); }, onError: fail });
  const step02 = useMutation({
    mutationFn: () => assessmentApi.preStep02({ studySeq: seq, answers: answersFor(roleQs, answers), grant }),
    onSuccess: (r) => {
      setStatus(r.status); setMsg(null); setTouched(false); invalidate();
      // prev_test02.html:285-289 — a granted enrollment returns to the 역량진단 tab after the required steps
      if (grant && r.status.submitted) { clearDraft('pre', seq); setGrantDone(true); setStep('done'); return; }
      setStep('step03');
    },
    onError: fail,
  });
  const step03 = useMutation({ mutationFn: () => assessmentApi.preStep03({ studySeq: seq, job: job!, interests, skills, grant }), onSuccess: (r) => { setStatus(r.status); clearDraft('pre', seq); invalidate(); setStep('done'); }, onError: fail });

  const goStep01 = () => {
    setTouched(true);
    if (!role) { setMsg(copy.roleRequired); document.getElementById('role-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!step01Qs.length) { setMsg(copy.questionsEmptyBody); return; }
    const miss = firstMissing(step01Qs, answers);
    if (miss) { setMsg(copy.missingQuestion(`Q${miss.order ?? ''}. ${miss.text ?? ''}`)); setInvalidIdx(miss.idx); focus(miss.idx); return; }
    step01.mutate();
  };
  const goStep02 = () => {
    setTouched(true);
    if (!roleQs.length) { setMsg(copy.questionsEmptyBody); return; }
    const miss = firstMissing(roleQs, answers);
    if (miss) { setMsg(copy.missingQuestion(`Q${miss.order ?? ''}. ${miss.text ?? ''}`)); setInvalidIdx(miss.idx); focus(miss.idx); return; }
    step02.mutate();
  };
  const goStep03 = () => {
    const missing = profileMissing(job, interests, skills);
    if (missing.length) { setMsg(missing[0] === 'job' ? copy.profile.jobRequired : missing[0] === 'interests' ? copy.profile.interestsRequired : copy.profile.skillsRequired); return; }
    step03.mutate();
  };
  const pick = (list: number[], set: (v: number[]) => void, idx: number) => {
    const r = togglePick(list, idx);
    if (r.overflow) { setMsg(copy.profile.max3); return; }
    setMsg(null); set(r.next);
  };

  const target: Step = status.submitted ? (status.profileComplete ? 'done' : 'step03') : status.started && status.nextStep === 'step02' ? 'step02' : 'step01';
  const busy = step01.isPending || step02.isPending || step03.isPending;
  const head = (title: string, extra?: ReactNode) => (
    <>
      <Breadcrumb items={crumbs} />
      <div className={styles.stepHead}>
        <div><span className="eyebrow">{copy.crumbPre}{grant ? ` · ${copy.post.grantBadge}` : ''}</span><h1>{title}</h1><p>{copy.pre.hello(session.user?.name ?? '')}</p>{extra}</div>
      </div>
      <Stepper steps={copy.steps} current={STEP_INDEX[step]} className={styles.stepper} />
      {note ? <p className={styles.draftNote} role="status">{note}</p> : null}
    </>
  );

  // ---------------------------------------------------------------- intro
  if (step === 'intro') {
    const label = status.submitted ? copy.statusLabel.complete : status.started ? copy.statusLabel.inProgress : copy.statusLabel.not_started;
    return (
      <div className={styles.page}>
        <Breadcrumb items={crumbs} />
        <section className={styles.intro}>
          <div className={styles.introCopy}>
            <span className="eyebrow">{copy.pre.eyebrow}</span>
            <h1 style={{ whiteSpace: 'pre-line' }}>{copy.pre.title}</h1>
            <p>{copy.pre.lead}</p>
            <p className={styles.note}>{copy.pre.gateNote}</p>
            <div className="action-row">
              {target === 'done'
                ? <Button square to="/assessment/result" iconRight={<Icon name="arrow" size={14} />}>{copy.viewResult}</Button>
                : <Button square onClick={() => setStep(target)} iconRight={<Icon name="arrow" size={14} />}>{status.started ? copy.pre.resume : copy.pre.start}</Button>}
              <Button variant="secondary" square to="/home">{copy.backToLearning}</Button>
            </div>
          </div>
          <dl className={styles.infoList}>
            <div><dt>{copy.info.target}</dt><dd>{copy.info.targetValue}</dd></div>
            <div><dt>{copy.info.steps}</dt><dd>{copy.info.stepsValue}</dd></div>
            <div><dt>{copy.info.status}</dt><dd><TypeLabel tone={status.submitted ? 'mint' : status.started ? 'navy' : 'gray'} small>{label}</TypeLabel>{!status.submitted && status.required > 0 ? <span className={styles.muted}> {copy.progressShort(status.answered, status.required)}</span> : null}</dd></div>
            <div><dt>{copy.info.use}</dt><dd>{copy.info.useValue}</dd></div>
            <div><dt>{copy.info.enrollment}</dt><dd>{form.period.start ? `${form.period.start} ~ ${form.period.end}` : `#${seq}`}</dd></div>
          </dl>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------- done
  if (step === 'done') {
    return (
      <div className={styles.page}>
        <Breadcrumb items={crumbs} />
        <Stepper steps={copy.steps} current={3} className={styles.stepper} />
        <StateBlock code="EMPTY" symbol="check" center kicker={copy.crumbPre} title={grantDone ? copy.grantDone.pre : copy.doneTitle} body={copy.doneBody}
          actions={grantDone ? <Button square size="sm" onClick={() => navigate('/my/assessment')}>{copy.toHub}</Button>
            : <><Button square size="sm" to="/roadmap">{copy.toRoadmap}</Button><Button variant="secondary" square size="sm" to="/assessment/result">{copy.viewResult}</Button><Button variant="secondary" square size="sm" to="/home">{copy.backToLearning}</Button></>} />
      </div>
    );
  }

  // ---------------------------------------------------------------- step03 (profile)
  if (step === 'step03') {
    const missing = profileMissing(job, interests, skills);
    const o = form.profileOptions;
    const choice = (q: Question, on: boolean, onPick: () => void, square: boolean) => (
      <label key={q.idx} className={cx(styles.choice, square && styles.square, on && styles.on)}>
        <input type={square ? 'checkbox' : 'radio'} name={square ? `pick-${q.idx}` : 'job'} checked={on} onChange={onPick} />
        <span className={styles.mark} aria-hidden="true" />
        <span><b>{q.text}</b>{q.detail ? <small>{q.detail}</small> : null}</span>
      </label>
    );
    return (
      <div className={styles.page}>
        {head(copy.stepTitle.step03, <p className={styles.hint}>{copy.roleFixedNote}</p>)}
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); goStep03(); }} noValidate>
          <section className={styles.roleBox} aria-label={copy.roleQuestion}>
            <h2>{copy.roleQuestion}</h2>
            <div className={styles.roleChoices}>{form.roles.map((r) => <span key={r.value} className={cx(styles.choice, styles.disabled, role === r.value && styles.on)}><span className={styles.mark} aria-hidden="true" />{r.label}</span>)}</div>
          </section>
          <section className={styles.roleBox} aria-label={copy.profile.job}><h2>{copy.profile.job}</h2><div className={styles.pickGrid}>{o.job.map((q) => choice(q, job === q.idx, () => { setJob(q.idx); setMsg(null); }, false))}</div></section>
          <section className={styles.roleBox} aria-label={copy.profile.interests}><h2>{copy.profile.interests}</h2><div className={styles.pickGrid}>{o.interests.map((q) => choice(q, interests.includes(q.idx), () => pick(interests, setInterests, q.idx), true))}</div></section>
          <section className={styles.roleBox} aria-label={copy.profile.skills}><h2>{copy.profile.skills}</h2><div className={styles.pickGrid}>{o.skills.map((q) => choice(q, skills.includes(q.idx), () => pick(skills, setSkills, q.idx), true))}</div></section>
          <p className={cx(styles.statusLine, missing.length ? styles.err : styles.ok)} aria-live="polite">{missing.length ? copy.profile.missing(missing.map((m) => copy.profile.parts[m])) : copy.profile.ready}</p>
          <FormMessage>{msg}</FormMessage>
          <div className={styles.actions}>
            <Button variant="secondary" square onClick={() => { setMsg(null); setStep('step02'); }}>{copy.prev}</Button>
            <Button variant="secondary" square onClick={() => saveDraft('step03')}>{copy.saveDraft}</Button>
            <Button square type="submit" loading={busy}>{copy.finish}</Button>
          </div>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------- step01 / step02 (5-point tables)
  const qs = step === 'step01' ? step01Qs : roleQs;
  const answered = qs.filter((q) => isLikert(answers[q.idx])).length;
  const allDone = qs.length > 0 && answered === qs.length && (step !== 'step01' || !!role);
  const statusText = step === 'step01' && !role ? copy.roleFirst : !qs.length ? copy.questionsEmptyBody : allDone ? copy.allAnswered : copy.progress(answered, qs.length);
  return (
    <div className={styles.page}>
      {head(step === 'step01' ? copy.stepTitle.step01 : copy.stepTitle.step02, step === 'step02' ? <p className={styles.hint}>{copy.roleStepNote}</p> : undefined)}
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (step === 'step01') goStep01(); else goStep02(); }} noValidate>
        {step === 'step01' ? (
          <>
            <section id="role-box" className={cx(styles.roleBox, touched && !role && styles.invalid)} aria-label={copy.roleQuestion}>
              <h2>{copy.roleQuestion}</h2>
              <div className={styles.roleChoices} role="radiogroup" aria-label={copy.roleQuestion}>
                {form.roles.map((r) => (
                  <label key={r.value} className={cx(styles.choice, role === r.value && styles.on)}>
                    <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => { setRole(r.value); setMsg(null); }} />
                    <span className={styles.mark} aria-hidden="true" />{r.label}
                  </label>
                ))}
              </div>
            </section>
            {common.length ? <QuestionTable title={copy.groupLabel.C} questions={common} answers={answers} onAnswer={answer} variant="agree" invalidIdx={invalidIdx} showMissing={touched && !!role} /> : null}
            {leader.length ? <QuestionTable title={copy.groupLabel.L} questions={leader} answers={answers} onAnswer={answer} variant="agree" invalidIdx={invalidIdx} showMissing={touched && !!role} /> : null}
            {!step01Qs.length ? <StateBlock code="EMPTY" title={copy.questionsEmptyTitle} body={copy.questionsEmptyBody} hideActions /> : null}
          </>
        ) : roleQs.length ? (
          <QuestionTable title={copy.roleStepHead(roleName)} questions={roleQs} answers={answers} onAnswer={answer} variant="agree" invalidIdx={invalidIdx} showMissing={touched} />
        ) : <StateBlock code="EMPTY" title={copy.questionsEmptyTitle} body={copy.questionsEmptyBody} hideActions />}
        <p className={cx(styles.statusLine, allDone ? styles.ok : styles.err)} aria-live="polite">{statusText}</p>
        <FormMessage>{msg}</FormMessage>
        <div className={styles.actions}>
          <Button variant="secondary" square onClick={() => { setMsg(null); setStep(step === 'step01' ? 'intro' : 'step01'); }}>{copy.prev}</Button>
          <Button variant="secondary" square onClick={() => saveDraft(step)}>{copy.saveDraft}</Button>
          <Button square type="submit" loading={busy}>{copy.next}</Button>
        </div>
      </form>
    </div>
  );
}
