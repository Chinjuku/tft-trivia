# TFT Trivia: แผนลงมือทำ

อ้างอิง: [design doc](../specs/2026-11-12-tft-trivia-design.md) (อนุมัติแล้ว 2026-11-12)

**หลักการทำงาน**
- ทำทีละ Phase ตามลำดับ จบแต่ละ Task ให้ commit หนึ่งครั้ง
- งานที่เป็น logic ใน `src/engine/` และ `scripts/data/` ให้เขียนเทสต์ก่อน (TDD)
- อย่าข้ามไป Phase ถัดไปจนกว่าเงื่อนไข "เสร็จเมื่อ" ของ Phase ปัจจุบันจะผ่านครบ

---

## Phase 0: ตั้งโปรเจกต์

### Task 0.1: สร้างโปรเจกต์
- สร้างด้วย `npm create vite@latest . -- --template react-ts`
- ติดตั้ง `tailwindcss`, `react-router-dom`, `zod`, `vitest`, `@testing-library/react`, `jsdom` และ `tsx` (ใช้รันสคริปต์)
- เพิ่ม scripts ใน package.json: `dev`, `build`, `test`, `data` (`tsx scripts/data/run.ts`)
- ตั้งค่า theme ของ Tailwind ตามสไตล์ C:
  - สี: `bg #0f1115`, `card #171a20`, `line #2a2e36`, `gold #c8aa6e`, `ok #2f6b45`, `part #8a6d2a`, `no #6b2f2f`, `muted #8a8f98`
  - ฟอนต์ Noto Sans Thai จาก Google Fonts
- ทำ layout หลักที่มี footer "Fan-made · ไม่ได้รับการรับรองจาก Riot Games" พร้อมลิงก์ Legal Jibber Jabber
- ใช้ HashRouter

**เสร็จเมื่อ:** `npm run dev` เปิดหน้าว่างที่ใช้ธีมถูกต้อง และ `npm test` รันผ่าน (มีเทสต์ตัวอย่าง 1 ตัว)

---

## Phase 1: ข้อมูล (สำคัญที่สุด)

### Task 1.1: ตาราง Set → แพตช์ (`scripts/data/patches.ts`)
- ลิสต์ทุก Set รวม mid-set ด้วย ไม่รวม revival
- แต่ละแถวมี `{ id: "4.5", number: 4.5, name, patch, mutator }`
- เลือกแพตช์ท้ายๆ ของแต่ละ Set
  - ดูรายการแพตช์ได้จาก `https://raw.communitydragon.org/`
  - ใน `setData` จะมี `mutator` เช่น `TFTSet4` หรือ `TFTSet4_Stage2` ไว้ใช้ยืนยันว่าแพตช์นั้นมี Set ที่ต้องการ
- ระวัง: แพตช์ระหว่าง Set หลักกับ mid-set อาจมีข้อมูลทั้งสองชุด ให้เลือกด้วย `mutator` ไม่ใช่ด้วยเลขแพตช์

**เสร็จเมื่อ:** ไฟล์มีครบทุก Set และสคริปต์เล็กๆ ตรวจแล้วว่าทุกแพตช์มี mutator ที่ระบุจริง

### Task 1.2: ดึงไฟล์ดิบ (`fetch.ts`)
- ดาวน์โหลด `/<patch>/cdragon/tft/en_us.json` มาเก็บที่ `scripts/data/raw/<patch>.json`
- ถ้ามีไฟล์อยู่แล้วให้ข้าม ไฟล์ใหม่มีขนาดหลาย MB ให้ตั้ง timeout ยาวๆ
- ดึงข้อมูล Meraki champion ด้วย เก็บที่ `raw/meraki/<Name>.json`

### Task 1.3: Normalize (`normalize.ts`)
- เขียนเทสต์ก่อน โดยใช้ fixture ตัดมาจากไฟล์จริง 3 ยุค คือ Set 1, Set 4 และ Set ล่าสุด
- **Champion:**
  - ดึงจาก `setData[mutator]` ถ้ามี ถ้าไม่มีให้ใช้ `sets[n]`
  - กรองตัวที่ไม่มี trait ทิ้ง (summon และ PvE)
  - `identity` คือชื่อตัวพิมพ์เล็กที่ตัดอักขระพิเศษออก เช่น `jarvaniv`
  - `range` มาจาก `stats.range`
  - ถ้ามี `role` ให้แยกออกเป็น `damageType` (AD/AP) และ `role` (Tank/Fighter/Caster/Carry/Reaper)
