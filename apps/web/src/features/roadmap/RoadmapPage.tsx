import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import styles from './RoadmapPage.module.css';
import { catalogApi } from '../../shared/api/endpoints/catalog';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { aiApi } from '../../shared/api/endpoints/ai';
import { isAppError } from '../../shared/api/client';
import type { RecordChapter } from '../../shared/api/schemas';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Tabs } from '../../shared/ui/Tabs';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { FormField, Input, Select, FormMessage } from '../../shared/ui/Form';
import { roadmap as copy, nav, jobFields, common, assessment as assessmentCopy } from '../../shared/strings/ko';
import { useCurrentEnrollment, useEnrollments, usePreStatus } from '../my/queries';
import { formatMinutes, typeLabel, cx } from '../../shared/utils/format';
import { hm } from '../../shared/player/time';

const TABS = [{ key: 'operator', label: copy.tabs.operator }, { key: 'ai', label: copy.tabs.ai }];

/** Course progress overlay from /my/records/:studySeq/chapters — same rule as the dashboard (floor of the capped average). */
export function courseProgress(chapters: RecordChapter[], lectureCode: string): { percent: number; seconds: number; firstChapterSeq: number | null; nextChapterSeq: number | null } {
  const rows = chapters.filter((c) => c.lectureCode === lectureCode);
  if (!rows.length) return { percent: 0, seconds: 0, firstChapterSeq: null, nextChapterSeq: null };
  const sum = rows.reduce((a, c) => a + Math.min(100, c.progress), 0);
  const next = rows.find((c) => c.progress < 100) ?? null;
  return { percent: Math.min(100, Math.floor((sum / (rows.length * 100)) * 100)), seconds: rows.reduce((a, c) => a + c.studyTime, 0), firstChapterSeq: rows[0].chapterSeq, nextChapterSeq: next?.chapterSeq ?? null };
}

