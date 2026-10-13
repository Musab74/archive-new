import { useMemo, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { isAppError, newIdempotencyKey } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input, Select, Textarea } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';

/** 1:1 문의 (learner) → POST /support/counsel (CounselCreateSchema). Requires login. */
export default function CounselPage() {
  const c = copy.counsel;
  const { isAuthed, phase } = useSession();
  const [form, setForm] = useState({ category: '1', title: '', contents: '', lectureCode: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const idem = useMemo(() => newIdempotencyKey(), []);
  const submit = useMutation({ mutationFn: () => supportApi.createCounsel({ category: form.category, title: form.title.trim(), contents: form.contents.trim(), lectureCode: form.category === '2' ? form.lectureCode.trim() : '' }, idem) });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" center title={c.loginNeeded} />;
  if (submit.isSuccess) return <StateBlock code="EMPTY" center symbol="check" kicker={c.eyebrow} title={c.done} body={c.doneBody} actions={<><Button square size="sm" to="/my/tickets">{c.myTickets}</Button><Button variant="secondary" square size="sm" to="/support/guide">이용안내</Button></>} />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = copy.form.required;
    if (!form.contents.trim()) errs.contents = copy.form.required;
    if (form.category === '2' && !form.lectureCode.trim()) errs.lectureCode = copy.form.required;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    submit.mutate();
  };

  return (
    <section className={styles.formLayout} aria-labelledby="counsel-h">
      <div className={styles.formCopy}>
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 id="counsel-h">{c.title}</h2>
        <p>{c.lead}</p>
        <p className="muted" style={{ fontSize: 13 }}>{c.warn}</p>
        <div className={cx(styles.note, styles.warm)}><b>{c.suspicious.title}</b>{c.suspicious.body}</div>
      </div>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <FormField label={c.category} required htmlFor="cs-cat"><Select id="cs-cat" value={form.category} onChange={set('category')} options={c.categories} /></FormField>
        {form.category === '2' ? (
          <FormField label={c.lectureCode} required htmlFor="cs-code" error={errors.lectureCode} help={c.lectureHelp}><Input id="cs-code" value={form.lectureCode} onChange={set('lectureCode')} placeholder={c.lectureCodePlaceholder} maxLength={50} invalid={!!errors.lectureCode} /></FormField>
        ) : null}
        <FormField label={c.titleField} required htmlFor="cs-title" error={errors.title}><Input id="cs-title" value={form.title} onChange={set('title')} placeholder={c.titlePlaceholder} maxLength={250} invalid={!!errors.title} /></FormField>
        <FormField label={c.contents} required htmlFor="cs-contents" error={errors.contents}><Textarea id="cs-contents" value={form.contents} onChange={set('contents')} placeholder={c.contentsPlaceholder} maxLength={4000} invalid={!!errors.contents} /></FormField>
        <FormMessage>{submit.isError ? (isAppError(submit.error) ? submit.error.message : copy.form.fail) : ''}</FormMessage>
        <Button type="submit" square loading={submit.isPending}>{c.submit}</Button>
      </form>
    </section>
  );
}
