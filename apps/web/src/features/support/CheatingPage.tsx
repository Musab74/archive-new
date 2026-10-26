import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { isAppError, newIdempotencyKey } from '../../shared/api/client';
import { PillTabs } from '../../shared/ui/Tabs';
import { Button } from '../../shared/ui/Button';
import { Checkbox, FormField, FormMessage, Input, Select, Textarea } from '../../shared/ui/Form';
import { Icon } from '../../shared/ui/Icon';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';
import { CaptchaField, useCaptcha } from './CaptchaField';
import { fieldErrors } from './CounselPage';

type Tab = 'guide' | 'policy' | 'report';

/** archive/etc: 교육유의사항 (guide.html) · 부정행위방지정책 (cheating_guide.html) · 부정행위 제보 (cheating_report.html → cheating_ok.php). */
export default function CheatingPage() {
  const c = copy.cheating;
  const [sp, setSp] = useSearchParams();
  const tab = (['guide', 'policy', 'report'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'guide') as Tab;
  return (
    <section aria-labelledby="ch-h">
      <h2 id="ch-h" className={styles.h2} style={{ marginTop: 0 }}>{c.title}</h2>
      <p style={{ marginBottom: 16 }}>{c.lead}</p>
      <PillTabs items={c.tabs} value={tab} onChange={(k) => setSp(new URLSearchParams({ tab: k }))} label={c.title} />
      <div style={{ paddingTop: 20 }}>{tab === 'guide' ? <GuideTab /> : tab === 'policy' ? <PolicyTab /> : <ReportForm />}</div>
    </section>
  );
}

function GuideTab() {
  return (
    <div className={styles.cards}>
      {copy.cheating.guide.map((g) => (
        <article key={g.title} className={styles.card}>
          <h3>{g.title}</h3>
          {g.body ? <p>{g.body}</p> : null}
          {g.items.length ? <ul className={styles.list}>{g.items.map((i) => <li key={i}>{i}</li>)}</ul> : null}
        </article>
      ))}
    </div>
  );
}

function PolicyTab() {
  const p = copy.cheating.policy;
  return (
    <div>
      <div className={styles.note}><b>{p.what}</b>{p.whatBody}</div>
      <Button variant="secondary" square size="sm" href={p.videoUrl} icon={<Icon name="video" size={15} />}>{p.video}</Button>
      <h3 className={styles.h2}>{p.criteriaTitle}</h3>
      <ul className={styles.list}>{p.criteria.map((i) => <li key={i}>{i}</li>)}</ul>
      <h3 className={styles.h2}>{p.penaltyTitle}</h3>
      <div className={styles.cards}>{p.penalties.map((x) => <article key={x.title} className={styles.card}><h3>{x.title}</h3><ul className={styles.list}>{x.items.map((i) => <li key={i}>{i}</li>)}</ul></article>)}</div>
      <h3 className={styles.h2}>{p.preventTitle}</h3>
      <div className={styles.steps}>{p.prevent.map((x, i) => <div key={x.title}><b>{String(i + 1).padStart(2, '0')}</b><strong>{x.title}</strong><span>{x.body}</span></div>)}</div>
    </div>
  );
}

const EMPTY = { title: '', contents: '', name: '', email: '', phone: '', reply: '', agree: false, website: '' };

/** cheating_ok.php requires 제목, 내용, 제보회신, 성명, 이메일, 연락처 (the same message for any missing one). No member id is sent. */
function ReportForm() {
  const r = copy.cheating.report;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const idem = useMemo(() => newIdempotencyKey(), []);
  const captcha = useCaptcha('cheating');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = useMutation({
    mutationFn: () => supportApi.createCheating({ title: form.title, contents: form.contents, name: form.name, email: form.email, phone: form.phone, reply: form.reply as 'A', agree: true, website: form.website || undefined, captchaToken: captcha.state.token, captchaCode: captcha.state.code }, idem),
    onError: (e) => { setErrors(fieldErrors(e)); captcha.state.refresh(); },
  });
  if (submit.isSuccess) return <StateBlock code="EMPTY" center symbol="check" kicker={r.eyebrow} title={r.done} body={r.doneBody} hideActions />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = r.titleRequired;
    if (!form.contents.trim()) errs.contents = r.contentsRequired;
    if (!form.reply) errs.reply = r.replyRequired;
    for (const k of ['name', 'email', 'phone'] as const) if (!form[k].trim()) errs[k] = r.missing;
    if (!captcha.state.code.trim()) errs.captchaCode = copy.captcha.required;
    if (!form.agree) errs.agree = r.agreeRequired;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    submit.mutate();
  };
  return (
    <div className={styles.formLayout}>
      <div className={styles.formCopy}>
        <span className="eyebrow">{r.eyebrow}</span>
        <h2>{r.title}</h2>
        <p className="muted" style={{ fontSize: 13 }}>{r.required}</p>
        <div className={styles.note}><b>{r.scopeTitle}</b>{r.scope.map((s) => <span key={s.title} style={{ display: 'block' }}><b style={{ display: 'inline' }}>{s.title}</b> {s.body}</span>)}</div>
        <div className={styles.note}><b>{r.channelTitle}</b>{r.channel}</div>
      </div>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <FormField label={r.titleField} required htmlFor="ch-title" error={errors.title}><Input id="ch-title" value={form.title} onChange={set('title')} placeholder={r.titlePlaceholder} maxLength={250} invalid={!!errors.title} /></FormField>
        <FormField label={r.contents} required htmlFor="ch-contents" error={errors.contents}><Textarea id="ch-contents" value={form.contents} onChange={set('contents')} placeholder={r.contentsPlaceholder} rows={7} maxLength={20000} invalid={!!errors.contents} /></FormField>
        <h3 className={styles.subTitle}>{r.reporter}</h3>
        <FormField label={r.name} required htmlFor="ch-name" error={errors.name}><Input id="ch-name" value={form.name} onChange={set('name')} maxLength={50} invalid={!!errors.name} autoComplete="name" /></FormField>
        <div className={styles.pair}>
          <FormField label={r.email} required htmlFor="ch-email" error={errors.email}><Input id="ch-email" type="email" value={form.email} onChange={set('email')} maxLength={100} invalid={!!errors.email} autoComplete="email" /></FormField>
          <FormField label={r.phone} required htmlFor="ch-phone" error={errors.phone}><Input id="ch-phone" type="tel" value={form.phone} onChange={set('phone')} maxLength={30} invalid={!!errors.phone} autoComplete="tel" /></FormField>
        </div>
        <FormField label={r.reply} required htmlFor="ch-reply" error={errors.reply}><Select id="ch-reply" value={form.reply} onValueChange={(v) => setForm((f) => ({ ...f, reply: v }))} options={[{ value: '', label: r.replyPlaceholder }, ...r.replies]} /></FormField>
        <div className={styles.honeypot} aria-hidden="true"><label>홈페이지<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} name="website" /></label></div>
        <CaptchaField captcha={captcha} id="ch-captcha" error={errors.captchaCode} />
        <div className={styles.privacyBox}><b>{r.privacyTitle}</b><ul>{r.privacy.map((t) => <li key={t}>{t}</li>)}</ul></div>
        <div className={styles.consent}><Checkbox label={r.agree} checked={form.agree} onChange={(e) => setForm((f) => ({ ...f, agree: e.target.checked }))} aria-invalid={!!errors.agree} /></div>
        {errors.agree ? <FormMessage>{errors.agree}</FormMessage> : null}
        <FormMessage>{submit.isError ? (isAppError(submit.error) ? submit.error.message : copy.form.fail) : ''}</FormMessage>
        <Button type="submit" square loading={submit.isPending}>{r.submit}</Button>
      </form>
    </div>
  );
}
