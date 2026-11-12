# TFT Trivia

เกมทายข้อมูล Teamfight Tactics ทุก Set (1–18 รวม mid-set) ไว้เล่นกับเพื่อน — เว็บ static ล้วน ไม่มี database

- **Quiz** 4 โหมด (Champion / Item / Trait / Set ไหน?) ตอบแบบตัวเลือก พิมพ์ หรือผสม
- **ทายปริศนา** แบบเทียบคุณสมบัติ (Champion / Item / Trait)
- **ลิงก์ท้าเพื่อน** ได้คำถามชุดเดียวกันเป๊ะ · **Daily** ทุกคนได้ชุดเดียวกันทุกวัน (เวลาไทย)

> Fan-made project · ไม่ได้รับการรับรองจาก Riot Games. TFT and related assets are property of Riot Games ([Legal Jibber Jabber](https://www.riotgames.com/en/legal)).

## พัฒนา

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build
```

หน้าตรวจแท็กตัวละคร (เฉพาะตอน dev): `http://localhost:5173/#/review`

## ข้อมูล

ข้อมูลมาจาก [CommunityDragon](https://communitydragon.org) (และ Meraki Analytics สำหรับข้อมูล LoL) ดึงด้วยสคริปต์แล้ว commit เป็นไฟล์ JSON ที่ `public/data/v<N>/`

```bash
npm run data              # ดึง + แปลง + ตรวจ + เขียนเวอร์ชันใหม่ (ถ้าข้อมูลเปลี่ยน)
npm run data -- --images  # ตรวจรูปภาพด้วย
```

- เพิ่ม Set ใหม่: เพิ่มแถวใน `scripts/data/patches.ts`
- แก้แท็กตัวละคร: `data-src/champion-tags.json` · alias: `data-src/aliases.json` · ตัด Item: `data-src/item-overrides.json`
- ข้อมูลเวอร์ชันเก่าไม่ลบ เพื่อให้ลิงก์ท้าและ Daily ย้อนหลังได้คำถามเดิม
- รายงานข้อมูลล่าสุด: `scripts/data/report.md`

## Deploy

push เข้า `main` แล้ว GitHub Actions จะ build และ deploy ขึ้น GitHub Pages ให้อัตโนมัติ (`.github/workflows/deploy.yml`)

เอกสารออกแบบ: `docs/superpowers/specs/` · แผน: `docs/superpowers/plans/`