- **Trait:** เก็บ key, name, breakpoints (จาก `effects[].minUnits`), championKeys และ icon
- **Item:** คัดตามขอบเขตใน design doc 4.1 และกำหนด `kind` กับ `recipe` (จาก `from`)
  - **รายการ Item ไม่ได้แยกตาม Set** ให้หาเกณฑ์ที่ใช้คัด เช่น prefix ของ apiName หรือรายการที่ใช้ในแพตช์นั้น
  - บันทึกเกณฑ์ที่ใช้ไว้ใน comment
- **รูป:** แปลง path ให้เป็น `https://raw.communitydragon.org/<patch>/game/<path ตัวพิมพ์เล็ก>.png` (เปลี่ยน `.dds` เป็น `.png`)
- **คำอธิบาย:** ลบ tag `<...>` และตัวแปร `@...@` ออก

**เสร็จเมื่อ:** เทสต์ของทั้ง 3 ยุคผ่าน และผลลัพธ์ตรงกับ type ใน design doc 4.2

### Task 1.4: ข้อมูลเสริมและแท็ก (`tags.ts` และ `data-src/champion-tags.json`)
- สร้าง identities จากทุก Set
- เติม region จาก `faction` ของ Meraki ส่วน Set เก่าที่ไม่มี role ให้แปลงจาก `roles` และ `adaptiveType` ของ Meraki ตามตารางใน design doc 4.3
- **ร่างค่า gender และ species ให้ทุก identity** แล้วตั้ง `reviewed: false`
- ตัวที่ไม่มีใน Meraki ให้ทำ list แยกไว้ เพราะต้องเติมเองทั้งหมด
- `data-src/aliases.json` เริ่มจาก alias ที่ใช้บ่อย เช่น j4, mf, tf, ie, bt, gs, rfc, dclaw, qss และ ga

### Task 1.5: Validate และเขียนไฟล์ (`validate.ts`, `write.ts`, `run.ts`)
- ใช้ Zod schema ตามรูปแบบใน design doc 4.2 และกฎตรวจใน design doc 4.4 โดยเขียนเทสต์ให้ทุกกฎ
- เช็กว่ารูปเปิดได้ (HEAD request ทำพร้อมกันไม่เกิน 8 request) รูปที่เปิดไม่ได้ให้บันทึกลง `scripts/data/report.md`
- เขียนผลลง `public/data/v<N>/` เพิ่ม N ทุกครั้งที่ผลต่างจากเวอร์ชันก่อน แล้วอัปเดต `public/data/latest.json` (`{ latest, dailyVersions: {} }`)
- ทุก Set เริ่มเป็น `status: "draft"`

**เสร็จเมื่อ:** `npm run data` รันผ่านจบทุก Set และ `report.md` แสดงจำนวนตัวละคร Item และ Trait รวมถึงรูปที่เสียของแต่ละ Set

### Task 1.6: ตรวจข้อมูลด้วยตา
- สุ่มดู Set 1, 4, 4.5, 9 และ Set ล่าสุด เทียบกับที่จำได้หรือกับเว็บ wiki
- ที่ผ่านแล้วให้ตั้ง `status: "verified"` ใน `patches.ts`
- **ให้ผู้ใช้ดู report แล้วยืนยันก่อนเปลี่ยนเป็น verified**

---

## Phase 2: Engine (เขียนเทสต์ก่อนทั้งหมด)

### Task 2.1: `src/engine/rng.ts`
- ทำ `hashString` (cyrb53 หรือ xmur3) และ PRNG mulberry32
- `createRng(seed)` คืน `{ next(), int(n), pick(arr), shuffle(arr) }`
- **เทสต์:** seed เดียวกันได้ลำดับเดียวกัน และ shuffle ไม่แก้ array ต้นฉบับ

### Task 2.2: `src/engine/answer.ts`
- `normalize(s)` ทำตัวพิมพ์เล็ก แล้วตัดเว้นวรรค จุด ' และ - ออก
- `matches(input, entity, aliases)` ยอมให้พิมพ์ผิด 1 ตัวอักษรเมื่อชื่อยาวกว่า 6 ตัว (Levenshtein ≤ 1)
- **เทสต์:** `jarvan iv` / `J4` / `jarvn iv` ต้องถูก, `jax` ต้องผิด และ `Kai'Sa` ต้องเท่ากับ `kaisa`

