import bahttext = require('bahttext');
import * as XlsxPopulateNs from 'xlsx-populate';
import { CompanySetting } from '../company/company.entity';
import { TaxInvoice } from '../tax-invoices/tax-invoice.entity';
import {
  GenerateReceiptDto,
  PaymentMethodDto,
} from './dto/generate-receipt.dto';

const XlsxPopulate: any = XlsxPopulateNs;

const RECEIPT_SHEETS = [
  'ใบเสร็จรับเงิน Original',
  'ใบเสร็จรับเงิน Copy',
  'ใบเสร็จรับเงิน Copy Acc',
];
// NOTE the trailing space in "Copy Acc) " — that's how the template names it
const TAX_INVOICE_SHEETS = [
  'ใบกำกับภาษี (Original)',
  'ใบกำกับภาษี (Copy)',
  'ใบกำกับภาษี (Copy Acc) ',
];
const ITEM_ROW_START = 16;
const ITEM_ROW_END = 27;
export const MAX_ITEMS = ITEM_ROW_END - ITEM_ROW_START + 1;
const AMOUNT_COL_WIDTH = 18;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

interface ComputedTotals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  vat: number;
  total: number;
  totalText: string;
}

function computeTotals(data: GenerateReceiptDto): ComputedTotals {
  const subtotal = data.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const discount = data.discount ?? 0;
  const afterDiscount = round2(subtotal - discount);
  const vat = round2(afterDiscount * 0.07);
  const total = round2(afterDiscount + vat);
  return {
    subtotal: round2(subtotal),
    discount,
    afterDiscount,
    vat,
    total,
    totalText: `(${bahttext(total)})`,
  };
}

function buildPaymentLines(p?: PaymentMethodDto) {
  const lines = {
    I9: 'เงินสด',
    I10: 'โอนเงิน .......................................... วันที่..................',
    I11: 'เช็คเลขที่ ........................วันที่......................',
  };
  if (!p) return lines;
  if (p.type === 'cash') {
    lines.I9 = '☑ เงินสด';
  } else if (p.type === 'transfer') {
    lines.I10 = `☑ โอนเงิน ${p.bankName ?? ''} วันที่ ${p.transferDate ?? ''}`;
  } else if (p.type === 'cheque') {
    lines.I11 = `☑ เช็คเลขที่ ${p.chequeNo ?? ''} วันที่ ${p.chequeDate ?? ''}`;
  }
  return lines;
}

function fillReceiptSheet(
  ws: any,
  data: GenerateReceiptDto,
  totals: ComputedTotals,
  company: CompanySetting,
) {
  // company header — sourced from DB (CompanySetting) instead of hardcode
  ws.cell('A1').value(company.nameTh);
  ws.cell('A2').value(company.nameEn ?? '');
  ws.cell('A3').value(company.address);
  ws.cell('A4').value(`TEL. ${company.phone}`);
  ws.cell('A5').value(`เลขประจำตัวผู้เสียภาษี ${company.taxId}`);
  ws.cell('E38').value(`( ${company.authorizerName} )`);

  ws.cell('J5').value(data.docNo);
  ws.cell('J6').value(data.date);

  ws.cell('B8').value(data.customer.name);
  ws.cell('B9').value(data.customer.taxId);
  ws.cell('B10').value(data.customer.addressLine1);
  ws.cell('B11').value(data.customer.addressLine2 ?? '');
  ws.cell('B12').value(data.customer.phone ?? '');

  if (data.refDocNo) ws.cell('J8').value(data.refDocNo);

  const pay = buildPaymentLines(data.paymentMethod);
  ws.cell('I9').value(pay.I9);
  ws.cell('I10').value(pay.I10);
  ws.cell('I11').value(pay.I11);

  // template ships with a legacy hardcoded PO number at A29 — clear it
  ws.cell('A29').value(null);

  // clear all item rows first
  for (let r = ITEM_ROW_START; r <= ITEM_ROW_END; r++) {
    ['A', 'B', 'G', 'K'].forEach((col) => {
      ws.cell(`${col}${r}`).value(null);
    });
  }

  data.items.forEach((item, idx) => {
    const row = ITEM_ROW_START + idx;
    const amount = round2(item.qty * item.unitPrice);
    ws.cell(`A${row}`).value(idx + 1);
    ws.cell(`B${row}`).value(item.name);
    ws.cell(`G${row}`).value(item.qty);
    ws.cell(`K${row}`).value(amount);
  });

  // totals — overwrite formulas with plain values
  ws.cell('K28').value(totals.subtotal);
  ws.cell('K29').value(totals.discount);
  ws.cell('K30').value(totals.afterDiscount);
  ws.cell('K31').value(totals.vat);
  ws.cell('K32').value(totals.total);
  ws.cell('A32').value(totals.totalText);

  // template's K width (13.66) is too narrow for the Angsana 16pt amount cells
  ws.column('K').width(AMOUNT_COL_WIDTH);
}

/**
 * Fill the receipt template and return the resulting xlsx as a Buffer.
 *
 * - Fills all 3 receipt sheets (Original / Copy / Copy Acc) with the same data.
 * - Removes every other sheet (ใบกำกับภาษี, ใบลดหนี้, ใบเพิ่มหนี้, ใบวางบิล).
 * - Preserves drawings/text boxes ("ใบเสร็จรับเงิน Original / RECEIPT" corner box).
 */
