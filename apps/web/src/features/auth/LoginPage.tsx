import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import styles from './Auth.module.css';
import { useSession } from '../../shared/auth/useSession';
import { routeForNext, safeNext } from '../../shared/auth/roles';
import { hasPasswordSkip } from '../../shared/auth/accountRules';
import { continueAfterStep } from './FirstTermsPage';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Checkbox, FormField, FormMessage, Input } from '../../shared/ui/Form';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

const REMEMBER_KEY = 'auth.rememberId.v1';
/** include/include_function.php $MobileAgent: the browsers the PHP treats as mobile (LoginHistory.Device 'Mobile'). */
const MOBILE_AGENT = /(iPod|iPhone|Android|BlackBerry|SymbianOS|SCH-M\d+|Opera Mini|Windows CE|Nokia|SonyEricsson|webOS|PalmOS)/;
const readRemembered = () => { try { return localStorage.getItem(REMEMBER_KEY) ?? ''; } catch { return ''; } };

/**
 * Refused logins show the login_ok.php alert the API answers ("아이디 또는 비밀번호를 잘못 입력했습니다.", the 휴면 안내,
 * "탈퇴한 회원입니다."); the local copy is only used when the response carried no message.
 */
function messageFor(code: string, fallback: string): string {
  switch (code) {
    case 'INVALID_CREDENTIALS': return fallback || copy.login.error;
    case 'DORMANT': return fallback || copy.login.dormant;
    case 'WITHDRAWN': return fallback || copy.login.withdrawn;
    case 'OTHER_SESSION': return copy.login.otherSession;
    case 'WRITE_DISABLED': return copy.login.writeDisabled;
    case 'CONFLICT': return copy.login.tooMany;
    default: return errorCopy.byCode[code] ?? fallback;
  }
}

/**
 * AR-20 05 로그인 = public/member/login.html → POST /auth/login (login_ok.php): id/password, 아이디 저장, find/signup links;
 * routes by `next` (terms → password → 진단 → 나의 학습실 for test ids → home). A learner who chose 「나중에 변경하기」 skips the
 * password step like the mobile SkipPasswordChange cookie.
 */
export default function LoginPage() {
  const { login, isAuthed, phase } = useSession();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const remembered = readRemembered();
  const [id, setId] = useState(remembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(!!remembered);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (remembered) pwRef.current?.focus(); }, [remembered]);

  if (phase === 'authed' && isAuthed && !busy) return <Navigate to={next ?? '/home'} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // function.js LoginSubmit(): separate alerts for a missing id / password.
    if (!id.trim()) { setError(copy.login.idRequired); return; }
    if (!password) { setError(copy.login.passwordRequired); pwRef.current?.focus(); return; }
    setBusy(true); setError('');
    try {
      const res = await login({ id: id.trim(), password, device: MOBILE_AGENT.test(navigator.userAgent) ? 'MOBILE' : 'PC' });
      try { if (remember) localStorage.setItem(REMEMBER_KEY, id.trim()); else localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
      if (res.next === 'password' && hasPasswordSkip(res.user.id)) { await continueAfterStep(navigate, res.user.id, next); return; }
      // login_ok.php keeps TopLogin (stay on the page the learner came from) for home and test ids; the other steps redirect.
      const target = res.next === 'home' || res.next === 'classroom' ? (next ?? routeForNext(res.next)) : routeForNext(res.next);
      navigate(res.next === 'home' || res.next === 'classroom' ? target : `${target}${next ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true });
    } catch (err) {
      setError(isAppError(err) ? messageFor(err.code, err.message) : errorCopy.network);
      setBusy(false);
    }
  };

  return (
    <div className={`band ${styles.layout}`}>
      <div className={styles.copy}>
        <span className="eyebrow">{copy.login.eyebrow}</span>
        <h1>{copy.login.title}</h1>
        <p>{copy.login.lead}</p>
        <div className={styles.rule} />
        <h2>{copy.login.corpTitle}</h2>
        <p>{copy.login.corpBody}</p>
        <Button variant="text" size="sm" to="/support/inquiry/new">{copy.login.corpLink}</Button>
      </div>
      <form className={styles.card} onSubmit={onSubmit} noValidate aria-labelledby="login-h">
        <h2 id="login-h">{copy.login.formTitle}</h2>
        <FormField label={copy.login.id} htmlFor="login-id"><Input id="login-id" value={id} onChange={(e) => setId(e.target.value)} placeholder={copy.login.idPlaceholder} autoComplete="username" maxLength={50} invalid={!!error} /></FormField>
        <FormField label={copy.login.password} htmlFor="login-pw"><Input ref={pwRef} id="login-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={copy.login.passwordPlaceholder} autoComplete="current-password" maxLength={200} invalid={!!error} /></FormField>
        <Checkbox className={styles.remember} label={copy.login.rememberId} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <FormMessage>{error}</FormMessage>
        <Button type="submit" square loading={busy}>{copy.login.submit}</Button>
        <div className={styles.links}>
          <Link to="/auth/find-id">{copy.login.findId}</Link>
          <Link to="/auth/find-password">{copy.login.findPassword}</Link>
          <Link to="/auth/signup/terms">{copy.login.signup}</Link>
        </div>
        <div className={styles.help}>{copy.login.help} <Link to="/support/guide" className="text-link" style={{ minHeight: 30, fontSize: 13 }}>{copy.login.helpLink}</Link></div>
      </form>
    </div>
  );
}
