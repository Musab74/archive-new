import { useMemo, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { InquiryCreateSchema, PHP_EMAIL_RE } from '@ainex/contracts';
import styles from './Support.module.css';
import { supportApi, type InquiryCreate } from '../../shared/api/endpoints/support';
import { isAppError, newIdempotencyKey } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Checkbox, FormField, FormMessage, Input, Select, Textarea } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';
import { CaptchaField, useCaptcha } from './CaptchaField';
import { fieldErrors } from './CounselPage';

const EMPTY = { companyName: '', name: '', phone: '', email: '', personnel: '', operatingType: 'undecided', startDate: '', endDate: '', target: '', contents: '', agree: false, website: '' };

/**
 * 기업교육상담 (AR-19 D / AR-20 비회원 상담) → POST /support/inquiries (archive/main/inquiry_ok.php → Inquiry). No login needed.
 * Required like the PHP form: 회사명, 이름, 연락처(숫자), 이메일, 예상인원(숫자), 내용, 동의, 보안코드. Abuse protection: 보안코드,
 * hidden honeypot, per-IP rate limit and a double-submit guard on the API. Idempotency key is fixed per form instance.
 */
export default function InquiryNewPage() {
  const c = copy.inquiry;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const idem = useMemo(() => newIdempotencyKey(), []);
  const captcha = useCaptcha('inquiry');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = useMutation({
    mutationFn: () => supportApi.createInquiry({ ...form, operatingType: form.operatingType as InquiryCreate['operatingType'], agree: true, website: form.website || undefined, captchaToken: captcha.state.token, captchaCode: captcha.state.code }, idem),
    onError: (e) => { setErrors(fieldErrors(e)); captcha.state.refresh(); },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const f = copy.form;
    const errs: Record<string, string> = {};
    const digits = form.phone.replace(/[\s-]/g, '');
    if (!form.companyName.trim()) errs.companyName = '회사명을 입력하세요.';
    if (!form.name.trim()) errs.name = '이름을 입력하세요.';
    if (!form.phone.trim()) errs.phone = '연락처를 입력하세요.'; else if (!/^\d{8,11}$/.test(digits)) errs.phone = f.phone;
    if (!form.email.trim()) errs.email = '이메일을 입력하세요.'; else if (!PHP_EMAIL_RE.test(form.email.trim())) errs.email = f.email;
    if (!form.personnel.trim()) errs.personnel = '예상인원을 입력하세요.'; else if (!/^\d+$/.test(form.personnel.trim())) errs.personnel = f.personnel;
    if (form.startDate && form.endDate && form.startDate > form.endDate) errs.endDate = f.period;
    if (!form.contents.trim()) errs.contents = '문의내용을 입력하세요.';
    if (!captcha.state.code.trim()) errs.captchaCode = copy.captcha.required;
    if (!form.agree) errs.agree = f.agree;
    setErrors(errs);
    if (Object.keys(errs).length) { setFormError(Object.values(errs)[0] ?? f.required); return; }
    const parsed = InquiryCreateSchema.safeParse({ ...form, agree: true, website: form.website || undefined, captchaToken: captcha.state.token || 'x'.repeat(10), captchaCode: captcha.state.code });
    if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? f.required); return; }
    setFormError('');
    submit.mutate();
  };

  if (submit.isSuccess) {
    return <StateBlock code="EMPTY" center symbol="check" kicker={c.eyebrow} title={c.done} body={<>{c.doneBody}{submit.data.notified === false ? <><br /><small>{c.notNotified}</small></> : null}</>} actions={<><Button square size="sm" to="/">메인으로</Button><Button variant="secondary" square size="sm" to="/support/guide">이용안내</Button></>} />;
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
        <p style={{ marginTop: 18 }}><Button variant="text" size="sm" to="/support/archiving">{c.archivingLink} →</Button></p>
      </div>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.pair}>
          <FormField label={c.companyName} required htmlFor="inq-company" error={errors.companyName}><Input id="inq-company" value={form.companyName} onChange={set('companyName')} maxLength={100} invalid={!!errors.companyName} autoComplete="organization" /></FormField>
          <FormField label={c.name} required htmlFor="inq-name" error={errors.name}><Input id="inq-name" value={form.name} onChange={set('name')} maxLength={50} invalid={!!errors.name} autoComplete="name" /></FormField>
        </div>
        <div className={styles.pair}>
          <FormField label={c.phone} required htmlFor="inq-phone" error={errors.phone}><Input id="inq-phone" type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder={c.phonePlaceholder} maxLength={13} invalid={!!errors.phone} autoComplete="tel" /></FormField>
          <FormField label={c.email} required htmlFor="inq-email" error={errors.email}><Input id="inq-email" type="email" value={form.email} onChange={set('email')} maxLength={100} invalid={!!errors.email} autoComplete="email" /></FormField>
        </div>
        <div className={styles.pair}>
          <FormField label={c.personnel} required htmlFor="inq-personnel" error={errors.personnel}><Input id="inq-personnel" inputMode="numeric" value={form.personnel} onChange={set('personnel')} placeholder={c.personnelPlaceholder} maxLength={10} invalid={!!errors.personnel} /></FormField>
          <FormField label={c.operatingType} optional htmlFor="inq-type"><Select id="inq-type" value={form.operatingType} onValueChange={(v) => setForm((f) => ({ ...f, operatingType: v }))} options={c.operatingTypes} /></FormField>
        </div>
        <div className={styles.pair}>
          <FormField label={c.startDate} optional htmlFor="inq-start"><Input id="inq-start" type="date" value={form.startDate} onChange={set('startDate')} /></FormField>
          <FormField label={c.endDate} optional htmlFor="inq-end" error={errors.endDate}><Input id="inq-end" type="date" value={form.endDate} onChange={set('endDate')} invalid={!!errors.endDate} /></FormField>
        </div>
        <FormField label={c.target} optional htmlFor="inq-target"><Input id="inq-target" value={form.target} onChange={set('target')} placeholder={c.targetPlaceholder} maxLength={200} /></FormField>
        <FormField label={c.contents} required htmlFor="inq-contents" error={errors.contents}><Textarea id="inq-contents" value={form.contents} onChange={set('contents')} placeholder={c.contentsPlaceholder} maxLength={20000} rows={6} invalid={!!errors.contents} /></FormField>
        <div className={styles.honeypot} aria-hidden="true"><label>홈페이지<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} name="website" /></label></div>
        <CaptchaField captcha={captcha} id="inq-captcha" error={errors.captchaCode} />
        <div className={styles.privacyBox}>
          <b>{c.privacy.title}</b>
          <ul>{c.privacy.items.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
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
