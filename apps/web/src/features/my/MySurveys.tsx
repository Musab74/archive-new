import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../assessment/Assessment.module.css';
import { assessmentApi, type PostForm, type SatisfactionItem } from '../../shared/api/endpoints/assessment';
import { isAppError } from '../../shared/api/client';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { FormMessage } from '../../shared/ui/Form';
import { assessment as assessmentCopy, my as copy, nav } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';
import { aqk, scopeSearch, usePostForm, useSatisfactionList } from '../assessment/queries';
import { QuestionTable } from '../assessment/QuestionTable';
import { FormGate } from '../assessment/PreAssessmentPage';
import { answersFor, isLikert, mergeAnswers, type AnswerMap } from '../assessment/validation';

const c = copy.surveys;

function stateOf(i: SatisfactionItem) {
  if (i.submitted) return <TypeLabel tone="mint" small>{c.state.submitted}</TypeLabel>;
  if (i.answered > 0) return <TypeLabel tone="navy" small>{c.state.progress(i.answered, i.questionCount)}</TypeLabel>;
  return <TypeLabel tone="gray" small>{c.state.none}</TypeLabel>;
}

/** AR-17 만족도조사: the 서비스 만족도조사 (사후 3단계 · ArchiveQuestion A/step01/A) per enrollment, and the 과정 만족도조사 that the schema cannot hold yet. */
export default function MySurveys() {
  const list = useSatisfactionList();
  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: c.title }];
  if (list.isError && isAppError(list.error) && list.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const items = list.data?.items ?? [];
  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.stepHead}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>

      <section className={styles.resultCard} aria-labelledby="sv-service">
        <h2 id="sv-service">{c.serviceTitle}</h2>
        <p className={styles.note}>{c.serviceLead}</p>
        {list.isPending ? <Skeleton lines={3} /> : list.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void list.refetch()} /> : !items.length ? (
          <StateBlock code="EMPTY" symbol="file" title={c.emptyTitle} body={c.emptyBody} actions={<Button variant="secondary" square size="sm" to="/my">{copy.nav.home}</Button>} />
        ) : (
          <table className={styles.detailTable}>
            <thead><tr><th scope="col">{c.cols.name}</th><th scope="col">{c.cols.enrollment}</th><th scope="col">{c.cols.status}</th><th scope="col"><span className="sr-only">{c.join}</span></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.studySeq}>
                  <td><strong>{c.serviceName}</strong>{i.grant ? <small> · {assessmentCopy.post.grantBadge}</small> : null}</td>
                  <td>{assessmentCopy.periodLabel(i.label)}</td>
                  <td>{stateOf(i)}{i.submittedAt ? <small style={{ display: 'block' }}>{c.submittedAt(i.submittedAt)}</small> : null}{!i.open && i.blockedReason ? <small style={{ display: 'block' }}>{c.blocked[i.blockedReason] ?? ''}</small> : null}</td>
                  <td>{i.open ? <Button size="sm" square variant={i.submitted ? 'secondary' : 'primary'} to={`/satisfaction/${i.studySeq}${i.grant ? '?grant=1' : ''}`}>{i.submitted ? c.edit : c.join}</Button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={cx(styles.resultCard)} aria-labelledby="sv-course">
        <h2 id="sv-course">{c.courseTitle}</h2>
        <StateBlock code="EMPTY" symbol="info" title={c.courseBlockedTitle} body={c.courseBlockedBody} actions={<Button variant="secondary" square size="sm" to="/my/reviews">{c.toReviews}</Button>} />
      </section>
      <p className={styles.note}>{c.note}</p>
    </div>
  );
}

/** `/satisfaction/:id` (id = Study.Seq): the 아카이브 향상도·만족도 questions alone (post_test03.html), saved with POST /assessment/post/answers step=satisfaction. */
export function SatisfactionPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const seq = Number(id);
  const form = usePostForm(Number.isInteger(seq) && seq > 0 ? seq : null, params.get('grant') === '1');
  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: c.title, to: '/my/surveys' }, { label: c.detailTitle }];
  if (form.isPending) return <div className={styles.page} aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={5} /></div>;
  if (form.isError) return <FormGate error={form.error} onRetry={() => void form.refetch()} crumbs={crumbs} />;
  return <SatisfactionForm key={form.data.studySeq} form={form.data} grant={form.data.isGrant || params.get('grant') === '1'} crumbs={crumbs} />;
}

function SatisfactionForm({ form, grant, crumbs }: { form: PostForm; grant: boolean; crumbs: { label: string; to?: string }[] }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<AnswerMap>(() => mergeAnswers(form.saved.answers, null));
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState(form.satisfactionStatus);
  const [justSent, setJustSent] = useState(false);
  const qs = form.satisfaction;
  const answered = qs.filter((q) => isLikert(answers[q.idx])).length;
  const allDone = qs.length > 0 && answered === qs.length;
  const save = useMutation({
    mutationFn: () => assessmentApi.postAnswers({ studySeq: form.studySeq, step: 'satisfaction', answers: answersFor(qs, answers), final: true, grant }),
    onSuccess: (r) => { setStatus(r.satisfactionStatus); setJustSent(true); setMsg(null); void qc.invalidateQueries({ queryKey: aqk.satisfaction }); void qc.invalidateQueries({ queryKey: aqk.all }); },
    onError: (e) => setMsg(isAppError(e) ? e.message : assessmentCopy.submitFail),
  });
  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.stepHead}>
        <div><span className="eyebrow">{c.serviceTitle}</span><h1>{c.serviceName}</h1><p>{c.detailLead}</p></div>
        <div className={styles.labels}>{form.period.start ? <TypeLabel tone="gray" small>{form.period.start} ~ {form.period.end}</TypeLabel> : null}{grant ? <TypeLabel tone="warm" small>{assessmentCopy.post.grantBadge}</TypeLabel> : null}</div>
      </div>
      {status.submitted ? (
        <div className={cx(styles.banner, styles.ok)} role="status"><strong>{justSent ? c.doneTitle : c.alreadyTitle}</strong>{justSent ? c.doneBody(status.submittedAt) : `${c.submittedAt(status.submittedAt)} · ${c.alreadyBody}`}</div>
      ) : null}
      {!qs.length ? <StateBlock code="EMPTY" title={assessmentCopy.questionsEmptyTitle} body={assessmentCopy.questionsEmptyBody} hideActions /> : (
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); if (allDone) save.mutate(); }} noValidate>
          <QuestionTable title={assessmentCopy.satisfactionHead} questions={qs} answers={answers} onAnswer={(i, v) => setAnswers((a) => ({ ...a, [i]: v }))} variant="improve" />
          <p className={cx(styles.statusLine, allDone ? styles.ok : styles.err)} aria-live="polite">{allDone ? assessmentCopy.allAnswered : assessmentCopy.progress(answered, qs.length)}</p>
          <FormMessage>{msg}</FormMessage>
          <div className={styles.actions}>
            <Button variant="secondary" square to="/my/surveys">{c.back}</Button>
            <Button variant="secondary" square to={`/assessment/result${scopeSearch(form.studySeq)}`}>{assessmentCopy.viewResult}</Button>
            <Button square type="submit" loading={save.isPending} disabled={!allDone}>{status.submitted ? c.update : c.submit}</Button>
          </div>
        </form>
      )}
      <p className={styles.note}>{c.note}</p>
    </div>
  );
}
