import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { TaxInvoiceItem } from './tax-invoice-item.entity';

@Entity('tax_invoices')
export class TaxInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 50 })
  docNo: string;

  @Column({ type: 'date' })
  date: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ length: 50, nullable: true })
  refDocNo: string | null;

  @Column({ length: 100, nullable: true })
  poNumber: string | null;

  @Column({ length: 100, nullable: true })
  paymentTerms: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  afterDiscount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  vat: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'text', nullable: true })
  totalText: string | null;

  @Column({ default: false })
  cancelled: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => TaxInvoiceItem, (item) => item.taxInvoice, {
    cascade: true,
    eager: true,
  })
  items: TaxInvoiceItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
