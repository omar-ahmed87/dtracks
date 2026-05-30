# 🚂 دليل رفع المشروع على Railway (خطوة بخطوة)

## 🎯 لماذا Railway؟

✅ **مجاني** - 5$ رصيد مجاني شهرياً  
✅ **بدون بطاقة ائتمان** في البداية  
✅ **سهل جداً** - 3 خطوات فقط  
✅ **سريع** - Deploy في دقائق  
✅ **يدعم Node.js** بشكل كامل  

---

## 📋 المتطلبات:

- ✅ حساب GitHub (موجود)
- ✅ المشروع مرفوع على GitHub
- ✅ حساب Railway (هنعمله دلوقتي)

---

## 🚀 الخطوات بالتفصيل:

---

### **الخطوة 1️⃣: إنشاء حساب على Railway**

1. **افتح المتصفح وروح على:**
   ```
   https://railway.app
   ```

2. **اضغط على "Login"** (في أعلى اليمين)

3. **اختر "Login with GitHub"**
   - هيفتح صفحة GitHub
   - اضغط **"Authorize Railway"**
   - Railway هيربط مع حسابك على GitHub تلقائياً

4. **مبروك!** 🎉 دلوقتي عندك حساب على Railway

---

### **الخطوة 2️⃣: رفع المشروع على GitHub (لو مش مرفوع)**

#### **أ) لو المشروع مرفوع بالفعل:**
- تخطى هذه الخطوة ✅

#### **ب) لو المشروع مش مرفوع:**

1. **افتح Terminal في VS Code**
2. **اكتب الأوامر دي:**

```bash
# تهيئة Git
git init

# إضافة كل الملفات
git add .

# عمل Commit
git commit -m "Initial commit for Railway deployment"

# إضافة Remote Repository
git remote add origin https://github.com/omar-ahmed87/etracks.git

# رفع على GitHub
git push -u origin main
```

> ⚠️ **ملاحظة:** لو الـ branch اسمه `master` بدل `main`، استخدم `master`

---

### **الخطوة 3️⃣: إنشاء Project جديد على Railway**

1. **في Railway Dashboard، اضغط "New Project"**

2. **اختر "Deploy from GitHub repo"**

3. **اختر Repository:**
   - ابحث عن: `etracks`
   - اضغط **"Deploy Now"**

```
┌────────────────────────────────────┐
│ 🔍 Select a repository             │
│                                    │
│ ✓ omar-ahmed87/etracks             │
│   └─ [Deploy Now] ← اضغط هنا       │
└────────────────────────────────────┘
```

4. **Railway هيبدأ Deploy تلقائياً!** 🚀

---

### **الخطوة 4️⃣: إضافة Environment Variables**

بعد ما الـ Deploy يبدأ:

1. **اضغط على اسم المشروع** (etracks)

2. **اضغط على "Variables"** (في القائمة الجانبية)

3. **اضغط "New Variable"** وأضف المتغيرات دي:

---

