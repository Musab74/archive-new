import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import styles from './Assessment.module.css';
import { assessmentApi, type PostForm, type Question } from '../../shared/api/endpoints/assessment';
import { isAppError } from '../../shared/api/client';
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
import { aqk, scopeFromSearch, scopeSearch, usePostForm } from './queries';
import { QuestionTable } from './QuestionTable';
import { FormGate, firstMissing } from './PreAssessmentPage';
import { clearDraft, readDraft, writeDraft, emptyDraft } from './draft';
import { answersFor, isLikert, mergeAnswers, type AnswerMap } from './validation';

type Page = 'common' | 'job' | 'satisfaction';
type Step = 'intro' | Page | 'done';
const STEP_INDEX: Record<Step, number> = { intro: 0, common: 0, job: 1, satisfaction: 2, done: 3 };

/** AR-10 사후역량진단 — archive/post/post_test01-03.html: 공통·리더십 → 직무 → HRDe아카이브 향상도(만족도), 별점 1–5 (비향상 → 향상). */
export default function PostAssessmentPage() {
  const [params] = useSearchParams();
  const scope = scopeFromSearch(params);
  const form = usePostForm(scope.studySeq, scope.grant);
  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: copy.crumbResult, to: '/my/assessment' }, { label: copy.crumbPost }];
  if (form.isPending) return <div className={styles.page} aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={6} /></div>;
  if (form.isError) return <FormGate error={form.error} onRetry={() => void form.refetch()} crumbs={crumbs} />;
  return <PostFlow key={form.data.studySeq} form={form.data} grantFlag={scope.grant} crumbs={crumbs} />;
}

