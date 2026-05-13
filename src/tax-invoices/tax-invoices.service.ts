import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import bahttext = require('bahttext');
import { TaxInvoice } from './tax-invoice.entity';
import { TaxInvoiceItem } from './tax-invoice-item.entity';
import { CreateTaxInvoiceDto } from './dto/create-tax-invoice.dto';
import { UpdateTaxInvoiceDto } from './dto/update-tax-invoice.dto';
import { ListTaxInvoiceDto } from './dto/list-tax-invoice.dto';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeTotals(
  items: Array<{ qty: number; unitPrice: number }>,
  discount: number,
) {
  const subtotal = round2(
    items.reduce((s, it) => s + Number(it.qty) * Number(it.unitPrice), 0),
  );
  const afterDiscount = round2(subtotal - (discount ?? 0));
  const vat = round2(afterDiscount * 0.07);
  const total = round2(afterDiscount + vat);
  return { subtotal, afterDiscount, vat, total };
}

@Injectable()
export class TaxInvoicesService {
  constructor(
    @InjectRepository(TaxInvoice)
    private readonly invoiceRepo: Repository<TaxInvoice>,
    @InjectRepository(TaxInvoiceItem)
    private readonly itemRepo: Repository<TaxInvoiceItem>,
  ) {}

  async list(query: ListTaxInvoiceDto) {
    const { page, pageSize, search, customerId, dateFrom, dateTo } = query;
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'c')
      .orderBy('inv.date', 'DESC')
      .addOrderBy('inv.docNo', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('inv.docNo LIKE :s', { s: `%${search}%` })
            .orWhere('c.name LIKE :s', { s: `%${search}%` })
            .orWhere('inv.refDocNo LIKE :s', { s: `%${search}%` })
            .orWhere('inv.poNumber LIKE :s', { s: `%${search}%` });
        }),
      );
    }
    if (customerId) qb.andWhere('inv.customerId = :cid', { cid: customerId });
    if (dateFrom) qb.andWhere('inv.date >= :df', { df: dateFrom });
    if (dateTo) qb.andWhere('inv.date <= :dt', { dt: dateTo });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<TaxInvoice> {
    const inv = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['customer', 'items'],
    });
    if (!inv) throw new NotFoundException('Tax invoice not found');
    return inv;
  }

  async create(dto: CreateTaxInvoiceDto): Promise<TaxInvoice> {
    const duplicate = await this.invoiceRepo.findOne({
      where: { docNo: dto.docNo },
    });
    if (duplicate) {
      throw new ConflictException(`docNo "${dto.docNo}" already exists`);
    }
    const totals = computeTotals(dto.items, dto.discount ?? 0);
    const inv = this.invoiceRepo.create({
      docNo: dto.docNo,
      date: dto.date,
      customerId: dto.customerId,
      refDocNo: dto.refDocNo ?? null,
      poNumber: dto.poNumber ?? null,
      paymentTerms: dto.paymentTerms ?? null,
      dueDate: dto.dueDate ?? null,
      discount: dto.discount ?? 0,
      cancelled: dto.cancelled ?? false,
      note: dto.note ?? null,
      subtotal: totals.subtotal,
      afterDiscount: totals.afterDiscount,
      vat: totals.vat,
      total: totals.total,
      totalText: `(${bahttext(totals.total)})`,
      items: dto.items.map((it, idx) =>
        this.itemRepo.create({
          no: idx + 1,
          productId: it.productId ?? null,
          code: it.code ?? null,
          name: it.name,
          qty: it.qty,
          unitPrice: it.unitPrice,
          amount: round2(it.qty * it.unitPrice),
        }),
      ),
    });
    return this.invoiceRepo.save(inv);
  }

  async update(id: string, dto: UpdateTaxInvoiceDto): Promise<TaxInvoice> {
    const inv = await this.findOne(id);
    if (dto.docNo && dto.docNo !== inv.docNo) {
      const dup = await this.invoiceRepo.findOne({
        where: { docNo: dto.docNo },
      });
      if (dup) throw new ConflictException(`docNo "${dto.docNo}" already exists`);
      inv.docNo = dto.docNo;
    }
    if (dto.date !== undefined) inv.date = dto.date;
    if (dto.customerId !== undefined) inv.customerId = dto.customerId;
    if (dto.refDocNo !== undefined) inv.refDocNo = dto.refDocNo ?? null;
    if (dto.poNumber !== undefined) inv.poNumber = dto.poNumber ?? null;
    if (dto.paymentTerms !== undefined)
      inv.paymentTerms = dto.paymentTerms ?? null;
    if (dto.dueDate !== undefined) inv.dueDate = dto.dueDate ?? null;
    if (dto.cancelled !== undefined) inv.cancelled = dto.cancelled;
    if (dto.note !== undefined) inv.note = dto.note ?? null;
    if (dto.discount !== undefined) inv.discount = dto.discount;

    if (dto.items) {
      await this.itemRepo.delete({ taxInvoiceId: inv.id });
      inv.items = dto.items.map((it, idx) =>
        this.itemRepo.create({
          taxInvoiceId: inv.id,
          no: idx + 1,
          productId: it.productId ?? null,
          code: it.code ?? null,
          name: it.name,
          qty: it.qty,
          unitPrice: it.unitPrice,
          amount: round2(it.qty * it.unitPrice),
        }),
      );
    }
    const totals = computeTotals(inv.items, Number(inv.discount));
    inv.subtotal = totals.subtotal;
    inv.afterDiscount = totals.afterDiscount;
    inv.vat = totals.vat;
    inv.total = totals.total;
    inv.totalText = `(${bahttext(totals.total)})`;
    return this.invoiceRepo.save(inv);
  }

  async remove(id: string): Promise<void> {
    const res = await this.invoiceRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Tax invoice not found');
  }
}