export async function fillReceiptTemplate(
  templatePath: string,
  data: GenerateReceiptDto,
  company: CompanySetting,
): Promise<Buffer> {
  const wb = await XlsxPopulate.fromFileAsync(templatePath);
  const totals = computeTotals(data);

  for (const name of RECEIPT_SHEETS) {
    const ws = wb.sheet(name);
    if (!ws) {
      throw new Error(`Template missing sheet "${name}"`);
    }
    fillReceiptSheet(ws, data, totals, company);
  }

  for (const sheet of wb.sheets()) {
    if (!RECEIPT_SHEETS.includes(sheet.name())) {
      wb.deleteSheet(sheet);
    }
  }
  wb.activeSheet(RECEIPT_SHEETS[0]);

  return (await wb.outputAsync()) as Buffer;
}

// ---------- Tax Invoice (ใบกำกับภาษี) ----------

function formatDateThai(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function splitAddress(address: string | null | undefined): {
  line1: string;
  line2: string;
} {
  if (!address) return { line1: '', line2: '' };
  const lines = address.split(/\r?\n/);
  return { line1: lines[0] ?? '', line2: lines.slice(1).join(' ') };
}

function fillTaxInvoiceSheet(ws: any, inv: TaxInvoice, company: CompanySetting) {
  // company header
  ws.cell('A1').value(company.nameTh);
  ws.cell('A2').value(company.nameEn ?? '');
  ws.cell('A3').value(company.address);
  ws.cell('A4').value(`TEL. ${company.phone}`);
  ws.cell('A5').value(`เลขประจำตัวผู้เสียภาษี ${company.taxId}`);
  ws.cell('E38').value(`( ${company.authorizerName} )`);

  // doc info
  ws.cell('J5').value(inv.docNo);
  ws.cell('J6').value(formatDateThai(inv.date));

  // customer
  const addr = splitAddress(inv.customer?.address);
  ws.cell('B8').value(inv.customer?.name ?? '');
  ws.cell('B9').value(inv.customer?.taxId ?? '');
  ws.cell('B10').value(addr.line1);
  ws.cell('B11').value(addr.line2);
  ws.cell('B12').value(inv.customer?.phone ?? '');

  // ref/quotation no
  ws.cell('J8').value(inv.refDocNo ?? '');

  // payment terms + due date
  ws.cell('I9').value(inv.paymentTerms ?? '');
  ws.cell('I10').value(inv.dueDate ? formatDateThai(inv.dueDate) : '');

  // PO number — A29 doubles as cancellation marker; we re-purpose for PO no
  ws.cell('A29').value(inv.cancelled ? `ยกเลิก ${inv.docNo}` : inv.poNumber ?? '');

  // clear all item rows
  for (let r = ITEM_ROW_START; r <= ITEM_ROW_END; r++) {
    ['A', 'B', 'C', 'G', 'I', 'J', 'K'].forEach((col) =>
      ws.cell(`${col}${r}`).value(null),
    );
  }

  // items: A=NO, B=code, C=name, G=qty, I=unitPrice, K=amount
  const items = inv.items ?? [];
  items.forEach((item, idx) => {
    const row = ITEM_ROW_START + idx;
    ws.cell(`A${row}`).value(idx + 1);
    if (item.code) ws.cell(`B${row}`).value(item.code);
    ws.cell(`C${row}`).value(item.name);
    ws.cell(`G${row}`).value(Number(item.qty));
    ws.cell(`I${row}`).value(Number(item.unitPrice));
    ws.cell(`K${row}`).value(Number(item.amount));
  });

  // totals — fixed at rows 28-32 in the master template
  ws.cell('K28').value(Number(inv.subtotal));
  ws.cell('K29').value(Number(inv.discount));
  ws.cell('K30').value(Number(inv.afterDiscount));
  ws.cell('K31').value(Number(inv.vat));
  ws.cell('K32').value(Number(inv.total));

  const totalText =
    inv.totalText ?? `(${bahttext(Number(inv.total) || 0)})`;
  ws.cell('A32').value(totalText);

  // widen amount column for Angsana 16pt
  ws.column('K').width(AMOUNT_COL_WIDTH);
}

/**
 * Fill the tax-invoice template and return xlsx as Buffer.
 * Produces a workbook with 3 sheets: ใบกำกับภาษี (Original/Copy/Copy Acc).
 */
export async function fillTaxInvoiceTemplate(
  templatePath: string,
  inv: TaxInvoice,
  company: CompanySetting,
): Promise<Buffer> {
  const wb = await XlsxPopulate.fromFileAsync(templatePath);
  const items = inv.items ?? [];
  if (items.length > MAX_ITEMS) {
    throw new Error(
      `Tax invoice has ${items.length} items but template supports max ${MAX_ITEMS}`,
    );
  }

  for (const name of TAX_INVOICE_SHEETS) {
    const ws = wb.sheet(name);
    if (!ws) throw new Error(`Template missing sheet "${name}"`);
    fillTaxInvoiceSheet(ws, inv, company);
  }

  for (const sheet of wb.sheets()) {
    if (!TAX_INVOICE_SHEETS.includes(sheet.name())) {
      wb.deleteSheet(sheet);
    }
  }
  wb.activeSheet(TAX_INVOICE_SHEETS[0]);

  return (await wb.outputAsync()) as Buffer;
}