/** AR-09 추천 학습로드맵: operator path (package children + progress) and the AI generator (source badge ai|fallback). */
export default function RoadmapPage() {
  const [tab, setTab] = useState('operator');
  const current = useCurrentEnrollment();
  const enrollments = useEnrollments();
  const studySeq = current.data?.studySeq ?? null;
  const row = useMemo(() => enrollments.data?.items.find((e) => e.studySeq === studySeq) ?? null, [enrollments.data, studySeq]);
  const pre = usePreStatus(studySeq, studySeq !== null);
  const children = useQuery({ queryKey: ['catalog', 'package', row?.lectureCode], queryFn: ({ signal }) => catalogApi.packageChildren(row!.lectureCode, signal), enabled: !!row?.lectureCode, retry: false });
  const single = useQuery({ queryKey: ['catalog', 'course', row?.lectureCode, true], queryFn: ({ signal }) => catalogApi.course(row!.lectureCode, signal), enabled: !!row?.lectureCode && children.isError && isAppError(children.error) && children.error.status === 404 });
  const records = useQuery({ queryKey: ['my', 'records', studySeq, 'chapters'], queryFn: ({ signal }) => myRoomApi.recordChapters(studySeq!, signal), enabled: studySeq !== null });

  const items = children.data?.items ?? (single.data ? [single.data] : []);
  const chapters = records.data?.chapters ?? [];
  const progressed = items.map((c) => ({ course: c, p: courseProgress(chapters, c.lectureCode) }));
  const doneCount = progressed.filter((x) => x.p.percent >= 100).length;

  const [jobField, setJobField] = useState(jobFields[0]);
  const [goal, setGoal] = useState('');
  const [hours, setHours] = useState('3');
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const gen = useMutation({ mutationFn: () => aiApi.roadmap({ jobField, goal: goal.trim(), hoursPerWeek: Math.max(1, Number(hours) || 1) }) });
  const onGenerate = (e: FormEvent) => { e.preventDefault(); if (!goal.trim() || !jobField) { setFormMsg(copy.ai.validation); return; } setFormMsg(null); gen.mutate(); };

  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: copy.crumb }];
  const loading = current.isPending || enrollments.isPending;
  const sessionLost = [current, enrollments].some((q) => q.isError && isAppError(q.error) && q.error.isAuth);
  if (sessionLost) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;

  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <section className={styles.hero}>
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1 style={{ whiteSpace: 'pre-line' }}>{copy.title}</h1>
        <p>{copy.lead}</p>
        {pre.data && !pre.data.submitted ? <p className={styles.hint}><Icon name="info" size={14} /> {copy.ai.assessmentHint} <Link to="/assessment/pre">{assessmentCopy.crumbPre}</Link></p> : null}
      </section>
      <Tabs items={TABS} value={tab} onChange={setTab} label={copy.tabsAria} />

      {tab === 'operator' ? (
        <section className={styles.panel} aria-labelledby="op-h">
          <div className={styles.panelHead}>
            <div><h2 id="op-h">{copy.operatorTitle}</h2><p>{copy.operatorLead}</p></div>
            {items.length ? (
              <div className={styles.pathProgress} aria-label={copy.pathProgress}>
                <span>{copy.pathProgress}</span><b>{copy.done(doneCount, items.length)}</b>
                <div className={styles.pathBar} role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={doneCount}><span style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} /></div>
              </div>
            ) : null}
          </div>
          {loading || (children.isPending && children.fetchStatus !== 'idle') ? <Skeleton lines={5} /> : studySeq === null || !row ? (
            <StateBlock code="NO_ACCESS" title={copy.noEnrollmentTitle} body={copy.noEnrollmentBody} />
          ) : children.isError && !single.data && !(single.isPending && single.fetchStatus !== 'idle') ? (
            isAppError(children.error) && children.error.status === 404 && single.isError ? <StateBlock code="EMPTY" title={copy.operatorEmptyTitle} body={copy.operatorEmptyBody} /> : <StateBlock code="LIST_ERROR" title={copy.operatorErrorTitle} body={copy.operatorErrorBody} onRetry={() => void children.refetch()} />
          ) : items.length === 0 ? (
            <StateBlock code="EMPTY" title={copy.operatorEmptyTitle} body={copy.operatorEmptyBody} />
          ) : (
            <ol className={styles.path}>
              {progressed.map(({ course, p }, i) => {
                const state = p.percent >= 100 ? 'done' : p.percent > 0 ? 'learning' : 'new';
                const target = p.nextChapterSeq ?? p.firstChapterSeq;
                return (
                  <li key={course.lectureCode} className={cx(styles.step, styles[state])}>
                    <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
                    <div className={styles.stepCopy}>
                      <div className={styles.stepLabels}><TypeLabel tone="gray" small>{typeLabel(course.ctype)}</TypeLabel><span className={styles.stepState}>{state === 'done' ? copy.stateDone : state === 'learning' ? copy.stateLearning : copy.stateNew}</span></div>
                      <Link to={`/courses/${encodeURIComponent(course.lectureCode)}`} className={styles.stepTitle}>{course.title}</Link>
                      <span className={styles.stepMeta}>{formatMinutes(course.minutes)} · {p.percent}%{p.seconds ? ` · ${hm(p.seconds)}` : ''}</span>
                      <div className={styles.stepBar} aria-hidden="true"><span style={{ width: `${p.percent}%` }} /></div>
                    </div>
                    <div className={styles.stepActions}>
                      {target && studySeq ? <Button square size="sm" variant={state === 'done' ? 'secondary' : 'primary'} to={`/learn/${studySeq}/${target}?lectureCode=${encodeURIComponent(course.lectureCode)}`}>{state === 'done' ? copy.relearn : state === 'learning' ? copy.continueLearn : copy.learn}</Button> : <Button square size="sm" to={`/courses/${encodeURIComponent(course.lectureCode)}`}>{copy.detail}</Button>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <p className={styles.note}>{copy.pathProgressNote}</p>
        </section>
      ) : (
        <section className={styles.panel} aria-labelledby="ai-h">
          <div className={styles.aiGrid}>
            <form className={styles.aiForm} onSubmit={onGenerate} noValidate>
              <h2 id="ai-h">{copy.ai.title}</h2>
              <p>{copy.ai.lead}</p>
              <FormField label={copy.ai.jobField} required htmlFor="rm-field"><Select id="rm-field" value={jobField} options={jobFields.map((f) => ({ value: f, label: f }))} onChange={(e) => setJobField(e.target.value)} /></FormField>
              <FormField label={copy.ai.goal} required htmlFor="rm-goal"><Input id="rm-goal" value={goal} placeholder={copy.ai.goalPlaceholder} maxLength={200} invalid={!!formMsg && !goal.trim()} onChange={(e) => setGoal(e.target.value)} /></FormField>
              <FormField label={copy.ai.hours} required htmlFor="rm-hours"><Input id="rm-hours" type="number" min={1} max={40} value={hours} onChange={(e) => setHours(e.target.value)} /></FormField>
              <FormMessage>{formMsg}</FormMessage>
              <div className="action-row"><Button square type="submit" loading={gen.isPending} icon={<Icon name="spark" size={16} />}>{gen.data ? copy.ai.regenerate : copy.ai.submit}</Button></div>
              <p className={styles.note}>{copy.ai.note}</p>
            </form>
            <div className={styles.aiResult} aria-live="polite">
              {gen.isError ? <StateBlock code="LIST_ERROR" title={copy.ai.error} body={copy.ai.assessmentHint} onRetry={() => gen.mutate()} /> : gen.isPending ? <Skeleton lines={6} /> : gen.data ? (
                gen.data.steps.length === 0 ? <StateBlock code="EMPTY" title={copy.ai.empty} hideActions /> : (
                  <>
                    <div className={styles.resultHead}>
                      <h3>{copy.ai.resultTitle}</h3>
                      <TypeLabel tone={gen.data.source === 'ai' ? 'mint' : 'gray'} small title={copy.ai.sourceNote[gen.data.source] ?? ''}>{gen.data.source === 'ai' ? copy.ai.sourceAi : copy.ai.sourceFallback}</TypeLabel>
                    </div>
                    {gen.data.summary ? <p className={styles.summary}>{gen.data.summary}</p> : null}
                    <ol className={styles.aiSteps}>
                      {gen.data.steps.map((s, i) => (
                        <li key={`${s.lectureCode ?? s.title}-${i}`}>
                          <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span>
                          <div>
                            {s.lectureCode ? <Link to={`/courses/${encodeURIComponent(s.lectureCode)}`} className={styles.stepTitle}>{s.title}</Link> : <span className={styles.stepTitle}>{s.title}</span>}
                            <span className={styles.stepMeta}>{s.minutes ? formatMinutes(s.minutes) : ''}</span>
                            {s.reason ? <p className={styles.reason}><b>{copy.ai.reason}</b> {s.reason}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <p className={styles.note}>{copy.ai.sourceNote[gen.data.source]}</p>
                  </>
                )
              ) : <div className={styles.placeholder}><Icon name="spark" size={26} /><p>{copy.ai.assessmentHint}</p><Button variant="secondary" square size="sm" to="/catalog">{common.goCatalog}</Button></div>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
