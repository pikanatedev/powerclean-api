/**
 * POC: fill Excel template (preserving drawings/shapes) + convert to PDF via LibreOffice.
 *
 * Output: 3 PDFs per receipt — Original / Copy / Copy Acc
 *
 * Usage:
 *   npm install
 *   npm run generate            # uses sample-data.json
 *   npm run generate sample-data.json
 *
 * Requires LibreOffice (host or Docker image cms-libreoffice:latest).
 */
import XlsxPopulate from 'xlsx-populate';
import bahttext = require('bahttext');
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';

// Receipt sheets we keep in the output workbook. All other sheets in the
// template (ใบกำกับภาษี, ใบลดหนี้, ใบเพิ่มหนี้, ใบวางบิล, ...) are removed.
const RECEIPT_SHEETS = [
  'ใบเสร็จรับเงิน Original',
  'ใบเสร็จรับเงิน Copy',
  'ใบเสร็จรับเงิน Copy Acc',
];
const ITEM_ROW_START = 16;
const ITEM_ROW_END = 27;
const MAX_ITEMS = ITEM_ROW_END - ITEM_ROW_START + 1;

// Company header (fixed for now — later move to CompanySetting entity)
const COMPANY = {
  nameTh: 'บริษัท เพาเวอร์ คลีน พลัส จำกัด สำนักงานใหญ่',
  nameEn: 'POWER CLEAN PLUS Co., LTD.',
  address: 'เลขที่ 250/65 ม.5 ต.เมืองเก่า อ.เมืองขอนแก่น จ.ขอนแก่น 40000',
  phone: 'TEL. 061-6956633 , 062-7969847',
  taxId: 'เลขประจำตัวผู้เสียภาษี 0405562003569',
};
const AUTHORIZER = '( นายสันติ เหล่าสุโพธิ์ )';

interface PaymentMethod {
  type: 'cash' | 'transfer' | 'cheque';
  bankName?: string;
  transferDate?: string;
  chequeNo?: string;
  chequeDate?: string;
}

interface ReceiptData {
  docNo: string;
  date: string;
  refDocNo?: string;
  paymentMethod?: PaymentMethod;
  customer: {
    name: string;
    taxId: string;
    addressLine1: string;
    addressLine2?: string;
    phone?: string;
  };
  items: Array<{
    code?: string;
    name: string;
    qty: number;
    unitPrice: number;
  }>;
  discount?: number;
}

