# موقع جعفر السلمي — للبرمجة وصيانة الجوالات 👑

موقع المحل: ألعاب PS4/PS5، منتجات، خدمات، سلة وطلبات واتساب، إشعارات حقيقية، ولوحة تحكم كاملة.

- **الموقع:** `https://shms201349.github.io/snan-exchange/`
- **لوحة التحكم (رابط مخفي):** `https://shms201349.github.io/snan-exchange/#/cp`

## يشتغل الآن بالوضع التجريبي
بدون أي إعداد، الموقع يعمل وتُحفظ البيانات في متصفح كل جهاز فقط (للتجربة).
الدخول التجريبي: `admin` / `admin123`.

## التشغيل الفعلي (مجاني) — 3 خطوات

### 1) قاعدة البيانات Supabase
1. افتح [supabase.com](https://supabase.com) ← سجّل ← **New project** (اختر أقرب منطقة، مثل Frankfurt).
2. من **SQL Editor** ← New query ← الصق محتوى `supabase/schema.sql` كاملاً ← **Run**.
3. من **Authentication ← Users ← Add user**: البريد `admin@jaafar.shop` + كلمة سر قوية (هذي كلمة سر لوحة التحكم، واسم المستخدم يبقى `admin`).
4. من **Authentication ← Sign In / Providers**: أوقف **Allow new users to sign up** (عشان ما أحد يسجل).
5. من **Project Settings ← API** انسخ: `Project URL` و `anon public key`.

### 2) الربط
افتح `js/config.js` وضع القيمتين:
```js
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',
```
(المفتاح anon آمن للنشر — الحماية من صلاحيات قاعدة البيانات.)

### 3) النشر على GitHub Pages
1. في المستودع: **Settings ← Pages ← Source: GitHub Actions**.
2. ادمج الفرع في `main` — يُنشر الموقع تلقائياً مع كل تحديث.

### اختياري: الجلب التلقائي للألعاب
سجّل مجاناً في [rawg.io/apidocs](https://rawg.io/apidocs) وانسخ المفتاح، ثم ضعه في لوحة التحكم ← **المزامنة**.

## الملفات
| الملف | الوظيفة |
|---|---|
| `index.html` | هيكل الصفحة |
| `css/style.css` | التصميم (فاتح / غامق، جوال) |
| `js/app.js` | الصفحات، البانر، السلة، الإشعارات |
| `js/admin.js` | لوحة التحكم |
| `js/db.js` | قاعدة البيانات (Supabase أو تجريبي) |
| `js/defaults.js` | المحتوى الافتراضي (قابل للتعديل من اللوحة) |
| `supabase/schema.sql` | إنشاء الجداول والصلاحيات |
| `docs/PLAN.md` | الخطة |
