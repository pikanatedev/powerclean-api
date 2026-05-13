# Development Guide — cms-backend

คู่มือสำหรับ developer ที่ต้องการ setup และพัฒนา cms-backend

> สำหรับภาพรวมระบบจากมุมธุรกิจ ดู [`../README.md`](../README.md)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | NestJS 11 |
| ORM | TypeORM 0.3 |
| Database | MySQL 8 |
| Auth | Passport JWT (access + refresh) |
| Validation | class-validator + class-transformer |
| Excel | xlsx-populate |
| Thai number-to-text | bahttext |
| Password hashing | bcryptjs |

---

## โครงสร้างโปรเจกต์

```
cms-backend/
├── docker-compose.yml          # MySQL 8 + Adminer
├── templates/master.xlsx       # template ใบกำกับภาษี
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── seed.ts                 # npm run seed
│   ├── import-historical.ts    # npm run import:historical
│   ├── auth/                   # login, refresh, guards, role decorator
│   ├── users/                  # User entity (admin/staff)
│   ├── customers/              # Customer CRUD
│   ├── products/               # Product CRUD
│   ├── tax-invoices/           # TaxInvoice + TaxInvoiceItem CRUD/list
│   ├── company/                # CompanySetting (singleton)
│   ├── documents/              # generate xlsx
│   ├── reports/                # sales summary aggregations
│   └── common/enums/role.enum.ts
└── poc/                        # standalone POC
```

---

## ติดตั้ง

### Prerequisites

- Node.js ≥ 20
- Docker

### Quick start

```bash
git clone <repo-url> cms-backend
cd cms-backend
npm install

# start MySQL + Adminer
docker compose up -d

# config env
cp .env.example .env
# แก้ JWT_ACCESS_SECRET และ JWT_REFRESH_SECRET ให้เป็น random string

# run dev server (TypeORM จะ auto-create tables ตอน start)
npm run start:dev
```

API: `http://localhost:3001/api`

### Seed บัญชีเริ่มต้น

```bash
npm run seed
```

| Username | Password | Role |
|---|---|---|
| `admin` | `admin1234` | admin |
| `staff` | `staff1234` | staff |

### นำเข้าข้อมูลในอดีต (optional)

```bash
npm run import:historical
```

อ่านจาก `<project-root>/tools/extracted/{customers,products,tax-invoices}.json` (ที่ extract มาจาก Excel)

---

## Environment Variables

| Key | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `NODE_ENV` | `development` | `production` จะปิด TypeORM synchronize |
| `CORS_ORIGIN` | `http://localhost:3000` | frontend origin |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `3306` | |
| `DB_USERNAME` | — | |
| `DB_PASSWORD` | — | |
| `DB_DATABASE` | — | |
| `JWT_ACCESS_SECRET` | — | random string |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_SECRET` | — | random string |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | |
| `TEMPLATES_DIR` | `<cwd>/templates` | path ของ master.xlsx |

---

## API Endpoints

ทุก endpoint ต้องมี `Authorization: Bearer <accessToken>` ยกเว้น `Public`

### Auth

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/auth/refresh` | Refresh token |
| `POST` | `/api/auth/logout` | Access token |
| `GET` | `/api/auth/me` | Access token |

### Customers / Products

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/customers` | staff + admin |
| `POST` | `/api/customers` | staff + admin |
| `PATCH` | `/api/customers/:id` | staff + admin |
| `DELETE` | `/api/customers/:id` | admin only |
| `GET` | `/api/products` | staff + admin |
| `POST` | `/api/products` | staff + admin |
| `PATCH` | `/api/products/:id` | staff + admin |
| `DELETE` | `/api/products/:id` | admin only |

### Tax Invoices

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/tax-invoices` | staff + admin |
| `GET` | `/api/tax-invoices/:id` | staff + admin |
| `POST` | `/api/tax-invoices` | staff + admin |
| `PATCH` | `/api/tax-invoices/:id` | staff + admin |
| `DELETE` | `/api/tax-invoices/:id` | admin only |

Query สำหรับ `GET /tax-invoices`: `search`, `customerId`, `dateFrom`, `dateTo`, `page`, `pageSize`

### Company Settings

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/company` | staff + admin |
| `PUT` | `/api/company` | admin only |

ระบบ auto-seed default ตอน GET ครั้งแรกถ้ายังไม่มี row

### Documents

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/documents/receipt` | สร้างใบเสร็จ ad-hoc |
| `GET` | `/api/documents/tax-invoice/:id/xlsx` | ดาวน์โหลด xlsx (3 sheets) |

### Reports

| Method | Path |
|---|---|
| `GET` | `/api/reports/sales-summary?dateFrom=&dateTo=` |

Response: `{ totals, byMonth[], topCustomers[], topProducts[] }`

---

## Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | dev server พร้อม hot reload |
| `npm run start:debug` | dev server + debugger attached |
| `npm run start:prod` | รัน build แล้ว |
| `npm run build` | compile TypeScript → `dist/` |
| `npm run seed` | สร้าง admin/staff |
| `npm run import:historical` | นำเข้า JSON จาก tools/extracted/ |
| `npm run lint` | ESLint + auto-fix |
| `npm run format` | Prettier |
| `npm test` | Jest |

---

## Database Schema

```
users (id, username, fullName, password, role, isActive, refreshTokenHash, ...)
customers (id, name, email, phone, address, taxId, note, ...)
products (id, code, name, unitPrice, note, ...)
company_settings (id, nameTh, nameEn, address, phone, taxId, authorizerName, ...)
tax_invoices (id, docNo, date, customer_id, refDocNo, poNumber, paymentTerms, dueDate,
              subtotal, discount, afterDiscount, vat, total, totalText, cancelled, ...)
tax_invoice_items (id, tax_invoice_id, product_id, no, code, name, qty, unitPrice, amount)
```

- `tax_invoices.customer_id` → `customers.id` (RESTRICT)
- `tax_invoice_items.tax_invoice_id` → `tax_invoices.id` (CASCADE)
- `tax_invoice_items.product_id` → `products.id` (SET NULL)
- Items เก็บ snapshot `code` / `name` / `unitPrice` ป้องกัน product แก้ภายหลังกระทบใบเก่า

---

## Document Generation Flow

1. Frontend: `GET /api/documents/tax-invoice/:id/xlsx`
2. Service ดึง `TaxInvoice` (พร้อม customer + items) + `CompanySetting`
3. โหลด `templates/master.xlsx` ด้วย `xlsx-populate`
4. เติมข้อมูลใน 3 sheets `ใบกำกับภาษี (Original / Copy / Copy Acc)`
5. ลบ sheet อื่นที่ไม่ใช้
6. Return Buffer → frontend trigger download

**หมายเหตุ:**
- `xlsx-populate` preserve drawings/text boxes ของ template (exceljs ทำไม่ได้)
- `totalText` (ตัวอักษรไทย) คำนวณด้วย `bahttext` package แทน Excel `BAHTTEXT()` formula
- Column K (amount) ขยาย width = 18 ให้พอกับ font Angsana 16pt

---

## Production Notes

- TypeORM `synchronize: true` เปิดเฉพาะ dev — production ให้ใช้ migration
- เปลี่ยน `JWT_*_SECRET` ก่อน deploy
- แนะนำ reverse proxy (Nginx / Caddy) + HTTPS หน้า API
- `customer.phone` length 100; `customer.name` 200 (รองรับชื่อบริษัทยาว ๆ)
