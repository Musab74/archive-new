import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi, type ProfilePatch } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TypeLabel } from '../../shared/ui/Pill';
import { Input, FormField } from '../../shared/ui/Form';
import { my as copy, learnHome, auth as authCopy } from '../../shared/strings/ko';
import { modeOf, useEnrollments } from './queries';
import { cx } from '../../shared/utils/format';
import { isPhpEmail } from '../../shared/auth/accountRules';

const c = copy.profile;

/** AR-18 회원·이용정보: GET/PATCH /members/me, consent toggles (POST /members/me/terms), company, 이용건 table. */
export default function MyProfile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const me = useQuery({ queryKey: ['members', 'me'], queryFn: ({ signal }) => myRoomApi.me(signal) });
  const company = useQuery({ queryKey: ['members', 'company'], queryFn: ({ signal }) => myRoomApi.company(signal) });
  const enrollments = useEnrollments();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfilePatch>({});
  const [err, setErr] = useState<string | null>(null);
  // AR-18 변경 = 이메일 only: the PHP 회원정보 page keeps 휴대폰 (본인인증 정보), 소속, 부서, 직위 read-only.
  useEffect(() => { if (me.data) setForm({ email: me.data.email ?? '' }); }, [me.data]);
  const save = useMutation({ mutationFn: (p: ProfilePatch) => myRoomApi.updateMe(p), onSuccess: (d) => { qc.setQueryData(['members', 'me'], d); setEditing(false); toast(c.saved, { tone: 'ok' }); }, onError: (e) => setErr(isAppError(e) ? e.message : c.saveFail) });
  const consent = useMutation({ mutationFn: (b: { mandatory: boolean; sending: boolean; marketing: 'N' | 'E' | 'S' | 'Y' }) => myRoomApi.terms(b), onSuccess: () => { toast(c.consentSaved, { tone: 'ok' }); void qc.invalidateQueries({ queryKey: ['members', 'me'] }); }, onError: () => toast(c.consentFail, { tone: 'danger' }) });

  if (me.isError && isAppError(me.error) && me.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.email?.trim() || !isPhpEmail(form.email.trim())) { setErr(c.emailInvalid); return; }
    setErr(null);
    const patch: ProfilePatch = {};
    (Object.keys(form) as (keyof ProfilePatch)[]).forEach((k) => { const v = (form[k] ?? '').trim(); if (v !== ((me.data?.[k as keyof typeof me.data] as string | null | undefined) ?? '')) patch[k] = v; });
    if (Object.keys(patch).length === 0) { setEditing(false); return; }
    save.mutate(patch);
  };
  const m = me.data;
  const consents = m?.consents;
  const toggle = (key: 'sending' | 'marketing') => {
    if (!consents) return;
    const sending = key === 'sending' ? !consents.sending : consents.sending;
    const marketing = key === 'marketing' ? (consents.marketing === 'N' ? 'Y' : 'N') : (consents.marketing as 'N' | 'E' | 'S' | 'Y');
    consent.mutate({ mandatory: true, sending, marketing: (['N', 'E', 'S', 'Y'].includes(marketing) ? marketing : 'N') as 'N' | 'E' | 'S' | 'Y' });
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      {m?.mustChangePassword ? <div className={styles.alert} role="alert"><div><b>{c.mustChange}</b></div><Button size="xs" square to="/auth/password-change">{authCopy.passwordChange.crumb}</Button></div> : null}

      <section className={styles.card} aria-labelledby="pf-h">
        <div className={styles.cardHead}><h2 id="pf-h">{c.memberTitle}</h2>{m ? <Button variant="secondary" size="xs" square onClick={() => { setEditing((v) => !v); setErr(null); }}>{editing ? c.editCancel : c.emailChange}</Button> : null}</div>
        {me.isPending ? <Skeleton lines={5} /> : me.isError ? <StateBlock code="ACCESS_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void me.refetch()} /> : !editing ? (
          <table className={styles.table}>
            <thead><tr><th scope="col">{c.cols.item}</th><th scope="col">{c.cols.value}</th><th scope="col">{c.cols.manage}</th></tr></thead>
            <tbody>
              <tr><th scope="row">{c.id}</th><td>{m!.id}</td><td><span className={styles.note}>{c.idNote}</span></td></tr>
              <tr><th scope="row">{c.name}</th><td>{m!.name}</td><td><span className={styles.note}>{c.nameNote}</span></td></tr>
              <tr><th scope="row">{c.password}</th><td>••••••••</td><td><Link className="text-link" to="/auth/password-change">{c.passwordChange}</Link></td></tr>
              <tr><th scope="row">{c.mobile}</th><td>{m!.mobile || '—'}</td><td><span className={styles.note}>{c.mobileNote}</span><span className={styles.sub}>{c.mobileHelp}</span></td></tr>
              <tr><th scope="row">{c.email}</th><td>{m!.email || '—'}</td><td><button type="button" className="text-link" onClick={() => setEditing(true)}>{c.emailChange}</button></td></tr>
              <tr><th scope="row">{c.depart} / {c.position}</th><td>{[m!.depart, m!.position].filter(Boolean).join(' / ') || '—'}</td><td /></tr>
              <tr><th scope="row">{c.company}</th><td>{m!.companyName ?? c.companyNone}</td><td /></tr>
            </tbody>
          </table>
        ) : (
          <form onSubmit={submit} noValidate className={styles.grid2}>
            <FormField label={c.email} htmlFor="pf-email" error={err ?? undefined}><Input id="pf-email" type="email" value={form.email ?? ''} invalid={!!err} maxLength={100} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
            <div style={{ gridColumn: '1 / -1' }}><div className="action-row"><Button square type="submit" loading={save.isPending}>{c.save}</Button><Button variant="secondary" square onClick={() => { setEditing(false); setErr(null); }}>{c.editCancel}</Button></div></div>
          </form>
        )}
      </section>

      {m ? (
        <section className={styles.card} aria-labelledby="cs-h">
          <h2 id="cs-h">{c.consentsTitle}</h2>
          <div className={styles.toggle}><span>{c.consentMandatory}</span><TypeLabel tone={consents?.mandatory ? 'mint' : 'gray'} small>{consents?.mandatory ? '동의' : '미동의'}</TypeLabel></div>
          <div className={styles.toggle}><span>{c.consentSending}<span className={styles.sub}>{c.consentSendingWarn}</span></span><button type="button" role="switch" aria-checked={!!consents?.sending} aria-label={c.consentSending} className={styles.switch} disabled={consent.isPending} onClick={() => toggle('sending')}><i /></button></div>
          <div className={styles.toggle}><span>{c.consentMarketing}{consents && consents.marketing !== 'N' ? <span className={styles.sub}>{c.marketingLabel[consents.marketing] ?? ''}</span> : null}</span><button type="button" role="switch" aria-checked={!!consents && consents.marketing !== 'N'} aria-label={c.consentMarketing} className={styles.switch} disabled={consent.isPending} onClick={() => toggle('marketing')}><i /></button></div>
          <p className={styles.note} style={{ marginTop: 10 }}>{c.consentNote}</p>
        </section>
      ) : null}

      <section className={styles.card} aria-labelledby="co-h">
        <h2 id="co-h">{c.companyTitle}</h2>
        {company.isPending ? <Skeleton lines={3} /> : company.isError ? <p className={styles.note}>{c.companyFail}</p> : !company.data ? <p className={styles.note}>{c.companyNone}</p> : (
          <dl className={styles.kv}>
            <div><dt>{c.companyFields.name}</dt><dd>{company.data.companyName ?? '—'}</dd></div>
            <div><dt>{c.companyFields.ceo}</dt><dd>{company.data.ceo ?? '—'}</dd></div>
            <div><dt>{c.companyFields.address}</dt><dd>{[company.data.address01, company.data.address02].filter(Boolean).join(' ') || '—'}</dd></div>
            <div><dt>{c.companyFields.tel}</dt><dd>{company.data.tel ?? '—'}</dd></div>
            <div><dt>{c.companyFields.manager}</dt><dd>{company.data.eduManager?.name ? `${company.data.eduManager.name}${company.data.eduManager.email ? ` · ${company.data.eduManager.email}` : ''}` : '—'}</dd></div>
          </dl>
        )}
        <p className={styles.note} style={{ marginTop: 10 }}>{c.companyNote}</p>
      </section>

      <section className={styles.card} aria-labelledby="us-h">
        <h2 id="us-h">{c.usageTitle}</h2>
        {enrollments.isPending ? <Skeleton lines={3} /> : enrollments.isError ? <StateBlock code="ACCESS_ERROR" onRetry={() => void enrollments.refetch()} /> : enrollments.data.items.length === 0 ? <StateBlock code="NO_ACCESS" title={c.usageEmptyTitle} body={c.usageEmptyBody} /> : (
          <table className={styles.table}>
            <thead><tr><th scope="col">{c.usageCols.type}</th><th scope="col">{c.usageCols.enrollment}</th><th scope="col">{c.usageCols.start}</th><th scope="col">{c.usageCols.end}</th><th scope="col">{c.usageCols.mode}</th><th scope="col">{c.usageCols.state}</th><th scope="col" className={styles.num}>{c.usageCols.progress}</th></tr></thead>
            <tbody>
              {enrollments.data.items.map((e) => {
                const refund = modeOf(e.serviceType, undefined, e.mode) === 'refund';
                return (
                  <tr key={e.studySeq}>
                    <td><TypeLabel tone={refund ? 'navy' : 'mint'} small>{refund ? learnHome.refund : learnHome.general}</TypeLabel></td>
                    <td><span className={styles.title}>{e.courseName}</span><span className={styles.sub}>#{e.studySeq} · {e.lectureCode}</span></td>
                    <td>{e.lectureStart}</td><td>{e.lectureEnd}</td>
                    <td>{refund ? c.modeRefund : c.modeGeneral}<span className={styles.sub}>{c.modeNote}</span></td>
                    <td><span className={cx(styles.pill, e.state === 'ACTIVE' && styles.pillOk, e.state === 'ENDED' && styles.pillDanger)}>{c.stateLabel[e.state] ?? e.state}</span></td>
                    <td className={styles.num}>{refund ? `${Math.round(e.progress)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className={styles.note} style={{ marginTop: 10 }}>{c.usageNote} {c.refundGuide} <Link to="/my/records">{c.recordsLink}</Link></p>
      </section>

      <section className={cx(styles.card, styles.soft)} aria-labelledby="ac-h">
        <h2 id="ac-h">{c.accountTitle}</h2>
        <p className={styles.note}>{c.accountLead}</p>
        <div className="action-row"><Button variant="secondary" square size="sm" to="/terms">{c.terms}</Button><Button variant="secondary" square size="sm" to="/privacy">{c.privacy}</Button><Button variant="ghost" square size="sm" to="/support/counsel">{c.withdraw}</Button></div>
        <p className={styles.note} style={{ marginTop: 8 }}>{c.withdrawNote}</p>
      </section>
    </div>
  );
}
