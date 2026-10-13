import { useMemo, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { InquiryCreateSchema } from '@ainex/contracts';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { isAppError, newIdempotencyKey } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Checkbox, FormField, FormMessage, Input, Textarea } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';

const PHONE_RE = /^[0-9+\-() ]{7,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 기업교육 상담 신청 → POST /support/inquiries (InquiryCreateSchema). Idempotency key is fixed per form instance. */
export default function InquiryNewPage() {
  const c = copy.inquiry;
  const [form, setForm] = useState({ companyName: '', name: '', phone: '', email: '', personnel: '', contents: '', agree: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const idem = useMemo(() => newIdempotencyKey(), []);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = useMutation({ mutationFn: () => supportApi.createInquiry({ ...form, agree: true }, idem) });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.companyName.trim()) errs.companyName = copy.form.required;
    if (!form.name.trim()) errs.name = copy.form.required;
    if (!form.phone.trim()) errs.phone = copy.form.required; else if (!PHONE_RE.test(form.phone.trim())) errs.phone = copy.form.phone;
    if (!form.email.trim()) errs.email = copy.form.required; else if (!EMAIL_RE.test(form.email.trim())) errs.email = copy.form.email;
    if (form.personnel && !/^[1-9]\d*$/.test(form.personnel.trim())) errs.personnel = copy.form.personnel;
    if (!form.contents.trim()) errs.contents = copy.form.required;
    if (!form.agree) errs.agree = copy.form.agree;
    setErrors(errs);
    if (Object.keys(errs).length) { setFormError(copy.form.required); return; }
    const parsed = InquiryCreateSchema.safeParse({ ...form, agree: true });
    if (!parsed.success) { setFormError(copy.form.required); return; }
    setFormError('');
    submit.mutate();
  };

  if (submit.isSuccess) {
    return <StateBlock code="EMPTY" center symbol="check" kicker={c.eyebrow} title={c.done} body={c.doneBody} actions={<><Button square size="sm" to="/">메인으로</Button><Button variant="secondary" square size="sm" to="/support/guide">이용안내</Button></>} />;
  }
  return (
    <section className={styles.formLayout} aria-labelledby="inq-h">
      <div className={styles.formCopy}>
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 id="inq-h">{c.title}</h2>
        <p>{c.lead}</p>
        <div className={styles.note}><b>{c.note.title}</b>{c.note.body}</div>
        <p className="muted" style={{ fontSize: 13 }}>{c.phoneLine}</p>
        <h3 className={styles.procTitle}>{c.stepsTitle}</h3>
        <div className={styles.proc}>{c.steps.map((s, i) => <span key={s}><b>{String(i + 1).padStart(2, '0')}</b>{s}</span>)}</div>
      </div>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.pair}>
          <FormField label={c.companyName} required htmlFor="inq-company" error={errors.companyName}><Input id="inq-company" value={form.companyName} onChange={set('companyName')} maxLength={100} invalid={!!errors.companyName} autoComplete="organization" /></FormField>
          <FormField label={c.name} required htmlFor="inq-name" error={errors.name}><Input id="inq-name" value={form.name} onChange={set('name')} maxLength={50} invalid={!!errors.name} autoComplete="name" /></FormField>
        </div>
        <div className={styles.pair}>
          <FormField label={c.phone} required htmlFor="inq-phone" error={errors.phone}><Input id="inq-phone" type="tel" value={form.phone} onChange={set('phone')} maxLength={30} invalid={!!errors.phone} autoComplete="tel" /></FormField>
          <FormField label={c.email} required htmlFor="inq-email" error={errors.email}><Input id="inq-email" type="email" value={form.email} onChange={set('email')} maxLength={100} invalid={!!errors.email} autoComplete="email" /></FormField>
        </div>
        <FormField label={c.personnel} optional htmlFor="inq-personnel" error={errors.personnel}><Input id="inq-personnel" inputMode="numeric" value={form.personnel} onChange={set('personnel')} placeholder={c.personnelPlaceholder} maxLength={50} invalid={!!errors.personnel} /></FormField>
        <FormField label={c.contents} required htmlFor="inq-contents" error={errors.contents}><Textarea id="inq-contents" value={form.contents} onChange={set('contents')} placeholder={c.contentsPlaceholder} maxLength={4000} invalid={!!errors.contents} /></FormField>
        <div className={cx(styles.consent)}>
          <Checkbox label={c.agree} checked={form.agree} onChange={(e) => setForm((f) => ({ ...f, agree: e.target.checked }))} aria-invalid={!!errors.agree} />
          <Button variant="text" size="xs" to="/privacy">{c.agreeView}</Button>
        </div>
        {errors.agree ? <FormMessage>{errors.agree}</FormMessage> : null}
        <FormMessage>{formError || (submit.isError ? (isAppError(submit.error) ? submit.error.message : copy.form.fail) : '')}</FormMessage>
        <Button type="submit" square loading={submit.isPending}>{c.submit}</Button>
      </form>
    </section>
  );
}
