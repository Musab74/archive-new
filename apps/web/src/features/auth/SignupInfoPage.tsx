import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { SignupShell } from './SignupShell';
import { clearConsent, readConsent, requiredAgreed } from './signupState';
import { membersApi, type CompanyHit } from '../../shared/api/endpoints/members';
import { isAppError } from '../../shared/api/client';
import { isMobile, isPhpEmail, LEGACY_MEMBER_PAGES, loginIdError, passwordPolicyError } from '../../shared/auth/accountRules';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input, MiniButton } from '../../shared/ui/Form';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

type Field = 'name' | 'mobile' | 'id' | 'password' | 'confirm' | 'email' | 'recomId';

/** First failing check in the order of function.js MemberJoin() (name → mobile → id → 중복확인 → password → email → 추천인). */
export function signupFormError(f: Record<Field, string>, idOk: boolean, recomOk: boolean): [Field, string] | null {
  if (!f.name.trim()) return ['name', '이름을 입력하세요.'];
  if (!f.mobile.trim()) return ['mobile', '휴대전화번호를 입력하세요.'];
  if (!isMobile(f.mobile)) return ['mobile', copy.validation.mobile];
  const idErr = loginIdError(f.id.trim());
  if (idErr) return ['id', idErr];
  if (!idOk) return ['id', copy.signup.info.idCheckNeeded];
  if (!f.password) return ['password', '비밀번호를 입력하세요.'];
  const pw = passwordPolicyError(f.password);
  if (pw) return ['password', pw];
  if (!f.confirm) return ['confirm', copy.signup.info.passwordConfirmRequired];
  if (f.password !== f.confirm) return ['confirm', copy.signup.info.passwordMismatch];
  if (!f.email.trim()) return ['email', copy.validation.emailRequired];
  if (!isPhpEmail(f.email.trim())) return ['email', copy.validation.email];
  if (f.recomId.trim() && !recomOk) return ['recomId', copy.signup.info.recomNeeded];
  return null;
}

