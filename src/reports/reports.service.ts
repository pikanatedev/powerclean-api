import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxInvoice } from '../tax-invoices/tax-invoice.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { SalesSummaryDto } from './dto/sales-summary.dto';

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(TaxInvoice)
    private readonly invRepo: Repository<TaxInvoice>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async salesSummary(filter: SalesSummaryDto) {
    const qb = this.invRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'c')
      .leftJoinAndSelect('inv.items', 'item')
      .leftJoinAndSelect('item.product', 'p')
      .where('inv.cancelled = :c', { c: false });

    if (filter.dateFrom) {
      qb.andWhere('inv.date >= :df', { df: filter.dateFrom });
    }
    if (filter.dateTo) {
      qb.andWhere('inv.date <= :dt', { dt: filter.dateTo });
    }

    const invoices = await qb.getMany();

    // ---------- aggregate totals ----------
    let revenue = 0;
    let subtotal = 0;
    let vat = 0;
    let discount = 0;
    for (const inv of invoices) {
      revenue += Number(inv.total);
      subtotal += Number(inv.subtotal);
      vat += Number(inv.vat);
      discount += Number(inv.discount);
    }

    // ---------- by month ----------
    const monthMap = new Map<string, { revenue: number; count: number }>();
    for (const inv of invoices) {
      const month = String(inv.date).substring(0, 7); // YYYY-MM
      const acc = monthMap.get(month) ?? { revenue: 0, count: 0 };
      acc.revenue += Number(inv.total);
      acc.count += 1;
      monthMap.set(month, acc);
    }
    const byMonth = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({
        month,
        revenue: r2(v.revenue),
        count: v.count,
      }));

    // ---------- top customers ----------
    const custMap = new Map<
      string,
      { id: string; name: string; revenue: number; count: number }
    >();
    for (const inv of invoices) {
      if (!inv.customer) continue;
      const key = inv.customer.id;
      const acc = custMap.get(key) ?? {
        id: inv.customer.id,
        name: inv.customer.name,
        revenue: 0,
        count: 0,
      };
      acc.revenue += Number(inv.total);
      acc.count += 1;
      custMap.set(key, acc);
    }
    const topCustomers = Array.from(custMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((c) => ({
        customerId: c.id,
        name: c.name,
        revenue: r2(c.revenue),
        count: c.count,
      }));

    // ---------- top products ----------
    const prodMap = new Map<
      string,
      {
        id: string | null;
        code: string | null;
        name: string;
        qty: number;
        amount: number;
      }
    >();
    for (const inv of invoices) {
      for (const item of inv.items ?? []) {
        const key = item.productId ?? `name:${item.name}`;
        const acc = prodMap.get(key) ?? {
          id: item.productId,
          code: item.code,
          name: item.product?.name ?? item.name,
          qty: 0,
          amount: 0,
        };
        acc.qty += Number(item.qty);
        acc.amount += Number(item.amount);
        prodMap.set(key, acc);
      }
    }
    const topProducts = Array.from(prodMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((p) => ({
        productId: p.id,
        code: p.code,
        name: p.name,
        totalQty: r2(p.qty),
        totalAmount: r2(p.amount),
      }));

    // ---------- counts ----------
    const [customerCount, productCount, cancelledCount] = await Promise.all([
      this.customerRepo.count(),
      this.productRepo.count(),
      this.invRepo.count({ where: { cancelled: true } }),
    ]);

    return {
      filter,
      totals: {
        revenue: r2(revenue),
        subtotal: r2(subtotal),
        vat: r2(vat),
        discount: r2(discount),
        invoiceCount: invoices.length,
        cancelledCount,
        customerCount,
        productCount,
      },
      byMonth,
      topCustomers,
      topProducts,
    };
  }
}