interface ComputedTotals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  vat: number;
  total: number;
  totalText: string;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeTotals(data: ReceiptData): ComputedTotals {
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

function buildPaymentLines(p?: PaymentMethod) {
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

/**
 * Fill the *receipt* sheet (B=name, G=qty, K=amount layout — no code/unit-price col).
 */
function fillReceiptSheet(ws: any, data: ReceiptData, totals: ComputedTotals) {
  // company header — overwrite formulas pointing to other sheets
  ws.cell('A1').value(COMPANY.nameTh);
  ws.cell('A2').value(COMPANY.nameEn);
  ws.cell('A3').value(COMPANY.address);
  ws.cell('A4').value(COMPANY.phone);
  ws.cell('A5').value(COMPANY.taxId);
  ws.cell('E38').value(AUTHORIZER);

  // doc info
  ws.cell('J5').value(data.docNo);
  ws.cell('J6').value(data.date);

  // customer
  ws.cell('B8').value(data.customer.name);
  ws.cell('B9').value(data.customer.taxId);
  ws.cell('B10').value(data.customer.addressLine1);
  ws.cell('B11').value(data.customer.addressLine2 ?? '');
  ws.cell('B12').value(data.customer.phone ?? '');

  if (data.refDocNo) ws.cell('J8').value(data.refDocNo);

  // payment lines
  const pay = buildPaymentLines(data.paymentMethod);
  ws.cell('I9').value(pay.I9);
  ws.cell('I10').value(pay.I10);
  ws.cell('I11').value(pay.I11);

  // clear legacy hardcoded value in template (A29 = "02PO26050011")
  ws.cell('A29').value(null);

  // clear all item rows before filling
  for (let r = ITEM_ROW_START; r <= ITEM_ROW_END; r++) {
    ['A', 'B', 'G', 'K'].forEach((col) => {
      ws.cell(`${col}${r}`).value(null);
    });
  }

  // items
  data.items.forEach((item, idx) => {
    const row = ITEM_ROW_START + idx;
    const amount = round2(item.qty * item.unitPrice);
    ws.cell(`A${row}`).value(idx + 1);
    ws.cell(`B${row}`).value(item.name);
    ws.cell(`G${row}`).value(item.qty);
    ws.cell(`K${row}`).value(amount);
  });

  // totals — overwrite formulas with plain values (including K28 SUM, K30-K32
  // arithmetic, and the BAHTTEXT A32 cell)
  ws.cell('K28').value(totals.subtotal);
  ws.cell('K29').value(totals.discount);
  ws.cell('K30').value(totals.afterDiscount);
  ws.cell('K31').value(totals.vat);
  ws.cell('K32').value(totals.total);

  // Thai amount text
  ws.cell('A32').value(totals.totalText);

  // Widen amount column — template's 13.66 chars at Angsana 16pt isn't enough
  // for "43,380.00" / "46,416.60" → LibreOffice falls back to ###.
  ws.column('K').width(18);
}

/**
 * Build a single xlsx workbook containing 3 receipt sheets
 * (Original / Copy / Copy Acc), each filled with the same data.
 * All other sheets from the template (ใบกำกับภาษี, ใบลดหนี้, ฯลฯ) are removed.
 */
async function generateWorkbook(
  templatePath: string,
  outputPath: string,
  data: ReceiptData,
  totals: ComputedTotals,
): Promise<void> {
  const wb = await (XlsxPopulate as any).fromFileAsync(templatePath);

  // 1. fill every receipt sheet
  for (const name of RECEIPT_SHEETS) {
    const ws = wb.sheet(name);
    if (!ws) throw new Error(`Sheet "${name}" not found in template`);
    fillReceiptSheet(ws, data, totals);
  }

  // 2. delete every sheet that's NOT a receipt sheet
  for (const sheet of wb.sheets()) {
    if (!RECEIPT_SHEETS.includes(sheet.name())) {
      wb.deleteSheet(sheet);
    }
  }

  // 3. make Original the first/active sheet so it opens to that view
  wb.activeSheet(RECEIPT_SHEETS[0]);

  await wb.toFileAsync(outputPath);
}

// ----- LibreOffice converter (host soffice with Docker fallback) -----

type ConverterMode =
  | { kind: 'host'; bin: string }
  | { kind: 'docker'; image: string };

function which(bin: string): string | null {
  try {
    const { execSync } = require('child_process');
    const out = execSync(`command -v ${bin}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

function detectConverter(): ConverterMode {
  if (process.env.SOFFICE_BIN && existsSync(process.env.SOFFICE_BIN)) {
    return { kind: 'host', bin: process.env.SOFFICE_BIN };
  }
  if (process.platform === 'darwin') {
    const mac = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    if (existsSync(mac)) return { kind: 'host', bin: mac };
  }
  const found = which('soffice');
  if (found) return { kind: 'host', bin: found };

  const image = process.env.LIBREOFFICE_IMAGE ?? 'cms-libreoffice:latest';
  if (which('docker')) return { kind: 'docker', image };

  throw new Error(
    'No LibreOffice converter available. Install LibreOffice on host ' +
      '(brew install --cask libreoffice) or build the Docker image ' +
      '(npm run docker:build).',
  );
}

function runProcess(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = '';
    let stdout = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        if (stdout.trim()) console.log('  ', stdout.trim());
        resolve();
      } else {
        reject(
          new Error(
            `${cmd} exited ${code}\nstdout: ${stdout}\nstderr: ${stderr}`,
          ),
        );
      }
    });
  });
}

// LibreOffice Calc PDF filter — IsSkipEmptyPages drops the trailing blank page
// caused by a small vertical overflow from row heights.
const PDF_FILTER =
  'pdf:calc_pdf_Export:{"IsSkipEmptyPages":{"type":"boolean","value":"true"}}';

async function convertToPdf(xlsxPath: string, outputDir: string) {
  const conv = detectConverter();
  if (conv.kind === 'host') {
    await runProcess(conv.bin, [
      '--headless',
      '--convert-to',
      PDF_FILTER,
      '--outdir',
      outputDir,
      xlsxPath,
    ]);
  } else {
    const workDir = path.resolve(outputDir);
    const fileName = path.basename(xlsxPath);
    await runProcess('docker', [
      'run',
      '--rm',
      '-v',
      `${workDir}:/work`,
      '--entrypoint',
      'soffice',
      conv.image,
      '--headless',
      '--convert-to',
      PDF_FILTER,
      '--outdir',
      '/work',
      fileName,
    ]);
  }
}

// ----- main -----

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dataPath = path.resolve(args[0] ?? 'sample-data.json');
  const projectRoot = __dirname;
  const templatePath = path.join(projectRoot, 'templates/master.xlsx');
  const outputDir = path.join(projectRoot, 'output');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  if (!existsSync(dataPath)) {
    throw new Error(`Data file not found: ${dataPath}`);
  }

  const data: ReceiptData = JSON.parse(readFileSync(dataPath, 'utf8'));
  if (data.items.length > MAX_ITEMS) {
    throw new Error(
      `Too many items: ${data.items.length} (template max ${MAX_ITEMS})`,
    );
  }
  const totals = computeTotals(data);
  // PDF rendering is on hold — focus is xlsx fidelity. Pass --pdf to opt in.
  const doPdf = process.argv.includes('--pdf');

  console.log(`Template: ${templatePath}`);
  console.log(`Data:     ${dataPath}`);
  console.log(`Output:   ${outputDir}\n`);

  const xlsxPath = path.join(outputDir, `${data.docNo}.xlsx`);
  console.log(`Filling ${RECEIPT_SHEETS.length} sheets in one workbook...`);
  await generateWorkbook(templatePath, xlsxPath, data, totals);
  console.log(`  ✓ ${path.basename(xlsxPath)}`);

  if (doPdf) {
    console.log(`\nConverting to PDF (LibreOffice)...`);
    await convertToPdf(xlsxPath, outputDir);
    console.log(`  ✓ ${path.basename(xlsxPath).replace(/\.xlsx$/, '.pdf')}`);
  } else {
    console.log('\nxlsx only. Pass --pdf to also generate PDF.');
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
