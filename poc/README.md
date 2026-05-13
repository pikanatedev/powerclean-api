# POC: Excel template → 1 receipt xlsx (3 sheets)

ใช้ทดสอบ flow generate เอกสารใบเสร็จจาก master Excel template
**โฟกัสตอนนี้: xlsx output ให้สมบูรณ์ก่อน** PDF conversion เก็บไว้ทีหลัง (มี issue เรื่อง page overflow ที่ยังต้องแก้)

## Flow
1. โหลด `templates/master.xlsx` (= ไฟล์ `example_template.xlsx` ที่ copy มา)
2. เปิดด้วย **xlsx-populate** (preserve drawings/text boxes ทั้งหมด)
3. เติมข้อมูลใน 3 sheets: `ใบเสร็จรับเงิน Original` / `Copy` / `Copy Acc` ด้วยข้อมูลชุดเดียวกัน
4. คำนวณยอด + ตัวอักษรไทย (npm `bahttext`)
5. **ลบ sheet อื่นทั้งหมด** (ใบกำกับภาษี, ใบลดหนี้, ใบเพิ่มหนี้, ใบวางบิล) เหลือเฉพาะ 3 sheets ของใบเสร็จ
6. save เป็นไฟล์ `<docNo>.xlsx`

## ผลที่ได้
**`output/RE2026-01-001.xlsx`** — ไฟล์เดียวมี 3 sheets:
- ✅ **Drawings preserved** — กล่อง "ใบเสร็จรับเงิน Original / RECEIPT" ที่มุมขวาบน
- ✅ ข้อมูล: เลขที่, วันที่, ลูกค้า, อ้างอิงใบวางบิล, วิธีชำระเงิน
- ✅ Items: ชื่อสินค้า, จำนวน, จำนวนเงิน
- ✅ ยอด: รวม, ส่วนลด, รวมเป็นเงิน, VAT 7%, รวมทั้งสิ้น
- ✅ ตัวอักษรไทย เช่น `(สี่หมื่นหกพันสี่ร้อยสิบหกบาทหกสิบสตางค์)`
- ✅ Sheet เดียวต่อไฟล์ — ไม่มี sheet พ่วงของ ใบกำกับภาษี / ใบลดหนี้ / ใบวางบิล

## รัน

```bash
cd cms-backend/poc
npm install
npm run generate              # xlsx only (default)
```

ได้ 3 ไฟล์ xlsx ใน `output/` — เปิดด้วย Excel หรือ LibreOffice Calc ตรวจสอบได้

## เปลี่ยนข้อมูล
แก้ไข `sample-data.json` แล้วรันใหม่ หรือ:
```bash
npx tsx generate.ts path/to/other-data.json
```

## ทำไมเปลี่ยนจาก exceljs → xlsx-populate
ครั้งแรกใช้ `exceljs` พบว่า:
- **ทิ้ง drawings/text boxes** เมื่อ save → กล่อง "ใบเสร็จรับเงิน Original / RECEIPT" หาย
- **Number format เพี้ยน** — escape `\\` ใน accounting format ถูกตัด ทำให้ LibreOffice แสดง `###`

เปลี่ยนเป็น **xlsx-populate** ซึ่งออกแบบมาเพื่อ preserve ทุกอย่างที่ไม่ได้แก้ไข

## Cell map (sheet ใบเสร็จรับเงิน *)

| Cell    | Field                |
|---------|----------------------|
| A1–A5   | header บริษัทผู้ออก (override formula ที่ link ไป master sheet) |
| J5      | เลขที่เอกสาร         |
| J6      | วันที่                |
| B8      | ชื่อลูกค้า           |
| B9      | Tax ID               |
| B10     | ที่อยู่บรรทัด 1       |
| B11     | ที่อยู่บรรทัด 2       |
| B12     | โทร                  |
| J8      | อ้างอิงใบวางบิล      |
| I9-I11  | วิธีชำระเงิน (3 บรรทัด) |
| A16-K27 | item rows × 12       |
| K28–K32 | รวม / ส่วนลด / รวมเป็นเงิน / VAT 7% / รวมทั้งสิ้น |
| A32     | จำนวนเงินตัวอักษรไทย |
| E38     | ผู้มีอำนาจลงนาม      |
| A29     | (เคลียร์ — template มี PO number ค้างไว้) |

## ข้อจำกัดที่รู้แล้ว
- **Items สูงสุด 12 รายการ** (rows 16–27 ใน template) ถ้าเกินจะ throw error
- **Checkbox ☑** ใช้ Unicode prefix แทน Excel checkbox จริง
- คอลัมน์ K (Amount) ถูกขยายเป็น width=18 เพราะ template เดิม 13.66 chars + font Angsana 16pt ไม่พอ

---

## PDF Conversion (อยู่ระหว่าง parking — มี issue)

ถ้าอยากลอง:
```bash
npm run generate -- --pdf
```

ตอนนี้ติด: PDF render ออกมา **2 หน้า** (overflow ลงหน้า 2 เป็นเส้นแนวนอน column ขวา)
- ลอง LibreOffice filter `IsSkipEmptyPages` แล้วยังไม่ได้
- ต้องไปแก้ pageSetup ของ sheet ใน xlsx (set `fitToPage=1`) ซึ่ง xlsx-populate ไม่มี API direct
- ทางแก้ที่จะลอง: post-process xlsx ด้วย JSZip + manual XML edit, หรือ spawn Python (openpyxl) สำหรับ page setup

ติดตั้ง LibreOffice:
```bash
# macOS
brew install --cask libreoffice
# Docker
npm run docker:build
```