/** AR-20 06-2 정보 입력 = public/member/join_info.html → POST /members/signup (join_ok.php). */
export default function SignupInfoPage() {
  const navigate = useNavigate();
  const i = copy.signup.info;
  const consent = readConsent();
  useEffect(() => { if (!consent || !requiredAgreed(consent)) navigate('/auth/signup/terms', { replace: true }); }, [consent, navigate]);
  const [form, setForm] = useState<Record<Field, string>>({ name: '', mobile: '', id: '', password: '', confirm: '', email: '', recomId: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [idState, setIdState] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [idReason, setIdReason] = useState('');
  const [recomState, setRecomState] = useState<{ ok: boolean; message: string } | null>(null);
  const [companyQ, setCompanyQ] = useState('');
  const [hits, setHits] = useState<CompanyHit[] | null>(null);
  const [company, setCompany] = useState<CompanyHit | null>(null);
  const [formError, setFormError] = useState('');
  const [needsLegacy, setNeedsLegacy] = useState(false);
  const set = (k: Field) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (k === 'id') { setIdState('idle'); setIdReason(''); }
    if (k === 'recomId') setRecomState(null);
  };

  const idCheck = useMutation({
    mutationFn: () => membersApi.idCheck(form.id.trim()),
    onMutate: () => setIdState('checking'),
    onSuccess: (r) => { setIdState(r.available ? 'ok' : 'taken'); setIdReason(r.available ? '' : r.reason ?? i.idTaken); },
    onError: () => setIdState('idle'),
  });
  const recomCheck = useMutation({ mutationFn: () => membersApi.recomIdCheck(form.recomId.trim()), onSuccess: (r) => setRecomState({ ok: r.exists, message: r.message }) });
  const companySearch = useMutation({ mutationFn: () => membersApi.companySearch(companyQ.trim()), onSuccess: (r) => setHits(r) });
  const signup = useMutation({
    mutationFn: () => membersApi.signup({
      id: form.id.trim(), password: form.password, name: form.name.trim(), mobile: form.mobile.trim(), email: form.email.trim(),
      ...(company ? { companyCode: company.companyCode } : {}), ...(form.recomId.trim() ? { recomId: form.recomId.trim() } : {}),
      consents: { mandatory: true, sending: !!consent?.sending, marketingEmail: !!consent?.marketingEmail, marketingSms: !!consent?.marketingSms },
    }),
    onSuccess: () => { clearConsent(); navigate('/auth/signup/complete', { replace: true }); },
    onError: (e) => {
      if (isAppError(e) && e.code === 'IDENTITY_REQUIRED') setNeedsLegacy(true);
      setFormError(isAppError(e) ? e.message : errorCopy.network);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = signupFormError(form, idState === 'ok', !!recomState?.ok);
    setErrors(err ? { [err[0]]: err[1] } : {});
    setFormError(err ? err[1] : '');
    if (!err) signup.mutate();
  };

  return (
    <SignupShell step={1}>
      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <h3>{i.title}</h3>
        <FormField label={i.id} required htmlFor="su-id" error={errors.id} help={idState === 'ok' ? i.idAvailable : idState === 'taken' ? idReason : i.idPlaceholder}
          action={<MiniButton onClick={() => { const err = loginIdError(form.id.trim()); if (err) setErrors((x) => ({ ...x, id: err })); else { setErrors((x) => ({ ...x, id: undefined })); idCheck.mutate(); } }} disabled={idState === 'checking'}>{i.idCheck}</MiniButton>}>
          <Input id="su-id" value={form.id} onChange={set('id')} placeholder={i.idPlaceholder} autoComplete="username" maxLength={20} invalid={!!errors.id || idState === 'taken'} />
        </FormField>
        <FormField label={i.password} required htmlFor="su-pw" error={errors.password} help={i.passwordHelp}>
          <Input id="su-pw" type="password" value={form.password} onChange={set('password')} placeholder={i.passwordPlaceholder} autoComplete="new-password" maxLength={100} invalid={!!errors.password} />
        </FormField>
        <FormField label={i.passwordConfirm} required htmlFor="su-pw2" error={errors.confirm}><Input id="su-pw2" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" maxLength={100} invalid={!!errors.confirm} /></FormField>
        <FormField label={i.name} required htmlFor="su-name" error={errors.name}><Input id="su-name" value={form.name} onChange={set('name')} autoComplete="name" maxLength={50} invalid={!!errors.name} /></FormField>
        <FormField label={i.mobile} required htmlFor="su-mobile" error={errors.mobile}><Input id="su-mobile" type="tel" value={form.mobile} onChange={set('mobile')} placeholder={i.mobilePlaceholder} autoComplete="tel" maxLength={13} invalid={!!errors.mobile} /></FormField>
        <div className={styles.legacyBox} role="note">
          <b>{i.verify}</b>
          <span>{i.verifyNote}</span>
          <Button variant="secondary" size="sm" square href={LEGACY_MEMBER_PAGES.join}>{i.verifyLink}</Button>
        </div>
        <FormField label={i.email} required htmlFor="su-email" error={errors.email}><Input id="su-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={100} invalid={!!errors.email} /></FormField>
        <FormField label={i.recomId} optional htmlFor="su-recom" error={errors.recomId} help={recomState?.message}
          action={<MiniButton onClick={() => { if (!form.recomId.trim()) setErrors((x) => ({ ...x, recomId: '추천인 ID를 입력하세요.' })); else recomCheck.mutate(); }} disabled={recomCheck.isPending}>{i.recomCheck}</MiniButton>}>
          <Input id="su-recom" value={form.recomId} onChange={set('recomId')} maxLength={50} invalid={!!errors.recomId || recomState?.ok === false} />
        </FormField>
        <FormField label={i.company} optional htmlFor="su-company"
          action={<MiniButton onClick={() => { if (companyQ.trim()) companySearch.mutate(); }} disabled={companySearch.isPending}>{i.companySearch}</MiniButton>}>
          <Input id="su-company" value={companyQ} onChange={(e) => setCompanyQ(e.target.value)} placeholder={i.companyPlaceholder} autoComplete="organization" maxLength={100} />
        </FormField>
        {company ? <div className={styles.picked}>{company.label ?? company.companyName}<Button variant="text" size="xs" onClick={() => setCompany(null)}>{i.companyClear}</Button></div> : null}
        {!company && hits ? (hits.length === 0 ? <p className={styles.note}>{i.companyEmpty}</p> : (
          <div className={styles.companyHits} role="listbox" aria-label={i.company}>
            {hits.map((h) => <button key={h.companyCode} type="button" role="option" aria-selected={false} onClick={() => { setCompany(h); setHits(null); }}>{h.label ?? h.companyName}</button>)}
          </div>
        )) : null}
        <FormMessage>{formError}</FormMessage>
        {needsLegacy ? <Button variant="secondary" square block href={LEGACY_MEMBER_PAGES.join}>{i.verifyLink}</Button> : null}
        <Button type="submit" square block loading={signup.isPending}>{i.submit}</Button>
      </form>
    </SignupShell>
  );
}