function PostFlow({ form, grantFlag, crumbs }: { form: PostForm; grantFlag: boolean; crumbs: Crumb[] }) {
  const qc = useQueryClient();
  const seq = form.studySeq;
  const grant = form.isGrant || grantFlag;
  const draft = useRef(readDraft('post', seq)).current;
  const [answers, setAnswers] = useState<AnswerMap>(() => mergeAnswers(form.saved.answers, draft?.answers));
  const pages = useMemo<Page[]>(() => {
    const p: Page[] = ['common'];
    if (form.job.length) p.push('job'); // no 직무 questions for this 직급 → PHP showed an empty page; skip it
    if (form.satisfaction.length) p.push('satisfaction');
    return p;
  }, [form.job.length, form.satisfaction.length]);
  const [step, setStep] = useState<Step>('intro');
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(draft ? copy.draftRestored : null);
  const [invalidIdx, setInvalidIdx] = useState<number | null>(null);
  const [done, setDone] = useState<{ passOk: boolean } | null>(null);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  const questionsOf = (p: Page): Question[] => (p === 'common' ? [...form.common, ...form.leader] : p === 'job' ? form.job : form.satisfaction);
  const answer = (idx: number, v: number) => { setAnswers((a) => ({ ...a, [idx]: v })); if (invalidIdx === idx) setInvalidIdx(null); };
  const saveDraft = (s: Step) => setNote(writeDraft('post', seq, { ...emptyDraft(), answers, step: s }) ? copy.draftSaved : copy.saveFail);

  const save = useMutation({
    mutationFn: (p: Page) => assessmentApi.postAnswers({ studySeq: seq, step: p, answers: answersFor(questionsOf(p), answers), final: p === pages[pages.length - 1], grant }),
    onSuccess: (r, p) => {
      setMsg(null);
      void qc.invalidateQueries({ queryKey: aqk.all });
      void qc.invalidateQueries({ queryKey: qk.status });
      const next = pages[pages.indexOf(p) + 1];
      if (next) { setStep(next); return; }
      clearDraft('post', seq);
      setDone({ passOk: r.passOk });
      setStep('done');
    },
    onError: (e) => setMsg(isAppError(e) ? e.message : copy.submitFail),
  });

  const go = (p: Page) => {
    const qs = questionsOf(p);
    if (!qs.length) { setMsg(copy.questionsEmptyBody); return; }
    const miss = firstMissing(qs, answers);
    if (miss) {
      setMsg(copy.missingQuestion(`${miss.order ?? ''}. ${miss.text ?? ''}`)); setInvalidIdx(miss.idx);
      requestAnimationFrame(() => document.getElementById(`q-${miss.idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    save.mutate(p);
  };

  const steps = copy.postSteps;
  const current = STEP_INDEX[step];
  const badges = <div className={styles.labels}>{grant ? <TypeLabel tone="warm" small>{copy.post.grantBadge}</TypeLabel> : null}{form.isRetroClosedW ? <TypeLabel tone="mint" small>{copy.post.retroBadge}</TypeLabel> : null}{form.period.start ? <TypeLabel tone="gray" small>{form.period.start} ~ {form.period.end}</TypeLabel> : null}</div>;

  if (step === 'intro') {
    const started = Object.keys(form.saved.answers).length > 0;
    return (
      <div className={styles.page}>
        <Breadcrumb items={crumbs} />
        <section className={styles.intro}>
          <div className={styles.introCopy}>
            <span className="eyebrow">{copy.post.eyebrow}</span>
            <h1 style={{ whiteSpace: 'pre-line' }}>{copy.post.title}</h1>
            <p>{copy.post.lead}</p>
            <p className={styles.note}>{copy.post.note}</p>
            {badges}
            <div className="action-row">
              <Button square onClick={() => setStep('common')} iconRight={<Icon name="arrow" size={14} />}>{started ? copy.post.resume : copy.post.start}</Button>
              {form.post.completed ? <Button variant="secondary" square to={`/assessment/result${scopeSearch(seq)}`}>{copy.viewResult}</Button> : null}
            </div>
          </div>
          <dl className={styles.infoList}>
            <div><dt>{copy.info.target}</dt><dd>{copy.info.targetValue}</dd></div>
            <div><dt>{copy.info.steps}</dt><dd>{copy.info.postStepsValue}</dd></div>
            <div><dt>{copy.info.status}</dt><dd><TypeLabel tone={form.post.completed ? 'mint' : started ? 'navy' : 'gray'} small>{form.post.completed ? copy.statusLabel.complete : started ? copy.statusLabel.inProgress : copy.statusLabel.not_started}</TypeLabel></dd></div>
            <div><dt>{copy.info.use}</dt><dd>{copy.info.useValue}</dd></div>
          </dl>
        </section>
      </div>
    );
  }

  if (step === 'done') {
    const title = grant ? copy.grantDone.post : copy.postDoneTitle;
    return (
      <div className={styles.page}>
        <Breadcrumb items={crumbs} />
        <Stepper steps={steps} current={current} className={styles.stepper} />
        <StateBlock code="EMPTY" symbol="check" center kicker={copy.crumbPost} title={title} body={<>{copy.postDoneBody}{done?.passOk ? <><br />{copy.passOk}</> : null}</>}
          actions={grant ? <Button square size="sm" to="/my/assessment">{copy.toHub}</Button>
            : <><Button square size="sm" to={`/assessment/result${scopeSearch(seq)}`}>{copy.viewResult}</Button><Button variant="secondary" square size="sm" to="/roadmap">{copy.toRoadmap}</Button><Button variant="secondary" square size="sm" to="/my/assessment">{copy.toHub}</Button></>} />
      </div>
    );
  }

  const page = step;
  const qs = questionsOf(page);
  const answered = qs.filter((q) => isLikert(answers[q.idx])).length;
  const allDone = qs.length > 0 && answered === qs.length;
  const isLast = page === pages[pages.length - 1];
  const prevPage = pages[pages.indexOf(page) - 1];
  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.stepHead}>
        <div>
          <span className="eyebrow">{copy.crumbPost}</span>
          <h1>{copy.postStepTitle[page]}</h1>
          <p>{page === 'satisfaction' ? copy.satisfactionHead : copy.post.lead}{page === 'job' ? <b> {copy.jobStepHead(form.roleLabel)}</b> : null}</p>
        </div>
        {badges}
      </div>
      <Stepper steps={steps} current={current} className={styles.stepper} />
      {note ? <p className={styles.draftNote} role="status">{note}</p> : null}
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); go(page); }} noValidate>
        {page === 'common' ? (
          <>
            {form.common.length ? <QuestionTable title={copy.groupLabel.C} questions={form.common} answers={answers} onAnswer={answer} variant="improve" invalidIdx={invalidIdx} /> : null}
            {form.leader.length ? <QuestionTable title={copy.groupLabel.L} questions={form.leader} answers={answers} onAnswer={answer} variant="improve" invalidIdx={invalidIdx} numberOf={(q) => (q.order ?? 0) + 5} /> : null}
          </>
        ) : qs.length ? (
          <QuestionTable title={page === 'job' ? copy.jobStepHead(form.roleLabel) : copy.satisfactionHead} questions={qs} answers={answers} onAnswer={answer} variant="improve" invalidIdx={invalidIdx} />
        ) : null}
        {!qs.length ? <StateBlock code="EMPTY" title={copy.questionsEmptyTitle} body={copy.questionsEmptyBody} hideActions /> : null}
        <p className={cx(styles.statusLine, allDone ? styles.ok : styles.err)} aria-live="polite">{!qs.length ? copy.questionsEmptyBody : allDone ? copy.allAnswered : copy.progress(answered, qs.length)}</p>
        <FormMessage>{msg}</FormMessage>
        <div className={styles.actions}>
          <Button variant="secondary" square onClick={() => { setMsg(null); setStep(prevPage ?? 'intro'); }}>{copy.prev}</Button>
          <Button variant="secondary" square onClick={() => saveDraft(page)}>{copy.saveDraft}</Button>
          <Button square type="submit" loading={save.isPending} disabled={!allDone}>{isLast ? copy.finish : copy.next}</Button>
        </div>
      </form>
    </div>
  );
}
