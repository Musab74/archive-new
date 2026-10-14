import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import styles from '../Admin.module.css';
import { useAdminSession } from '../../../shared/auth/useAdminSession';
import { isAppError } from '../../../shared/api/client';
import { safeNext } from '../../../shared/auth/roles';
import { AButton, AInput, Callout } from '../../../shared/ui/admin';
import { FormMessage } from '../../../shared/ui/Form';
import { adm } from '../strings';
import { Icon } from '../../../shared/ui/Icon';

/** /admin/login — id, password, 2차 인증(휴대폰 뒤 4자리). */
export default function AdminLoginPage() {
  const { isAuthed, phase, login } = useAdminSession();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(sp.get('next')) ?? '/admin';
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [secondFactor, setSecondFactor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [busy, setBusy] = useState(false);

  if (phase !== 'booting' && isAuthed) return <Navigate to={next.startsWith('/admin') ? next : '/admin'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ id: id.trim(), password, secondFactor: secondFactor.trim() || undefined });
      navigate(next.startsWith('/admin') && next !== '/admin/login' ? next : '/admin', { replace: true });
    } catch (err) {
      const code = isAppError(err) ? err.code : 'UNKNOWN';
      if (code === 'TWO_FACTOR_REQUIRED' || code === 'TWO_FACTOR_MISMATCH') setNeeds2fa(true);
      setError(adm.login.errors[code] ?? (isAppError(err) ? err.message : adm.common.failed));
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.loginWrap}>
      <form className={styles.loginCard} onSubmit={(e) => void submit(e)} aria-labelledby="admin-login-title">
        <span className={styles.loginMark} aria-hidden="true"><Icon name="shield" size={24} /></span>
        <span className="eyebrow">{adm.brand}</span>
        <h1 id="admin-login-title">{adm.login.title}</h1>
        <p>{adm.login.lead}</p>
        <div className={styles.loginForm}>
          <label>{adm.login.id}<AInput name="id" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required autoFocus /></label>
          <label>{adm.login.password}<AInput name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          <label>{adm.login.secondFactor}<AInput name="secondFactor" inputMode="numeric" maxLength={4} pattern="[0-9]{0,4}" value={secondFactor} onChange={(e) => setSecondFactor(e.target.value.replace(/\D/g, ''))} invalid={needs2fa && !secondFactor} placeholder="0000" /></label>
          <FormMessage>{error}</FormMessage>
          <AButton type="submit" variant="primary" icon="lock" loading={busy} className={styles.loginSubmit}>{adm.login.submit}</AButton>
        </div>
        <Callout className="u-mt-16">{adm.login.readOnlyNote}</Callout>
        <div className={styles.loginFoot}><Link to="/"><Icon name="arrow-left" size={15} />{adm.login.toLearner}</Link><span>AINEX Archive</span></div>
      </form>
    </div>
  );
}
