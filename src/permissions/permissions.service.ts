import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RolePermission } from './permission.entity';
import { Role } from '../common/enums/role.enum';
import {
  Action,
  RESOURCES,
  Resource,
} from './permission.constants';
import { PermissionEntryDto } from './dto/update-permissions.dto';

const ACTION_KEY: Record<Action, keyof RolePermission> = {
  view: 'canView',
  create: 'canCreate',
  update: 'canUpdate',
  delete: 'canDelete',
};

/**
 * Default seed:
 * - Admin: ทุก action ของทุก resource
 * - Staff: view/create/update ของ business data (customers, products, tax-invoices, documents);
 *   view-only ของ reports + company; ไม่มี users + permissions
 */
function defaultsFor(role: Role, resource: Resource) {
  if (role === Role.ADMIN) {
    return { canView: true, canCreate: true, canUpdate: true, canDelete: true };
  }
  // staff defaults
  const all = { canView: true, canCreate: true, canUpdate: true, canDelete: false };
  const viewOnly = { canView: true, canCreate: false, canUpdate: false, canDelete: false };
  const none = { canView: false, canCreate: false, canUpdate: false, canDelete: false };
  switch (resource) {
    case 'customers':
    case 'products':
    case 'tax-invoices':
      return all;
    case 'reports':
    case 'documents':
      return viewOnly;
    case 'company':
      return viewOnly;
    case 'users':
    case 'permissions':
      return none;
  }
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  /** in-memory cache; refresh on write */
  private cache = new Map<string, RolePermission>(); // key = `${role}:${resource}`

  constructor(
    @InjectRepository(RolePermission)
    private readonly repo: Repository<RolePermission>,
  ) {}

  async onModuleInit() {
    await this.ensureSeed();
    await this.refreshCache();
  }

  private cacheKey(role: Role, resource: string) {
    return `${role}:${resource}`;
  }

  private async refreshCache() {
    this.cache.clear();
    const all = await this.repo.find();
    for (const p of all) this.cache.set(this.cacheKey(p.role, p.resource), p);
  }

  /** seed any missing (role × resource) row with defaults */
  async ensureSeed() {
    const existing = await this.repo.find();
    const set = new Set(existing.map((p) => `${p.role}:${p.resource}`));
    const toCreate: Partial<RolePermission>[] = [];
    for (const role of [Role.ADMIN, Role.STAFF]) {
      for (const resource of RESOURCES) {
        const key = `${role}:${resource}`;
        if (!set.has(key)) {
          toCreate.push({ role, resource, ...defaultsFor(role, resource) });
        }
      }
    }
    if (toCreate.length) {
      await this.repo.save(toCreate as RolePermission[]);
    }
  }

  /** core permission check — used by guard */
  async check(
    role: Role | undefined,
    resource: string,
    action: Action,
  ): Promise<boolean> {
    if (!role) return false;
    if (this.cache.size === 0) await this.refreshCache();
    const row = this.cache.get(this.cacheKey(role, resource));
    if (!row) return false;
    const key = ACTION_KEY[action];
    return Boolean(row[key]);
  }

  /** return full matrix for both roles — used by management UI and /auth/me */
  async getMatrix(): Promise<RolePermission[]> {
    if (this.cache.size === 0) await this.refreshCache();
    return Array.from(this.cache.values()).sort((a, b) => {
      const r = a.role.localeCompare(b.role);
      return r !== 0 ? r : a.resource.localeCompare(b.resource);
    });
  }

  /** return permissions for ONE role as `{ resource: { view, create, update, delete } }` */
  async getForRole(role: Role): Promise<
    Record<string, { view: boolean; create: boolean; update: boolean; delete: boolean }>
  > {
    if (this.cache.size === 0) await this.refreshCache();
    const out: Record<string, any> = {};
    for (const [k, p] of this.cache.entries()) {
      if (!k.startsWith(`${role}:`)) continue;
      out[p.resource] = {
        view: p.canView,
        create: p.canCreate,
        update: p.canUpdate,
        delete: p.canDelete,
      };
    }
    return out;
  }

  async updateMatrix(entries: PermissionEntryDto[]): Promise<RolePermission[]> {
    // upsert ทุก entry
    for (const e of entries) {
      let row = await this.repo.findOne({
        where: { role: e.role, resource: e.resource },
      });
      if (!row) {
        row = this.repo.create({ role: e.role, resource: e.resource });
      }
      row.canView = e.canView;
      row.canCreate = e.canCreate;
      row.canUpdate = e.canUpdate;
      row.canDelete = e.canDelete;
      await this.repo.save(row);
    }
    // safety: admin must keep users + permissions full access (else admin lock out)
    await this.guaranteeAdminCanManage();
    await this.refreshCache();
    return this.getMatrix();
  }

  private async guaranteeAdminCanManage() {
    for (const resource of ['users', 'permissions'] as const) {
      let row = await this.repo.findOne({
        where: { role: Role.ADMIN, resource },
      });
      if (!row) {
        row = this.repo.create({ role: Role.ADMIN, resource });
      }
      row.canView = true;
      row.canCreate = resource === 'users';
      row.canUpdate = true;
      row.canDelete = resource === 'users';
      await this.repo.save(row);
    }
  }
}