### Task 2.3: `src/engine/quiz.ts`
- `generateQuiz(config, seed, data)` คืน `Question[]` ที่มี prompt, answer, choices และ answerStyle
- **ต้องเรียงข้อมูลตาม key ก่อนสุ่มเสมอ**
- เขียนตัวสร้างคำถามแยกตาม 4 โหมด ตามตารางใน design doc 5.1
- ตัวเลือกหลอกต้องมาจาก Set ที่เลือกและเป็นประเภทเดียวกัน
  - โหมด Set ห้ามใช้ Set ที่มี identity หรือชื่อ Trait เดียวกัน
  - ถ้าตัวเลือกไม่ครบให้สุ่มใหม่ด้วย rng ตัวเดิม
- ห้ามมี identity ซ้ำในรอบเดียวกัน
- โหมดผสมใช้เลือกตอบ 60% พิมพ์ตอบ 40% ยกเว้นโหมด Set ที่เป็นเลือกตอบเสมอ
- **เทสต์ (ใช้ข้อมูลจริงจาก `public/data`):**
  - snapshot: seed เดียวกันต้องได้ผลเหมือนเดิม
  - property test 5,000 รอบ: ทุกข้อมีคำตอบถูกข้อเดียว ไม่มีข้อซ้ำ และคำตอบอยู่ใน Set ที่เลือก

### Task 2.4: `src/engine/guess.ts`
- `pickTarget(kind, seed, data)` เลือกเฉพาะ identity ที่ `reviewed: true` และมีข้อมูลครบ
- `compare(guess, target)` คืนผลต่อคอลัมน์เป็น `{ status: "ok"|"part"|"no"|"unknown", arrow?: "up"|"down" }` ตามกฎใน design doc 5.2 สำหรับ Champion, Item และ Trait
- **เทสต์:** ทุกคอลัมน์ต้องผ่านกรณีตรง ตรงบางส่วน ไม่ตรง ข้อมูลไม่มี และลูกศรถูกทิศ

### Task 2.5: `src/engine/score.ts`
- คะแนน = 100 + ปัดลง(50 × (1 − เวลาที่ใช้/20))
- โหมดทายปริศนาใช้จำนวนครั้งที่ทายเป็นคะแนน
- ทำฟังก์ชันสร้างข้อความแชร์ผล Daily (แถว 🟩🟥)

### Task 2.6: `src/engine/link.ts`
- `encodeChallenge` / `decodeChallenge` ตามรูปแบบลิงก์ใน design doc 5.3
- ทำ `dailySeed(date)` ที่ใช้เวลา UTC+7
- **เทสต์:** encode แล้ว decode ต้องได้ค่าเดิม ลิงก์ที่พังต้องคืน null และเวลา 23:59 กับ 00:00 ตามเวลาไทยต้องได้ seed คนละวัน

**Phase 2 เสร็จเมื่อ:** `npm test` ผ่านทั้งหมด

---

## Phase 3: หน้าจอ

### Task 3.1: Data loader (`src/data/`)
- โหลด `latest.json` → `v<N>/manifest.json` → เฉพาะไฟล์ของ Set ที่เลือก แล้ว cache ไว้ในหน่วยความจำ
- โหลดเวอร์ชันตามที่ระบุได้ สำหรับลิงก์ท้าและ Daily
- `src/lib/storage.ts` ห่อ localStorage ด้วย try/catch

### Task 3.2: หน้าแรก `/`
- ทำตาม mockup `screens-flow.html`
- มีการ์ด Daily, ปุ่มเลือกโหมด, ปุ่มเลือก Set (เฉพาะที่ verified รวมถึง "ทุก Set") และปุ่มเลือกแบบการตอบ
- จำค่าที่เลือกล่าสุดไว้

### Task 3.3: Quiz `/play`
- ตาม mockup สไตล์ C ใน `visual-style.html`
- มีแถบเวลา 20 วินาที, ข้อที่ / ทั้งหมด และคะแนน
- เลือกตอบ: กดแล้วเห็นเฉลยทันที
- พิมพ์ตอบ: ช่องพิมพ์ + Enter
- รูปที่โหลดไม่ขึ้นให้แสดงตัวอักษรแรกของชื่อแทน

