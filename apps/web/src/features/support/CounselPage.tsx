import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import styles from './Support.module.css';
import { supportApi } from '../../shared/api/endpoints/support';
import { isAppError, newIdempotencyKey } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input, Select, Textarea } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { support as copy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';
import { CaptchaField, useCaptcha } from './CaptchaField';

/** $Counsel_array — fallback while GET /support/counsel/options loads. */
const CATEGORIES = [{ value: 'A', label: '학습 내용 문의' }, { value: 'B', label: '시스템 문의' }, { value: 'C', label: '이의 제기' }, { value: 'D', label: '수강 관련 문의' }, { value: 'E', label: '결제 관련 문의' }];
const FILE_EXT = ['hwp', 'hwpx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'zip'];
const FILE_MAX = 52_428_800;

/** Error messages from the API's details[] (zod issues / 보안코드) keyed by field. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!isAppError(e) || !Array.isArray(e.details)) return {};
  const out: Record<string, string> = {};
  for (const d of e.details as Array<{ path?: string; message?: string }>) if (d?.path && d.message && !out[d.path]) out[d.path] = d.message;
  return out;
}

/**
 * 1:1 문의 작성 (counsel_ask.php + ask_ok.php): 문의종류 (A–E), 관련 콘텐츠 (학습 내용 문의일 때, 본인 수강 과정만),
 * 제목, 내용, 첨부 1개, 보안코드 → POST /support/counsel. Requires login.
 */
export default function CounselPage() {
  const c = copy.counsel;
  const { isAuthed, phase } = useSession();
  const [form, setForm] = useState({ category: 'A', studySeq: '', title: '', contents: '' });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const idem = useMemo(() => newIdempotencyKey(), []);
  const captcha = useCaptcha('counsel');
  const options = useQuery({ queryKey: ['support', 'counsel', 'options'], queryFn: ({ signal }) => supportApi.counselOptions(signal), enabled: isAuthed, staleTime: 5 * 60_000 });
  const submit = useMutation({
    mutationFn: () => supportApi.createCounsel({ category: form.category, title: form.title.trim(), contents: form.contents.trim(), studySeq: form.category === 'A' && form.studySeq ? Number(form.studySeq) : undefined, captchaToken: captcha.state.token, captchaCode: captcha.state.code, file }, idem),
    onError: (e) => { setErrors(fieldErrors(e)); captcha.state.refresh(); },
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" center title={c.loginNeeded} />;
  if (submit.isSuccess) {
    return <StateBlock code="EMPTY" center symbol="check" kicker={c.eyebrow} title={c.done} body={c.doneBody} actions={<><Button square size="sm" to={submit.data.idx ? `/support/my/${submit.data.idx}` : '/support/my'}>{c.toDetail}</Button><Button variant="secondary" square size="sm" to="/support/my">{c.myTickets}</Button></>} />;
  }

  const onFile = (f: File | null) => {
    const errs = { ...errors }; delete errs.file;
    if (f) {
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (!f.name.includes('.') || !FILE_EXT.includes(ext)) errs.file = c.fileType;
      else if (f.size > FILE_MAX) errs.file = c.fileTooBig;
    }
    setErrors(errs);
    setFile(errs.file ? null : f);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = c.titleRequired;
    if (!form.contents.trim()) errs.contents = c.contentsRequired;
    if (!captcha.state.code.trim()) errs.captchaCode = copy.captcha.required;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    submit.mutate();
  };
  const enrollments = options.data?.enrollments ?? [];

  return (
    <section className={styles.formLayout} aria-labelledby="counsel-h">
      <div className={styles.formCopy}>
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 id="counsel-h">{c.title}</h2>
        <p>{c.lead}</p>
        <p className="muted" style={{ fontSize: 13 }}>{c.warn}</p>
        <div className={cx(styles.note, styles.warm)}><b>{c.suspicious.title}</b>{c.suspicious.body}<br /><Button variant="text" size="xs" to="/support/cheating?tab=report">{c.suspicious.link} →</Button></div>
        <Button variant="text" size="sm" to="/support/my">{c.myTickets} →</Button>
      </div>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <FormField label={c.category} required htmlFor="cs-cat"><Select id="cs-cat" value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))} options={options.data?.categories ?? CATEGORIES} /></FormField>
        {form.category === 'A' ? (
          <FormField label={c.course} optional htmlFor="cs-course" help={c.courseHelp} error={errors.studySeq}>
            <Select id="cs-course" value={form.studySeq} onValueChange={(v) => setForm((f) => ({ ...f, studySeq: v }))} options={[{ value: '', label: c.courseNone }, ...enrollments.map((e) => ({ value: String(e.studySeq), label: e.title }))]} />
          </FormField>
        ) : null}
        <FormField label={c.titleField} required htmlFor="cs-title" error={errors.title}><Input id="cs-title" value={form.title} onChange={set('title')} placeholder={c.titlePlaceholder} maxLength={250} invalid={!!errors.title} /></FormField>
        <FormField label={c.contents} required htmlFor="cs-contents" error={errors.contents}><Textarea id="cs-contents" value={form.contents} onChange={set('contents')} placeholder={c.contentsPlaceholder} maxLength={20000} rows={8} invalid={!!errors.contents} /></FormField>
        <FormField label={c.file} optional htmlFor="cs-file" help={c.fileHelp} error={errors.file}>
          <input id="cs-file" className={styles.fileInput} type="file" accept={FILE_EXT.map((x) => `.${x}`).join(',')} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </FormField>
        <CaptchaField captcha={captcha} id="cs-captcha" error={errors.captchaCode} />
        <FormMessage>{submit.isError ? (isAppError(submit.error) ? submit.error.message : copy.form.fail) : ''}</FormMessage>
        <Button type="submit" square loading={submit.isPending}>{c.submit}</Button>
      </form>
    </section>
  );
}