#### **📋 المتغيرات المطلوبة:**

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=your-supabase-project-url-here
SUPABASE_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_KEY=your-supabase-service-key-here
JWT_SECRET=your-strong-32-byte-secret-at-least
JWT_ISSUER=etracks
JWT_AUDIENCE=etracks-users
JWT_EXPIRATION=7d
AUTH_COOKIE_NAME=authToken
BACKUP_SECRET=your-backup-secret-here
```

---

#### **🎯 كيف تضيف المتغيرات:**

**الطريقة الأولى: واحد واحد**
1. اضغط **"New Variable"**
2. اكتب الـ **Key** (مثل: `NODE_ENV`)
3. اكتب الـ **Value** (مثل: `production`)
4. اضغط **"Add"**
5. كرر لكل المتغيرات

**الطريقة الثانية: نسخ كل المتغيرات مرة واحدة (أسرع)**
1. اضغط **"RAW Editor"** (في أعلى صفحة Variables)
2. **انسخ والصق** كل المتغيرات دفعة واحدة:
   ```
   NODE_ENV=production
   PORT=3000
   SUPABASE_URL=your-supabase-project-url-here
   SUPABASE_KEY=your-supabase-anon-key-here
   SUPABASE_SERVICE_KEY=your-supabase-service-key-here
   JWT_SECRET=your-strong-32-byte-secret-at-least
   JWT_ISSUER=etracks
   JWT_AUDIENCE=etracks-users
   JWT_EXPIRATION=7d
   AUTH_COOKIE_NAME=authToken
   BACKUP_SECRET=your-backup-secret-here
   ```
3. اضغط **"Update Variables"**

---

### **الخطوة 5️⃣: إعادة Deploy بعد إضافة المتغيرات**

1. **اضغط على "Deployments"** (في القائمة الجانبية)

2. **اضغط على آخر Deployment**

3. **اضغط "Redeploy"** (أو انتظر - Railway هيعمل Redeploy تلقائياً)

---

### **الخطوة 6️⃣: الحصول على الـ URL**

1. **اضغط على "Settings"** (في القائمة الجانبية)

2. **في قسم "Domains":**
   - اضغط **"Generate Domain"**
   - Railway هيديك URL زي:
     ```
     https://etracks-production.up.railway.app
     ```

3. **انسخ الـ URL** 📋

4. **افتحه في المتصفح** 🌐

---

### **الخطوة 7️⃣: تحديث CORS_WHITELIST**

بعد ما تحصل على الـ URL:

1. **ارجع لـ "Variables"**

2. **أضف متغير جديد:**
   ```
   CORS_WHITELIST=https://etracks-production.up.railway.app
   ```
   > ⚠️ **استبدل الـ URL بالـ URL الفعلي اللي حصلت عليه**

3. **اضغط "Add"**

4. **Railway هيعمل Redeploy تلقائياً**

---

## ✅ **اختبار المشروع:**

### **افتح الـ URL وجرب:**

1. ✅ **الصفحة الرئيسية** - لازم تفتح
2. ✅ **تسجيل الدخول** - جرب تسجل دخول
3. ✅ **الكورسات** - شوف الكورسات بتظهر
4. ✅ **Classroom** - جرب تفتح classroom
5. ✅ **Admin Panel** - لو عندك حساب أدمن

---

## 📊 **مراقبة المشروع:**

### **في Railway Dashboard:**

#### **1. Deployments (السجل)**
- شوف كل الـ Deployments
- الوقت والحالة
- الأخطاء لو موجودة

#### **2. Logs (السجلات)**
- شوف كل اللي بيحصل في السيرفر
- الأخطاء والتحذيرات
- Requests اللي جاية

#### **3. Metrics (الإحصائيات)**
- استخدام الـ CPU
- استخدام الـ RAM
- استخدام الـ Network

#### **4. Usage (الاستخدام)**
- كام استخدمت من الـ 5$ المجانية
- متبقي كام

---

## 🔄 **تحديث المشروع:**

### **لما تعمل تعديلات جديدة:**

1. **Push للـ GitHub:**
   ```bash
   git add .
   git commit -m "تحديثات جديدة"
   git push origin main
   ```

2. **Railway هيعمل Deploy تلقائياً!**
   - مش محتاج تعمل حاجة
   - هيشوف الـ commit الجديد
   - هيعمل Build و Deploy تلقائياً

3. **شوف الـ Logs** عشان تتأكد إن كل حاجة تمام

---

## ⚠️ **مشاكل شائعة وحلولها:**

### **1️⃣ المشكلة: Build Failed**

**الأعراض:**
```
❌ Build failed
```

**الحل:**
- افتح **"Logs"**
- شوف آخر سطر أحمر
- غالباً المشكلة في:
  - ❌ Environment Variable ناقص
  - ❌ خطأ في package.json
  - ❌ مشكلة في الكود

---

### **2️⃣ المشكلة: Application Error**

**الأعراض:**
```
Application failed to respond
```

**الحل:**
- افتح **"Logs"**
- شوف الأخطاء
- تأكد من:
  - ✅ PORT = 3000 (أو اتركه فاضي)
  - ✅ كل Environment Variables موجودة
  - ✅ Supabase connection شغال

---

### **3️⃣ المشكلة: CORS Error**

**الأعراض:**
```
Access to fetch blocked by CORS policy
```

**الحل:**
- تأكد إن `CORS_WHITELIST` فيه الـ URL الصحيح
- أو ضيف `APP_URL` بالـ URL بتاع Railway:
  ```
  APP_URL=https://etracks-production.up.railway.app
  ```

---

### **4️⃣ المشكلة: Database Connection Error**

**الأعراض:**
```
Error: connect ETIMEDOUT
```

**الحل:**
1. روح على **Supabase Dashboard**
2. اضغط **Settings** → **Database**
3. تأكد إن **Connection Pooling** مفعّل
4. في **Network Restrictions**:
   - اختار **Allow all connections**

---

## 💰 **الخطة المجانية:**

### **ما تحصل عليه:**

- ✅ **5$ رصيد مجاني شهرياً**
- ✅ **512 MB RAM**
- ✅ **1 GB Disk**
- ✅ **100 GB Bandwidth**
- ✅ **Unlimited Projects**

### **كفاية لـ:**
- ✅ مشاريع صغيرة ومتوسطة
- ✅ Portfolio projects
- ✅ Testing و Development
- ✅ مشاريع تعليمية

### **متى تحتاج Upgrade:**
- ❌ لو الـ 5$ خلصوا قبل آخر الشهر
- ❌ لو المشروع كبير جداً
- ❌ لو عندك traffic عالي جداً

---

## 🎓 **نصائح مهمة:**

### ✅ **Do's (اعمل كده):**

1. ✅ **احفظ Environment Variables** في مكان آمن
2. ✅ **راجع الـ Logs** بانتظام
3. ✅ **اعمل Test** بعد كل deploy
4. ✅ **استخدم HTTPS** دائماً
5. ✅ **راقب الاستخدام** عشان الـ 5$ ميخلصوش

### ❌ **Don'ts (متعملش كده):**

1. ❌ **متشاركش Environment Variables** مع حد
2. ❌ **متحطش Secrets** في الكود
3. ❌ **متنساش تعمل Test** قبل الـ Deploy
4. ❌ **متستخدمش HTTP** (استخدم HTTPS بس)
5. ❌ **متسيبش المشروع يستهلك الـ 5$** بسرعة

---

## 🆘 **محتاج مساعدة؟**

### **الموارد المفيدة:**

1. **Railway Docs:**
   https://docs.railway.app

2. **Railway Discord:**
   https://discord.gg/railway

3. **Railway Status:**
   https://status.railway.app

4. **Railway Blog:**
   https://blog.railway.app

---

## 🎉 **مبروك!**

لو وصلت هنا ونفذت كل الخطوات، يبقى المشروع بتاعك دلوقتي **Live على الإنترنت!** 🚀

### **شارك الـ URL مع:**
- ✅ أصحابك
- ✅ عملائك
- ✅ في الـ CV بتاعك
- ✅ على LinkedIn

---

## 📝 **Checklist النهائي:**

قبل ما تقول خلصت، تأكد من:

- [ ] المشروع اترفع على GitHub
- [ ] Railway Project اتعمل
- [ ] كل Environment Variables موجودة
- [ ] الـ Build نجح
- [ ] الموقع بيفتح
- [ ] تسجيل الدخول شغال
- [ ] الكورسات بتظهر
- [ ] Classroom شغال
- [ ] Admin Panel شغال (لو موجود)
- [ ] مافيش أخطاء في الـ Logs
- [ ] CORS_WHITELIST متحدث بالـ URL الصحيح

---

## 🎯 **النتيجة النهائية:**

```
✅ المشروع على GitHub: https://github.com/omar-ahmed87/etracks
✅ المشروع على Railway: https://etracks-production.up.railway.app
✅ كل حاجة شغالة 100%
```

---

## 🔗 **روابط سريعة:**

- **Railway Dashboard:** https://railway.app/dashboard
- **GitHub Repository:** https://github.com/omar-ahmed87/etracks
- **Supabase Dashboard:** https://supabase.com/dashboard

---

**بالتوفيق! 🚀✨**

---

## 📞 **تواصل معي:**

لو عندك أي مشكلة أو سؤال، اسألني في أي وقت! 😊