### Task 3.4: สรุปผล
- มีคะแนน, แถวถูก/ผิด, เฉลยข้อที่พลาด, ปุ่มคัดลอกลิงก์ท้า (ถามชื่อเล่นถ้ายังไม่ได้ตั้ง), เล่นอีกรอบ และกลับหน้าแรก
- บันทึกคะแนนดีที่สุด

### Task 3.5: รับคำท้า `/c`
- decode ลิงก์ → โหลดข้อมูลเวอร์ชัน `v` → แสดงการ์ดคำท้า → เล่น → เทียบคะแนน → ท้ากลับ
- ถ้าโหลดเวอร์ชันนั้นไม่ได้ ให้ขึ้นเตือนแล้วใช้เวอร์ชันล่าสุดแทน

### Task 3.6: Daily
- **Daily Quiz:** 10 ข้อ คละ 4 โหมด จากทุก Set ที่ verified ใช้เวอร์ชันข้อมูลตาม `dailyVersions` ของวันนั้น
- ถ้าวันนั้นยังไม่มีใน `dailyVersions` ให้ใช้เวอร์ชันล่าสุด
- เก็บผลวันนั้นและจำนวนวันที่เล่นต่อเนื่องไว้ในเครื่อง
- ทำปุ่มแชร์ผล

### Task 3.7: ทายปริศนา `/guess`
- ตาม mockup `guess-mode.html`
- autocomplete แสดง "ชื่อ · Set N" เรียงตามความใกล้ของชื่อที่พิมพ์ และใช้คีย์บอร์ดเลือกได้
- ตารางผลมีคอลัมน์รูปค้างไว้ บนมือถือเลื่อนแนวนอนได้
- ใส่ปุ่มยอมแพ้ ทาย Champion ประจำวัน และลิงก์ท้า
- **ซ่อนไว้ด้วย flag** ถ้า identity ที่ reviewed มีน้อยกว่า 80%

### Task 3.8: หน้ารีวิวแท็ก `/review` (เฉพาะตอน dev)
- เปิดได้เฉพาะเมื่อ `import.meta.env.DEV`
- แสดงตารางทีละ identity พร้อมรูป ให้แก้ gender, species, region และ role override ได้ แล้วกดยืนยันเพื่อตั้ง `reviewed: true`
- ปุ่ม export ดาวน์โหลดไฟล์ `champion-tags.json` ใหม่ไปแทนไฟล์ใน `data-src/` แล้วรัน `npm run data`

**Phase 3 เสร็จเมื่อ:**
- เล่นครบทุกหน้าได้ใน browser ที่ความกว้าง 360px และบน desktop
- เปิดลิงก์ท้าเพื่อนใน browser อื่นแล้วได้คำถามชุดเดียวกัน

---

## Phase 4: ตรวจข้อมูลและ deploy

1. **ผู้ใช้ตรวจแท็กผ่าน `/review`** ทำต่อไปได้เรื่อยๆ ไม่ต้องรอให้จบก่อน
2. **Deploy ขึ้น GitHub Pages หรือ Vercel**
   - ตั้ง `base` ของ Vite ให้ตรงกับที่ host
   - สร้าง GitHub repo ใหม่และ push **ต้องให้ผู้ใช้ยืนยันก่อน**
3. **ตรวจรอบสุดท้าย ทุกข้อในรายการนี้ต้องผ่าน:**
   - เลือกทุก Set และเลือกเฉพาะ Set ได้
   - ตัวเลือกถูกมีข้อเดียวเสมอ โหมด Set ห้ามมีตัวหลอกที่เป็น Set พี่น้องซึ่งมีตัวละครเดียวกัน
   - พิมพ์ตอบใช้ alias ได้
   - ลิงก์ท้าเพื่อนได้ชุดเดียวกันทั้งบนมือถือและ desktop
   - Daily ได้ชุดเดียวกันทุกเครื่อง
   - footer มีข้อความว่าเป็น fan project

## ลำดับและการทำพร้อมกัน
- Phase 1 → Phase 2 → Phase 3 ต้องทำตามลำดับ เพราะ engine ต้องใช้ข้อมูลจริงในการเทสต์
- ข้อยกเว้น: Task 2.1, 2.2, 2.5 และ 2.6 ไม่ต้องใช้ข้อมูล เริ่มทำพร้อม Phase 1 ได้
- Task 1.4 (ร่างแท็ก) และการตรวจแท็กทำขนานไปกับ Phase 2–3 ได้
