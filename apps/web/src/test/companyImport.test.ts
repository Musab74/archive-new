import { describe, expect, it } from 'vitest';
import { buildTemplateCsv, IMPORT_KEYS, mapImportRows, parseDelimited, scaleToCode } from '../features/admin/pages/companies/companyImport';
import { autoHyphen } from '../features/admin/pages/companies/postcode';
import { diffPatchBody, emptyValues, fromCompany, toCreateBody, validateCompanyForm } from '../features/admin/pages/companies/CompanyForm';

describe('parseDelimited', () => {
  it('reads Excel clipboard TSV with quoted multi-line cells and a BOM', () => {
    const rows = parseDelimited('﻿회사명\t사업자등록번호\t메모\r\n(주)예시\t1234567890\t"줄1\n줄2"\r\n\r\n');
    expect(rows).toEqual([['회사명', '사업자등록번호', '메모'], ['(주)예시', '1234567890', '줄1\n줄2']]);
  });
  it('reads CSV with escaped quotes and commas', () => {
    expect(parseDelimited('a,"b, c","say ""hi"""\n1,2,3')).toEqual([['a', 'b, c', 'say "hi"'], ['1', '2', '3']]);
  });
  it('empty input → no rows', () => { expect(parseDelimited('   \n')).toEqual([]); });
});

describe('mapImportRows', () => {
  it('maps a Korean header row (legacy template labels, loose spacing) and converts the scale label', () => {
    const m = mapImportRows([['회사명', '사업주 아이디', '회사 규모', '사업자등록번호', '영업담당자 ID', '기업관리코드', '이상한열'], ['(주)예시', 'ex01', '우선지원대상', '123-45-67890', 'B032', 'ex01', 'x']]);
    expect(m.headerDetected).toBe(true);
    expect(m.unknownHeaders).toEqual(['이상한열']);
    expect(m.rows[0]).toMatchObject({ CompanyName: '(주)예시', CompanyID: 'ex01', CompanyScale: 'C', CompanyCode: '123-45-67890', SalesManager: 'B032', HomePage: 'ex01', Ceo: null });
  });
  it('falls back to the A..W template order when there is no header', () => {
    const cells = Array.from({ length: IMPORT_KEYS.length }, (_, i) => `v${i}`);
    cells[2] = 'A';
    const m = mapImportRows([cells]);
    expect(m.headerDetected).toBe(false);
    expect(m.rows[0]).toMatchObject({ CompanyName: 'v0', CompanyID: 'v1', CompanyScale: 'A', CompanyCode: 'v3', HomePage: 'v22' });
  });
  it('scaleToCode accepts labels and codes', () => {
    expect(scaleToCode('대규모 1000인 이상')).toBe('A');
    expect(scaleToCode('c')).toBe('C');
    expect(scaleToCode('')).toBeNull();
  });
  it('template CSV has one label per import key and a BOM', () => {
    const t = buildTemplateCsv(true);
    expect(t.startsWith('﻿회사명,')).toBe(true);
    expect(t.split('\r\n')[0]!.replace('﻿', '').split(',')).toHaveLength(IMPORT_KEYS.length);
    expect(t.split('\r\n').filter(Boolean)).toHaveLength(2);
  });
});

describe('CompanyForm helpers', () => {
  it('autoHyphen formats plain digit strings only', () => {
    expect(autoHyphen('0212345678')).toBe('02-1234-5678');
    expect(autoHyphen('021234567')).toBe('02-123-4567');
    expect(autoHyphen('01012345678')).toBe('010-1234-5678');
    expect(autoHyphen('0311234567')).toBe('031-123-4567');
    expect(autoHyphen('010-1234-5678')).toBe('010-1234-5678');
    expect(autoHyphen('abc')).toBe('abc');
  });
  it('validateCompanyForm: required fields and formats', () => {
    const e = validateCompanyForm(emptyValues(), 'create');
    expect(Object.keys(e).sort()).toEqual(['CompanyCode', 'CompanyID', 'CompanyName', 'SalesManager']); // company_write.php: 사업주 아이디 is required on create
    const ok = { ...emptyValues(), CompanyName: 'A', CompanyCode: '123-45-67890', CompanyID: 'abcd01', SalesManager: 'B032', Email: 'bad' };
    expect(validateCompanyForm(ok, 'create')).toEqual({ Email: '이메일 형식을 확인하세요.' });
    expect(validateCompanyForm({ ...ok, Email: '', HomePage: '한글' }, 'edit')).toEqual({ HomePage: '영문/숫자/_/- 2~50자' });
  });
  it('toCreateBody sends nulls for blanks and Y/N flags; diffPatchBody sends only changes and never the fixed codes', () => {
    const v = { ...emptyValues(), CompanyName: 'A', CompanyCode: '1234567890', SalesManager: 'B032', Tel: '', CSEnabled: true };
    const body = toCreateBody(v);
    expect(body).toMatchObject({ CompanyName: 'A', CompanyCode: '1234567890', CompanyID: null, Tel: null, CSEnabled: 'Y', CyberEnabled: 'N', SendSMS: 'Y', CompanyScale: 'C' });
    const base = fromCompany({ idx: 1, companyCode: '1234567890', bizNo: '123-45-67890', companyName: 'A', scale: 'C', scaleLabel: '우선지원대상', companyId: 'a1', hrd: null, ceo: null, uptae: null, upjong: null, zipcode: null, address01: null, address02: null, tel: '02-1', tel2: null, csEnabled: false, fax: null, fax2: null, email: null, bankName: null, bankNumber: null, manageCode: 'a1', cyberUrl: null, cyberEnabled: false, eduManager: null, eduManagerPhone: null, eduManagerEmail: null, salesManager: 'B032', remark: null, sendSMS: 'Y', sendSMSLabel: '수신허용', regDate: null });
    const cur = { ...base, CompanyCode: 'changed', CompanyID: 'changed', Tel: '', Ceo: '대표', SendSMS: false };
    expect(diffPatchBody(base, cur)).toEqual({ Tel: null, Ceo: '대표', SendSMS: 'N' });
  });
});
