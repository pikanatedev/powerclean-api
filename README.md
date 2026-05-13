# CMS Backend

NestJS + TypeORM + MySQL + JWT (access + refresh)

## Stack
- NestJS 10
- TypeORM + mysql2
- Passport JWT (access + refresh strategy)
- bcryptjs, class-validator

## โครงสร้าง
```
src/
  main.ts
  app.module.ts
  seed.ts                 # สร้าง admin/staff เริ่มต้น
  auth/                   # login, refresh, logout, /me, guard, role
  users/                  # User entity + service
  customers/              # Customer CRUD
  common/enums/role.enum.ts
```

## เริ่มใช้งาน

### 1. สตาร์ท MySQL ด้วย Docker
```bash
docker compose up -d
```
- MySQL: `localhost:3306` (db: `cms_db`, user: `cms_user`, password: `cms_password`)
- Adminer (GUI): http://localhost:8080

### 2. ติดตั้ง dependencies
```bash
npm install
```

### 3. ตั้งค่า env
```bash
cp .env.example .env
# แก้ JWT_ACCESS_SECRET / JWT_REFRESH_SECRET ให้เป็น string ยาวๆ
```

### 4. รัน dev server
```bash
npm run start:dev
```
API: `http://localhost:3001/api`

ตอนแรก TypeORM จะ `synchronize: true` สร้างตารางให้อัตโนมัติ (เฉพาะ dev)

### 5. seed user เริ่มต้น
```bash
npm run seed
```
จะได้บัญชี:
- admin / admin1234 (role: admin)
- staff / staff1234 (role: staff)

## API Endpoints

| Method | Path                | Auth      | Role           |
|--------|---------------------|-----------|----------------|
| POST   | /api/auth/login     | public    | -              |
| POST   | /api/auth/refresh   | refresh   | -              |
| POST   | /api/auth/logout    | access    | -              |
| GET    | /api/auth/me        | access    | -              |
| GET    | /api/customers      | access    | staff / admin  |
| GET    | /api/customers/:id  | access    | staff / admin  |
| POST   | /api/customers      | access    | staff / admin  |
| PATCH  | /api/customers/:id  | access    | staff / admin  |
| DELETE | /api/customers/:id  | access    | admin เท่านั้น |

### ตัวอย่าง login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin1234"}'
```

ตอบกลับ:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "username": "admin", "role": "admin", "fullName": "..." }
}
```

## หมายเหตุเรื่อง production
- `synchronize: true` ใช้ในช่วงพัฒนา เท่านั้น — production ให้ใช้ migration
- เปลี่ยน JWT secret ใน `.env` ก่อน deploy
- ใส่ HTTPS / reverse proxy หน้า API
