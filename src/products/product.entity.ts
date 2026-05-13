import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: false })
  @Column({ length: 50, nullable: true })
  code: string | null;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
