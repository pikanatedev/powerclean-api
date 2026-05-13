import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { TaxInvoice } from './tax-invoice.entity';

@Entity('tax_invoice_items')
export class TaxInvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TaxInvoice, (inv) => inv.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tax_invoice_id' })
  taxInvoice: TaxInvoice;

  @Column({ name: 'tax_invoice_id' })
  taxInvoiceId: string;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ name: 'product_id', nullable: true })
  productId: string | null;

  @Column({ type: 'int' })
  no: number;

  // Historical snapshot — preserves what was on the invoice even if the
  // related Product is renamed / re-priced later.
  @Column({ length: 50, nullable: true })
  code: string | null;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  qty: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;
}
