import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { SignupShell } from './SignupShell';
import { clearConsent, readConsent } from './signupState';
import { membersApi } from '../../shared/api/endpoints/members';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input, MiniButton } from '../../shared/ui/Form';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

const ID_RE = /^[a-zA-Z0-9_]{5,20}$/;
const PHONE_RE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** AR-20 06-2 정보 입력 → POST /members/signup; id uniqueness via POST /members/id-check. */
export default function SignupInfoPage() {
  const navigate = useNavigate();
  const i = copy.signup.info;
  const consent = readConsent();
  useEffect(() => { if (!consent || !consent.terms || !consent.privacy) navigate('/auth/signup/terms', { replace: true }); }, [consent, navigate]);
  const [form, setForm] = useState({ id: '', password: '', confirm: '', name: '', phone: '', email: '', company: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idState, setIdState] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [formError, setFormError] = useState('');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm((f) => ({ ...f, [k]: e.target.value })); if (k === 'id') setIdState('idle'); };

  const idCheck = useMutation({ mutationFn: () => membersApi.idCheck(form.id.trim()), onMutate: () => setIdState('checking'), onSuccess: (r) => setIdState(r.available ? 'ok' : 'taken'), onError: () => setIdState('idle') });
  const signup = useMutation({
    mutationFn: () => membersApi.signup({ id: form.id.trim(), password: form.password, name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), company: form.company.trim(), agreeTerms: true, agreePrivacy: true, agreeMarketing: !!consent?.marketing }),
    onSuccess: () => { clearConsent(); navigate('/auth/signup/complete', { replace: true }); },
    onError: (e) => setFormError(isAppError(e) ? (e.code === 'CONFLICT' ? i.idTaken : e.message) : errorCopy.network),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!ID_RE.test(form.id.trim())) errs.id = copy.validation.idFormat;
    else if (idState !== 'ok') errs.id = i.idCheckNeeded;
    if (form.password.length < 8) errs.password = copy.validation.passwordRule;
    if (form.password !== form.confirm) errs.confirm = i.passwordMismatch;
    if (!form.name.trim()) errs.name = copy.validation.required;
    if (!PHONE_RE.test(form.phone.trim())) errs.phone = copy.validation.phone;
    if (!EMAIL_RE.test(form.email.trim())) errs.email = copy.validation.email;
    setErrors(errs);
    if (Object.keys(errs).length) { setFormError(copy.validation.required); return; }
    setFormError('');
    signup.mutate();
  };

  return (
    <SignupShell step={1}>
      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <h3>{i.title}</h3>
        <FormField label={i.id} required htmlFor="su-id" error={errors.id} help={idState === 'ok' ? i.idAvailable : idState === 'taken' ? i.idTaken : i.idPlaceholder}
          action={<MiniButton onClick={() => { if (ID_RE.test(form.id.trim())) idCheck.mutate(); else setErrors((x) => ({ ...x, id: copy.validation.idFormat })); }} disabled={idState === 'checking'}>{i.idCheck}</MiniButton>}>
          <Input id="su-id" value={form.id} onChange={set('id')} placeholder={i.idPlaceholder} autoComplete="username" maxLength={20} invalid={!!errors.id || idState === 'taken'} />
        </FormField>
        <FormField label={i.password} required htmlFor="su-pw" error={errors.password}><Input id="su-pw" type="password" value={form.password} onChange={set('password')} placeholder={i.passwordPlaceholder} autoComplete="new-password" maxLength={100} invalid={!!errors.password} /></FormField>
        <FormField label={i.passwordConfirm} required htmlFor="su-pw2" error={errors.confirm}><Input id="su-pw2" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" maxLength={100} invalid={!!errors.confirm} /></FormField>
        <FormField label={i.name} required htmlFor="su-name" error={errors.name}><Input id="su-name" value={form.name} onChange={set('name')} autoComplete="name" maxLength={50} invalid={!!errors.name} /></FormField>
        <FormField label={i.phone} required htmlFor="su-phone" error={errors.phone}><Input id="su-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder={i.phonePlaceholder} autoComplete="tel" maxLength={20} invalid={!!errors.phone} /></FormField>
        <FormField label={i.email} required htmlFor="su-email" error={errors.email}><Input id="su-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={100} invalid={!!errors.email} /></FormField>
        <FormField label={i.company} optional htmlFor="su-company"><Input id="su-company" value={form.company} onChange={set('company')} autoComplete="organization" maxLength={100} /></FormField>
        <FormMessage>{formError}</FormMessage>
        <Button type="submit" square block loading={signup.isPending}>{i.submit}</Button>
      </form>
    </SignupShell>
  );
}
