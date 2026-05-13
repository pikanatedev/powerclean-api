/**
 * Bulk-import historical data extracted from xlsx tax invoices.
 *
 *   1. customers.json   → Customer rows (upsert by taxId; fall back to name)
 *   2. products.json    → Product rows  (upsert by code; fall back to name)
 *   3. tax-invoices.json → TaxInvoice + TaxInvoiceItem rows (resolve FKs)
 *
 * Run:  npm run import:historical
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { Customer } from './customers/customer.entity';
import { Product } from './products/product.entity';
import { TaxInvoice } from './tax-invoices/tax-invoice.entity';
import { TaxInvoiceItem } from './tax-invoices/tax-invoice-item.entity';

interface ExtractedCustomer {
  name: string;
  taxId: string | null;
  address: string | null;
  phone: string | null;
}

interface ExtractedProduct {
  code: string | null;
  name: string;
  unitPrice: number | null;
}

interface ExtractedItem {
  no: number;
  code: string | null;
  name: string;
  qty: number;
  unitPrice: number | null;
  amount: number | null;
}

interface ExtractedTaxInvoice {
  sourceFile: string;
  docNo: string;
  date: string | null;
  refDocNo: string | null;
  poNumber: string | null;
  cancelled?: boolean;
  paymentTerms: string | null;
  dueDate: string | null;
  customer: ExtractedCustomer;
  items: ExtractedItem[];
  totals: {
    subtotal: number | null;
    discount: number;
    afterDiscount: number | null;
    vat: number | null;
    total: number | null;
    totalText: string | null;
  };
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

async function run() {
  const dataDir = path.resolve(__dirname, '../../tools/extracted');
  if (!fs.existsSync(dataDir)) {
    throw new Error(`extracted data dir not found: ${dataDir}`);
  }
  const customersData = readJson<ExtractedCustomer[]>(
    path.join(dataDir, 'customers.json'),
  );
  const productsData = readJson<ExtractedProduct[]>(
    path.join(dataDir, 'products.json'),
  );
  const invoicesData = readJson<ExtractedTaxInvoice[]>(
    path.join(dataDir, 'tax-invoices.json'),
  );

  console.log(
    `[import] ${customersData.length} customers, ${productsData.length} products, ` +
      `${invoicesData.length} tax invoices`,
  );

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  // -------- 1. Customers --------
  const customerByTaxId = new Map<string, string>(); // taxId/name → id
  const customerRepo = ds.getRepository(Customer);

  let cCreated = 0,
    cSkipped = 0;
  for (const c of customersData) {
    const key = c.taxId || c.name;
    if (!key) continue;
    // dedupe by taxId first, fall back to name
    let existing = c.taxId
      ? await customerRepo.findOne({ where: { taxId: c.taxId } })
      : null;
    if (!existing) {
      existing = await customerRepo.findOne({ where: { name: c.name } });
    }
    if (existing) {
      customerByTaxId.set(key, existing.id);
      cSkipped++;
      continue;
    }
    const saved = await customerRepo.save(
      customerRepo.create({
        name: c.name,
        taxId: c.taxId ?? null,
        address: c.address ?? null,
        phone: c.phone ?? null,
      }),
    );
    customerByTaxId.set(key, saved.id);
    cCreated++;
  }
  console.log(`[import] customers: ${cCreated} created, ${cSkipped} existed`);

  // -------- 2. Products --------
  const productByKey = new Map<string, string>(); // code|name → id
  const productRepo = ds.getRepository(Product);

  let pCreated = 0,
    pSkipped = 0;
  for (const p of productsData) {
    const code = p.code ?? null;
    let existing: Product | null = null;
    if (code) {
      existing = await productRepo.findOne({ where: { code } });
    }
    if (!existing) {
      existing = await productRepo.findOne({ where: { name: p.name } });
    }
    if (existing) {
      productByKey.set(code ?? p.name, existing.id);
      pSkipped++;
      continue;
    }
    const saved = await productRepo.save(
      productRepo.create({
        code,
        name: p.name,
        unitPrice: p.unitPrice ?? null,
      }),
    );
    productByKey.set(code ?? p.name, saved.id);
    pCreated++;
  }
  console.log(`[import] products: ${pCreated} created, ${pSkipped} existed`);

  // -------- 3. Tax invoices --------
  const invoiceRepo = ds.getRepository(TaxInvoice);
  const itemRepo = ds.getRepository(TaxInvoiceItem);
  let invCreated = 0,
    invSkipped = 0,
    invErrors = 0;

  for (const inv of invoicesData) {
    if (!inv.docNo || !inv.date) {
      console.warn(`  skip (missing docNo/date): ${inv.sourceFile}`);
      invErrors++;
      continue;
    }
    const exists = await invoiceRepo.findOne({ where: { docNo: inv.docNo } });
    if (exists) {
      invSkipped++;
      continue;
    }

    // resolve customer
    const custKey = inv.customer.taxId || inv.customer.name;
    let custId = customerByTaxId.get(custKey);
    if (!custId) {
      // create on the fly
      const created = await customerRepo.save(
        customerRepo.create({
          name: inv.customer.name,
          taxId: inv.customer.taxId ?? null,
          address: inv.customer.address ?? null,
          phone: inv.customer.phone ?? null,
        }),
      );
      custId = created.id;
      customerByTaxId.set(custKey, custId);
    }

    // build items
    const items = inv.items.map((it, idx) => {
      const productId =
        productByKey.get(it.code ?? '') ?? productByKey.get(it.name) ?? null;
      const qty = it.qty ?? 0;
      const unitPrice = it.unitPrice ?? 0;
      const amount = it.amount ?? r2(qty * unitPrice);
      return itemRepo.create({
        no: it.no ?? idx + 1,
        productId,
        code: it.code ?? null,
        name: it.name,
        qty,
        unitPrice,
        amount,
      });
    });

    const subtotal = inv.totals.subtotal ?? 0;
    const discount = inv.totals.discount ?? 0;
    const afterDiscount = inv.totals.afterDiscount ?? r2(subtotal - discount);
    const vat = inv.totals.vat ?? r2(afterDiscount * 0.07);
    const total = inv.totals.total ?? r2(afterDiscount + vat);

    try {
      await invoiceRepo.save(
        invoiceRepo.create({
          docNo: inv.docNo,
          date: inv.date,
          customerId: custId,
          refDocNo: inv.refDocNo ?? null,
          poNumber: inv.poNumber ?? null,
          paymentTerms: inv.paymentTerms ?? null,
          dueDate: inv.dueDate ?? null,
          cancelled: inv.cancelled ?? false,
          subtotal,
          discount,
          afterDiscount,
          vat,
          total,
          totalText: inv.totals.totalText ?? null,
          items,
        }),
      );
      invCreated++;
    } catch (err: any) {
      console.error(`  ! ${inv.docNo}: ${err.message}`);
      invErrors++;
    }
  }
  console.log(
    `[import] tax invoices: ${invCreated} created, ${invSkipped} existed, ${invErrors} errors`,
  );

  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
