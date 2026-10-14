import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { CompanyCheck, CompanyInfo, CompanyMeta } from '../../../../shared/api/schemas';
import { AButton, ACheckbox, AInput, ASelect, ATextarea, FieldRow } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { autoHyphen, openPostcode } from './postcode';

export const TEXT_KEYS = ['CompanyScale', 'CompanyName', 'CompanyCode', 'CompanyID', 'HRD', 'Ceo', 'Uptae', 'Upjong', 'Zipcode', 'Address01', 'Address02', 'Tel', 'Tel2', 'Fax', 'Fax2', 'Email', 'BankName', 'BankNumber', 'HomePage', 'CyberURL', 'EduManager', 'EduManagerPhone', 'EduManagerEmail', 'SalesManager', 'Remark'] as const;
export const FLAG_KEYS = ['CSEnabled', 'CyberEnabled', 'SendSMS'] as const;
export type CompanyFormValues = Record<(typeof TEXT_KEYS)[number], string> & Record<(typeof FLAG_KEYS)[number], boolean>;
export type FormErrors = Partial<Record<keyof CompanyFormValues, string>>;

export function emptyValues(): CompanyFormValues {
  const v = Object.fromEntries(TEXT_KEYS.map((k) => [k, ''])) as Record<(typeof TEXT_KEYS)[number], string>;
  return { ...v, CompanyScale: 'C', CSEnabled: false, CyberEnabled: false, SendSMS: true };
}
export function fromCompany(c: CompanyInfo): CompanyFormValues {
  return {
    CompanyScale: c.scale ?? 'C', CompanyName: c.companyName, CompanyCode: c.companyCode, CompanyID: c.companyId ?? '', HRD: c.hrd ?? '', Ceo: c.ceo ?? '', Uptae: c.uptae ?? '', Upjong: c.upjong ?? '', Zipcode: c.zipcode ?? '', Address01: c.address01 ?? '', Address02: c.address02 ?? '',
    Tel: c.tel ?? '', Tel2: c.tel2 ?? '', Fax: c.fax ?? '', Fax2: c.fax2 ?? '', Email: c.email ?? '', BankName: c.bankName ?? '', BankNumber: c.bankNumber ?? '', HomePage: c.manageCode ?? '', CyberURL: c.cyberUrl ?? '', EduManager: c.eduManager ?? '', EduManagerPhone: c.eduManagerPhone ?? '', EduManagerEmail: c.eduManagerEmail ?? '',
    SalesManager: c.salesManager ?? '', Remark: c.remark ?? '', CSEnabled: c.csEnabled, CyberEnabled: c.cyberEnabled, SendSMS: c.sendSMS !== 'N',
  };
}
const yn = (b: boolean) => (b ? 'Y' : 'N');
/** POST body: every column (blank text → null). */
export function toCreateBody(v: CompanyFormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) out[k] = v[k].trim() === '' ? (k === 'CompanyName' || k === 'CompanyCode' || k === 'SalesManager' || k === 'CompanyScale' ? v[k].trim() : null) : v[k].trim();
  for (const k of FLAG_KEYS) out[k] = yn(v[k]);
  return out;
}
/** PATCH body: only changed keys; CompanyCode / CompanyID are never sent (fixed after creation). */
export function diffPatchBody(base: CompanyFormValues, cur: CompanyFormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) { if (k === 'CompanyCode' || k === 'CompanyID') continue; if (base[k] !== cur[k]) out[k] = cur[k].trim() === '' ? (k === 'CompanyName' || k === 'SalesManager' ? cur[k].trim() : null) : cur[k].trim(); }
  for (const k of FLAG_KEYS) if (base[k] !== cur[k]) out[k] = yn(cur[k]);
  return out;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateCompanyForm(v: CompanyFormValues, mode: 'create' | 'edit'): FormErrors {
  const e: FormErrors = {};
  const f = adm.companies.form;
  if (!v.CompanyName.trim()) e.CompanyName = f.required;
  if (mode === 'create') {
    const code = v.CompanyCode.replace(/[\s-]/g, '');
    if (!code) e.CompanyCode = f.required; else if (!/^[A-Za-z0-9_]{2,20}$/.test(code)) e.CompanyCode = tr('영문/숫자 2~20자', 'Letters/digits, 2–20 chars');
    const id = v.CompanyID.replace(/\s/g, '');
    if (id && !/^[A-Za-z0-9_-]{2,50}$/.test(id)) e.CompanyID = tr('영문/숫자/_/- 2~50자', 'Letters/digits/_/-, 2–50 chars');
  }
  const hp = v.HomePage.replace(/\s/g, '');
  if (hp && !/^[A-Za-z0-9_-]{2,50}$/.test(hp)) e.HomePage = tr('영문/숫자/_/- 2~50자', 'Letters/digits/_/-, 2–50 chars');
  if (!v.SalesManager.trim()) e.SalesManager = f.required;
  if (v.Email.trim() && !EMAIL.test(v.Email.trim())) e.Email = tr('이메일 형식을 확인하세요.', 'Check the e-mail format.');
  return e;
}

