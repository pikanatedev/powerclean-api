import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../common/enums/role.enum';

/**
 * One row per (role, resource).
 * Tracks fine-grained CRUD permissions; admin can toggle from UI.
 */
@Entity('role_permissions')
@Index(['role', 'resource'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ length: 50 })
  resource: string;

  @Column({ default: false })
  canView: boolean;

  @Column({ default: false })
  canCreate: boolean;

  @Column({ default: false })
  canUpdate: boolean;

  @Column({ default: false })
  canDelete: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
