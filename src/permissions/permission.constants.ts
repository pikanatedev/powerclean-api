/**
 * Source of truth สำหรับ resources ที่อยู่ในระบบ permission
 * — เพิ่ม resource ใหม่ที่นี่ → seed/migrate จะใส่ default ให้
 */
export const RESOURCES = [
  'customers',
  'products',
  'tax-invoices',
  'reports',
  'documents',
  'company',
  'users',
  'permissions',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['view', 'create', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

/** Action ที่ใช้จริงในแต่ละ resource — frontend ใช้ disable checkbox ที่ไม่เกี่ยวข้อง */
export const RESOURCE_ACTIONS: Record<Resource, Action[]> = {
  customers: ['view', 'create', 'update', 'delete'],
  products: ['view', 'create', 'update', 'delete'],
  'tax-invoices': ['view', 'create', 'update', 'delete'],
  reports: ['view'],
  documents: ['view'],
  company: ['view', 'update'],
  users: ['view', 'create', 'update', 'delete'],
  permissions: ['view', 'update'],
};

/** Human-readable label ของ resource ใน UI */
export const RESOURCE_LABELS: Record<Resource, string> = {
  customers: 'ลูกค้า',
  products: 'สินค้า',
  'tax-invoices': 'ใบกำกับภาษี',
  reports: 'รายงาน',
  documents: 'เอกสาร',
  company: 'ตั้งค่าบริษัท',
  users: 'ผู้ใช้งานระบบ',
  permissions: 'ตั้งค่าสิทธิ์',
};