/** Debounced GET /admin/companies/check for one field; idle when the value is blank or unchanged from `skipValue`. */
function useAvailability(field: 'CompanyCode' | 'CompanyID' | 'HomePage', value: string, opts: { enabled: boolean; excludeIdx?: number; skipValue?: string }) {
  const [state, setState] = useState<{ status: 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'; message?: string }>({ status: 'idle' });
  const v = value.replace(/\s/g, '');
  useEffect(() => {
    if (!opts.enabled || !v || v === (opts.skipValue ?? '').replace(/\s/g, '')) { setState({ status: 'idle' }); return; }
    const ctrl = new AbortController();
    setState({ status: 'checking' });
    const t = setTimeout(() => {
      adminApi.companyCheck(field, v, opts.excludeIdx, ctrl.signal).then((r: CompanyCheck) => {
        if (ctrl.signal.aborted) return;
        if (r.formatError) setState({ status: 'invalid', message: r.formatError });
        else if (r.available) setState({ status: 'ok', message: adm.companies.form.available });
        else setState({ status: 'taken', message: adm.companies.form.taken(`${r.conflict?.companyName ?? ''} ${r.conflict?.companyCode ?? ''}`.trim()) });
      }).catch(() => { if (!ctrl.signal.aborted) setState({ status: 'idle' }); });
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [field, v, opts.enabled, opts.excludeIdx, opts.skipValue]);
  return state;
}
const Avail = ({ s }: { s: ReturnType<typeof useAvailability> }) => s.status === 'idle' ? null : <span style={{ fontSize: 12, color: s.status === 'ok' ? 'var(--c-ok, #1f7a4d)' : s.status === 'checking' ? 'var(--c-muted)' : 'var(--c-danger)' }} role="status">{s.status === 'checking' ? adm.companies.form.checking : s.message}</span>;

export interface CompanyFormProps { mode: 'create' | 'edit'; values: CompanyFormValues; onChange: (v: CompanyFormValues) => void; meta: CompanyMeta | undefined; errors: FormErrors; excludeIdx?: number; original?: CompanyFormValues; disabled?: boolean; onAvailability?: (blocked: boolean) => void }

/** Shared 등록/수정 form (PHP company_write.php). Phones are single inputs with auto-hyphen; 사업자번호/사업주 ID lock after creation. */
export function CompanyForm({ mode, values: v, onChange, meta, errors, excludeIdx, original, disabled, onAvailability }: CompanyFormProps) {
  const f = adm.companies.form;
  const { toast } = useToast();
  const set = (patch: Partial<CompanyFormValues>) => onChange({ ...v, ...patch });
  const codeA = useAvailability('CompanyCode', v.CompanyCode, { enabled: mode === 'create' });
  const idA = useAvailability('CompanyID', v.CompanyID, { enabled: mode === 'create' });
  const hpA = useAvailability('HomePage', v.HomePage, { enabled: true, excludeIdx, skipValue: original?.HomePage });
  const blocked = [codeA, idA, hpA].some((s) => s.status === 'taken' || s.status === 'invalid' || s.status === 'checking');
  const blockedRef = useRef(blocked);
  useEffect(() => { if (blockedRef.current !== blocked) { blockedRef.current = blocked; onAvailability?.(blocked); } }, [blocked, onAvailability]);

  const [salesFilter, setSalesFilter] = useState('');
  const salesOptions = useMemo(() => {
    const all = meta?.salesManagers ?? [];
    const q = salesFilter.trim().toLowerCase();
    const list = (q ? all.filter((s) => `${s.name ?? ''} ${s.id} ${s.team ?? ''} ${s.deptName ?? ''}`.toLowerCase().includes(q)) : all).map((s) => ({ value: s.id, label: `${s.name ?? s.id} | ${s.id} | ${s.team ?? s.deptName ?? tr('소속정보 없음', 'no team')}${s.mobile ? ` | ${s.mobile}` : ''}` }));
    if (v.SalesManager && !list.some((o) => o.value === v.SalesManager)) list.unshift({ value: v.SalesManager, label: `${v.SalesManager} (${tr('현재 값', 'current value')}${all.some((s) => s.id === v.SalesManager) ? '' : tr(' · 활성 영업담당자 아님', ' · not an active sales rep')})` });
    return list;
  }, [meta, salesFilter, v.SalesManager]);
  const findZip = async () => {
    try { const r = await openPostcode(); if (r) set({ Zipcode: r.zonecode, Address01: r.address, Address02: r.buildingName || v.Address02 }); }
    catch { toast(f.postcodeFailed, { tone: 'danger' }); }
  };
  const phone = (k: 'Tel' | 'Tel2' | 'Fax' | 'Fax2' | 'EduManagerPhone', id: string, label: string) => (
    <FieldRow label={label} htmlFor={id} error={errors[k]}><AInput id={id} value={v[k]} inputMode="tel" onChange={(e) => set({ [k]: e.target.value.replace(/[^0-9+\-\s()]/g, '') } as Partial<CompanyFormValues>)} onBlur={(e) => set({ [k]: autoHyphen(e.target.value.trim()) } as Partial<CompanyFormValues>)} maxLength={50} disabled={disabled} /></FieldRow>
  );
  const sec = (t: string) => <h3 style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 4px', color: 'var(--c-muted)' }}>{t}</h3>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sec(f.sections.basic)}
      <FieldRow label={f.scale} htmlFor="cf-scale"><ASelect id="cf-scale" value={v.CompanyScale} onChange={(e) => set({ CompanyScale: e.target.value })} options={meta?.scales ?? [{ value: 'C', label: '우선지원대상' }, { value: 'A', label: '대규모 1000인 이상' }, { value: 'B', label: '대규모 1000인 미만' }]} disabled={disabled} /></FieldRow>
      <FieldRow label={f.name} htmlFor="cf-name" required error={errors.CompanyName}><AInput id="cf-name" value={v.CompanyName} onChange={(e) => set({ CompanyName: e.target.value })} maxLength={150} invalid={!!errors.CompanyName} disabled={disabled} /></FieldRow>
      {mode === 'create' ? (
        <>
          <FieldRow label={f.code} htmlFor="cf-code" required help={f.codeHelp} error={errors.CompanyCode}><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><AInput id="cf-code" value={v.CompanyCode} onChange={(e) => set({ CompanyCode: e.target.value })} maxLength={20} invalid={!!errors.CompanyCode || codeA.status === 'taken'} disabled={disabled} autoComplete="off" /><Avail s={codeA} /></div></FieldRow>
          <FieldRow label={f.companyId} htmlFor="cf-id" help={f.companyIdHelp} error={errors.CompanyID}><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><AInput id="cf-id" value={v.CompanyID} onChange={(e) => set({ CompanyID: e.target.value })} maxLength={50} invalid={!!errors.CompanyID || idA.status === 'taken'} disabled={disabled} autoComplete="off" /><Avail s={idA} /></div></FieldRow>
        </>
      ) : (
        <FieldRow label={`${f.code} · ${f.companyId}`}><div style={{ fontSize: 13, paddingTop: 8 }}><b className="mono">{v.CompanyCode}</b> · <span className="mono">{v.CompanyID || '—'}</span></div></FieldRow>
      )}
      <FieldRow label={f.hrd} htmlFor="cf-hrd"><AInput id="cf-hrd" value={v.HRD} onChange={(e) => set({ HRD: e.target.value })} maxLength={100} disabled={disabled} /></FieldRow>
      <FieldRow label={f.ceo} htmlFor="cf-ceo"><AInput id="cf-ceo" value={v.Ceo} onChange={(e) => set({ Ceo: e.target.value })} maxLength={100} disabled={disabled} /></FieldRow>
      <FieldRow label={`${f.uptae} / ${f.upjong}`}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><AInput aria-label={f.uptae} placeholder={f.uptae} value={v.Uptae} onChange={(e) => set({ Uptae: e.target.value })} maxLength={100} disabled={disabled} /><AInput aria-label={f.upjong} placeholder={f.upjong} value={v.Upjong} onChange={(e) => set({ Upjong: e.target.value })} maxLength={100} disabled={disabled} /></div></FieldRow>

      {sec(f.sections.contact)}
      {phone('Tel', 'cf-tel', f.tel)}
      <FieldRow label={f.tel2} htmlFor="cf-tel2"><div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><AInput id="cf-tel2" style={{ flex: '1 1 160px' }} value={v.Tel2} inputMode="tel" onChange={(e) => set({ Tel2: e.target.value.replace(/[^0-9+\-\s()]/g, '') })} onBlur={(e) => set({ Tel2: autoHyphen(e.target.value.trim()) })} maxLength={50} disabled={disabled} /><ACheckbox label={f.csEnabled} checked={v.CSEnabled} onChange={(e) => set({ CSEnabled: e.target.checked })} disabled={disabled} /></div></FieldRow>
      {phone('Fax', 'cf-fax', f.fax)}
      {phone('Fax2', 'cf-fax2', f.fax2)}
      <FieldRow label={f.zipcode} htmlFor="cf-zip"><div style={{ display: 'flex', gap: 8 }}><AInput id="cf-zip" style={{ width: 120 }} value={v.Zipcode} onChange={(e) => set({ Zipcode: e.target.value })} maxLength={10} disabled={disabled} /><AButton onClick={() => void findZip()} disabled={disabled}>{f.findZip}</AButton></div></FieldRow>
      <FieldRow label={f.address01} htmlFor="cf-addr1"><AInput id="cf-addr1" value={v.Address01} onChange={(e) => set({ Address01: e.target.value })} maxLength={250} disabled={disabled} /></FieldRow>
      <FieldRow label={f.address02} htmlFor="cf-addr2"><AInput id="cf-addr2" value={v.Address02} onChange={(e) => set({ Address02: e.target.value })} maxLength={250} disabled={disabled} /></FieldRow>
      <FieldRow label={f.email} htmlFor="cf-email" error={errors.Email}><AInput id="cf-email" type="email" value={v.Email} onChange={(e) => set({ Email: e.target.value })} maxLength={250} invalid={!!errors.Email} disabled={disabled} /></FieldRow>
      <FieldRow label={`${f.bank} / ${f.bankNumber}`}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><AInput aria-label={f.bank} list="cf-banks" placeholder={f.bank} value={v.BankName} onChange={(e) => set({ BankName: e.target.value })} maxLength={50} disabled={disabled} /><datalist id="cf-banks">{(meta?.banks ?? []).map((b) => <option key={b} value={b} />)}</datalist><AInput aria-label={f.bankNumber} placeholder={f.bankNumber} value={v.BankNumber} onChange={(e) => set({ BankNumber: e.target.value })} maxLength={50} disabled={disabled} /></div></FieldRow>

      {sec(f.sections.ops)}
      <FieldRow label={f.manageCode} htmlFor="cf-hp" error={errors.HomePage}><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><AInput id="cf-hp" value={v.HomePage} onChange={(e) => set({ HomePage: e.target.value })} maxLength={100} invalid={!!errors.HomePage || hpA.status === 'taken'} disabled={disabled} autoComplete="off" /><Avail s={hpA} /></div></FieldRow>
      <FieldRow label={f.cyberUrl} htmlFor="cf-cyber"><div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><AInput id="cf-cyber" style={{ flex: '1 1 200px' }} value={v.CyberURL} onChange={(e) => set({ CyberURL: e.target.value })} maxLength={100} disabled={disabled} /><ACheckbox label={f.cyberEnabled} checked={v.CyberEnabled} onChange={(e) => set({ CyberEnabled: e.target.checked })} disabled={disabled} /></div></FieldRow>
      <FieldRow label={f.eduManager} htmlFor="cf-edu"><AInput id="cf-edu" value={v.EduManager} onChange={(e) => set({ EduManager: e.target.value })} maxLength={50} disabled={disabled} /></FieldRow>
      {phone('EduManagerPhone', 'cf-edu-phone', f.eduPhone)}
      <FieldRow label={f.eduEmail} htmlFor="cf-edu-email"><AInput id="cf-edu-email" type="email" value={v.EduManagerEmail} onChange={(e) => set({ EduManagerEmail: e.target.value })} maxLength={50} disabled={disabled} /></FieldRow>
      <FieldRow label={f.salesManager} htmlFor="cf-sales" required error={errors.SalesManager}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AInput aria-label={f.salesFilter} placeholder={f.salesFilter} value={salesFilter} onChange={(e) => setSalesFilter(e.target.value)} disabled={disabled} />
          <ASelect id="cf-sales" value={v.SalesManager} onChange={(e) => set({ SalesManager: e.target.value })} options={salesOptions} placeholder={`${f.salesPick} (${salesOptions.length})`} invalid={!!errors.SalesManager} disabled={disabled} />
        </div>
      </FieldRow>
      <FieldRow label={f.sendSMS}><ASelect aria-label={f.sendSMS} value={v.SendSMS ? 'Y' : 'N'} onChange={(e) => set({ SendSMS: e.target.value === 'Y' })} options={meta?.sendSMS ?? [{ value: 'Y', label: '수신허용' }, { value: 'N', label: '수신거부' }]} disabled={disabled} /></FieldRow>
      <FieldRow label={f.remark} htmlFor="cf-remark"><ATextarea id="cf-remark" rows={3} value={v.Remark} onChange={(e) => set({ Remark: e.target.value })} maxLength={2000} disabled={disabled} /></FieldRow>
    </div>
  );
}
