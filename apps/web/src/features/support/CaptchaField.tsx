import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi, type CaptchaPurpose } from '../../shared/api/endpoints/support';
import { FormField, Input } from '../../shared/ui/Form';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { support as copy } from '../../shared/strings/ko';

export interface CaptchaState { token: string; code: string; setCode: (v: string) => void; refresh: () => void }

/**
 * 보안코드 (include/make_image.php). The picture and its signed token come from GET /support/captcha; a token works once,
 * so the form calls `refresh()` after any failed submit.
 */
export function useCaptcha(purpose: CaptchaPurpose) {
  const [code, setCode] = useState('');
  const q = useQuery({ queryKey: ['support', 'captcha', purpose], queryFn: ({ signal }) => supportApi.captcha(purpose, signal), staleTime: 0, gcTime: 0, refetchOnWindowFocus: false, retry: false });
  const { refetch } = q;
  const refresh = useCallback(() => { setCode(''); void refetch(); }, [refetch]);
  // A token expires after expiresIn seconds: fetch a new picture shortly before that.
  useEffect(() => {
    if (!q.data) return undefined;
    const t = setTimeout(refresh, Math.max(30, q.data.expiresIn - 30) * 1000);
    return () => clearTimeout(t);
  }, [q.data, refresh]);
  return { query: q, state: { token: q.data?.token ?? '', code, setCode, refresh } as CaptchaState };
}

export function CaptchaField({ captcha, id, error }: { captcha: ReturnType<typeof useCaptcha>; id: string; error?: string }) {
  const c = copy.captcha;
  const { query, state } = captcha;
  return (
    <FormField label={c.label} required htmlFor={id} error={error}>
      <div className={styles.captcha}>
        <div className={styles.captchaImage} aria-live="polite">
          {query.data ? <img src={query.data.image} width={query.data.width} height={query.data.height} alt={c.alt} /> : <span>{query.isError ? c.error : c.loading}</span>}
        </div>
        <Button type="button" variant="secondary" size="sm" square onClick={state.refresh} loading={query.isFetching} icon={<Icon name="refresh" size={14} />}>{c.refresh}</Button>
        <Input id={id} value={state.code} onChange={(e) => state.setCode(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" autoComplete="off" placeholder={c.placeholder} maxLength={5} invalid={!!error} />
      </div>
    </FormField>
  );
}
