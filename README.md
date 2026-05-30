# 🎓 E-Tracks - منصة التعليم الإلكتروني

منصة تعليمية متكاملة مبنية بـ Node.js و Express مع Supabase

## 🚀 الميزات

- ✅ نظام مصادقة كامل (JWT)
- ✅ إدارة الكورسات والطلاب
- ✅ Classroom تفاعلي
- ✅ لوحة تحكم للمدرسين والطلاب
- ✅ نظام نسخ احتياطي تلقائي
- ✅ حماية CSRF و XSS
- ✅ Rate limiting

## 🛠️ التقنيات المستخدمة

- **Backend:** Node.js, Express.js
- **Database:** Supabase (PostgreSQL)
- **Template Engine:** EJS
- **Authentication:** JWT
- **Security:** Helmet, CSRF, XSS Protection

## 📦 التثبيت المحلي

```bash
# استنساخ المشروع
git clone https://github.com/omar-ahmed87/etracks.git
cd etracks

# تثبيت المكتبات
npm install

# نسخ ملف البيئة
cp .env.example .env

# تعديل ملف .env بالقيم الصحيحة
# ثم تشغيل المشروع
npm start
```

## 🌐 النشر

### Railway (موصى به - مجاني)
اتبع الدليل في: [RAILWAY_DEPLOYMENT_GUIDE.md](./RAILWAY_DEPLOYMENT_GUIDE.md)

### Render
اتبع الدليل في: [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md)

## 📝 المتغيرات البيئية

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your_jwt_secret
JWT_ISSUER=etracks
JWT_AUDIENCE=etracks-users
JWT_EXPIRATION=7d
AUTH_COOKIE_NAME=authToken
BACKUP_SECRET=your_backup_secret
```

## 🔒 الأمان

- CSRF Protection
- XSS Protection
- Rate Limiting
- Helmet Security Headers
- Secure Cookies
- Input Sanitization

## 📄 الترخيص

ISC

## 👨‍💻 المطور

Omar Ahmed
