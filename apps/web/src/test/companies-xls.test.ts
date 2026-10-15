import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeRk, decodeText, readHtmlTable, readSpreadsheet, readXls, sniffSpreadsheet, xlsNumberText } from '../features/admin/pages/companies/xlsRead';
import { sheetRows } from '../features/admin/pages/companies/xlsxRead';
import { IMPORT_KEYS, rowFromHrdTraineeCells, rowsFromTemplateGrid } from '../features/admin/pages/companies/companyImport';
import { importRowBody } from '../features/admin/pages/companies/companiesApi';

const dir = resolve(__dirname, '../features/admin/pages/companies');
/**
 * company-legacy.xls was written by the legacy PHPExcel 1.8 (Excel5 writer, BIFF8) — the library company_excel_upload.php reads with.
 * Expected values below are what PHPExcel's own Excel5 reader returns for it (setReadDataOnly + getValue()), except formulas,
 * where the cached result is used as the .xlsx reader does.
 */
const legacy = () => new Uint8Array(readFileSync(resolve(dir, 'company-legacy.xls')));

describe('legacy .xls (BIFF8) reader — company_write_excel.php accepted .xls through PHPExcel', () => {
  it('sniffs the format from the content like PHPExcel_IOFactory::createReaderForFile', () => {
    expect(sniffSpreadsheet(legacy())).toBe('xls');
    expect(sniffSpreadsheet(new Uint8Array(readFileSync(resolve(dir, 'company-sample.xlsx'))))).toBe('xlsx');
    expect(sniffSpreadsheet(new TextEncoder().encode('<html><body><table><tr><td>a</td></tr></table></body></html>'))).toBe('html');
    expect(sniffSpreadsheet(new TextEncoder().encode('회사명,사업자등록번호\r\n'))).toBe('text');
  });

  it('reads sheet names and the template sheet: row 2, columns A..W → the import row', async () => {
    const book = readXls(legacy());
    expect(book.sheetNames).toEqual(['사업주정보', '훈련생', '긴목록']);
    const sheet = (await book.sheet(0))!;
    expect(sheet.cells.get('A1')).toBe('회사명(*)');
    expect(sheet.cells.get('W1')).toBe('기업관리코드');
    const m = rowsFromTemplateGrid(sheetRows(sheet, 2, IMPORT_KEYS.length));
    expect(m.rows).toHaveLength(2);
    expect(m.rows[0]).toMatchObject({
      CompanyName: '(주)엑셀구버전', CompanyID: 'xlsold01', CompanyScale: 'C', CompanyCode: '1234567890', HRD: 'HRD-77', Ceo: '김대표', Zipcode: '6236', Address01: '서울특별시 강남구 테헤란로 1', Address02: '2층 "회의실"',
      Tel: '02-123-4567', EduManagerPhone: '010-1234-5678', SalesManager: 'B032119', Remark: '메모\n둘째 줄', CyberEnabled: 'Y', Tel2: '02-555-6666', Fax2: '02-555-7777', CSEnabled: 'N', HomePage: 'xlsold01',
    });
    // row 3: no 회사명 (null → sent as '' so the API paints the row red), numbers as RK/NUMBER records, a string formula's cached value
    expect(m.rows[1]).toMatchObject({ CompanyName: null, CompanyCode: '2234567890', HRD: '12.5', Ceo: '공식값', Zipcode: '6236', Upjong: '-42', Tel: '123456789012' });
    expect(importRowBody(m.rows[1]!)).toMatchObject({ CompanyName: '', CompanyCode: '2234567890', Address01: null });
  });

  it('"HRD 훈련생 등록": the second sheet cell map', async () => {
    const sheet = (await readXls(legacy()).sheet(1))!;
    expect(rowFromHrdTraineeCells((r) => sheet.cells.get(r)).rows[0]).toMatchObject({ CompanyName: '(주)훈련구버전', CompanyCode: '3456789012', Ceo: '박대표', SalesManager: 'B032119', EduManagerEmail: 'hrd@example.com' });
  });

  it('shared strings spanning CONTINUE records (300 Korean strings + one 3,000-character cell) decode intact', async () => {
    const sheet = (await (await readSpreadsheet(legacy())).sheet(2))!;
    expect(sheet.maxRow).toBe(300);
    for (const i of [1, 77, 150, 299, 300]) expect(sheet.cells.get(`A${i}`)).toBe(`한글 문자열 번호 ${String(i).padStart(4, '0')} 가나다라마바사아자차카타파하`);
    expect(sheet.cells.get('B1')).toBe('가'.repeat(3000));
    expect(await readXls(legacy()).sheet(3)).toBeNull();
  });

  it('RK / number text and corrupt input', () => {
    expect(decodeRk((1234 << 2) | 2)).toBe(1234);
    expect(decodeRk((1250 << 2) | 3)).toBe(12.5);
    expect(decodeRk(((-42 << 2) | 2) >>> 0)).toBe(-42);
    expect(decodeRk(0x3ff00000)).toBe(1); // high 30 bits of 1.0
    expect(xlsNumberText(1234567890)).toBe('1234567890');
    expect(xlsNumberText(0.1 + 0.2)).toBe('0.3');
    const broken = legacy().slice(0, 1024);
    expect(() => readXls(broken)).toThrow();
  });
});

describe('HTML-table ".xls" (PHPExcel_Reader_HTML) and text decoding', () => {
  it('rows/cells with colspan and rowspan, one sheet', async () => {
    const html = '<html><head><meta charset="utf-8"></head><body><table><tr><th>회사명</th><th colspan="2">사업자등록번호</th></tr><tr><td rowspan="2">(주)HTML</td><td>1234567890</td><td>x</td></tr><tr><td>둘째</td></tr></table></body></html>';
    const book = await readSpreadsheet(new TextEncoder().encode(html));
    const sheet = (await book.sheet(0))!;
    expect(Object.fromEntries(sheet.cells)).toEqual({ A1: '회사명', B1: '사업자등록번호', A2: '(주)HTML', B2: '1234567890', C2: 'x', B3: '둘째' });
    expect(await book.sheet(1)).toBeNull();
    expect(readHtmlTable('<table></table>').sheetNames).toEqual(['Sheet1']);
  });
  it('decodeText: UTF-8 (BOM stripped), declared charset, EUC-KR fallback', () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('회사')]))).toBe('회사');
    const euc = new Uint8Array([0xc8, 0xb8, 0xbb, 0xe7]); // "회사" in EUC-KR
    expect(decodeText(euc)).toBe('회사');
    expect(decodeText(new Uint8Array([...new TextEncoder().encode('<meta charset="euc-kr">'), ...euc]))).toBe('<meta charset="euc-kr">회사');
  });
});
