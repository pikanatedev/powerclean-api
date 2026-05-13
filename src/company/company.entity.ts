import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company_settings')
export class CompanySetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  nameTh: string;

  @Column({ length: 200, nullable: true })
  nameEn: string | null;

  @Column({ type: 'text' })
  address: string;

  @Column({ length: 100 })
  phone: string;

  @Column({ length: 30 })
  taxId: string;

  @Column({ length: 150 })
  authorizerName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
