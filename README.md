# نظام إدارة المدرسة - النسخة الكاملة (مع ميزات إضافية)

هذا المستودع يحتوي على الكود المصدري لنظام إدارة المدرسة الكامل، بما في ذلك الواجهة الأمامية (Frontend)، الواجهة الخلفية (Backend)، ومخطط قاعدة البيانات. تم تحديث هذه النسخة لتشمل ميزات جديدة بناءً على طلب المستخدم.

## الميزات الجديدة المضافة

*   **إدارة الأقسام:** إنشاء وتعديل الأقسام، تعيين رؤساء الأقسام، إدارة ملفات القسم (رفع، عرض، حذف).
*   **إدارة المواد الدراسية:** إنشاء وتعديل المواد وربطها بالأقسام.
*   **إدارة الفترات الزمنية:** تحديد أيام وأوقات الحصص الدراسية.
*   **إدارة جداول الحصص الدراسية:** إنشاء وتعديل جداول الحصص للفصول والمعلمين.
*   **تبديل الحصص:** آلية لطلب تبديل الحصص بين المعلمين مع نظام موافقة متعدد الخطوات (موافقة المعلم المستهدف ثم موافقة المدير المساعد/رئيس القسم).
*   **نشرات الأقسام الداخلية:** إنشاء نشرات خاصة بكل قسم، إرسالها للموافقة (من قبل رئيس القسم)، الموافقة عليها (من قبل المدير المساعد أو رئيس القسم)، وتتبع إقرار المعلمين بالعلم.
*   **نشرات أولياء الأمور:** إنشاء نشرات عامة أو خاصة بفصول معينة (مثل جداول الفصول والاختبارات)، والموافقة عليها (من قبل المدير المساعد أو مشرف النظام) لنشرها لأولياء الأمور.
*   **تحديث صلاحيات رئيس القسم:** يحصل رئيس القسم الآن على جميع صلاحيات المعلم بالإضافة إلى صلاحياته الخاصة بإدارة القسم والموافقات.

## المتطلبات الأساسية

*   Node.js (الإصدار 18 أو أحدث)
*   npm (عادةً ما يأتي مع Node.js)
*   PostgreSQL (الإصدار 14 أو أحدث)

## إعداد قاعدة البيانات (PostgreSQL)

1.  **تثبيت PostgreSQL:** قم بتثبيت PostgreSQL إذا لم يكن مثبتًا بالفعل على نظامك.
2.  **إنشاء قاعدة بيانات ومستخدم:**
    *   قم بتسجيل الدخول إلى psql كمسؤول (عادةً `postgres`):
        ```bash
        sudo -u postgres psql
        ```
    *   قم بتنفيذ الأوامر التالية لإنشاء قاعدة البيانات والمستخدم ومنحه الصلاحيات (استبدل `school_password` بكلمة مرور قوية):
        ```sql
        CREATE DATABASE school_db;
        CREATE USER school_user WITH PASSWORD "school_password";
        GRANT ALL PRIVILEGES ON DATABASE school_db TO school_user;
        \q
        ```
3.  **تطبيق مخطط قاعدة البيانات:**
    *   انتقل إلى مجلد المشروع.
    *   قم بتنفيذ الأمر التالي لتطبيق المخطط المحدث (يتضمن جداول الميزات الجديدة):
        ```bash
        export PGPASSWORD="school_password"
        psql -U school_user -d school_db -h localhost -f database/schema.sql
        unset PGPASSWORD
        ```
4.  **تعبئة بيانات الاختبار (اختياري):**
    *   لتعبئة قاعدة البيانات ببيانات تجريبية (مستخدمين، طلاب، إلخ). **ملاحظة:** ملف `seed.sql` الحالي قد لا يتضمن بيانات للميزات الجديدة (مثل الأقسام، الجداول، إلخ). قد تحتاج إلى إضافة بيانات يدوياً أو تحديث ملف `seed.sql`.
        ```bash
        export PGPASSWORD="school_password"
        psql -U school_user -d school_db -h localhost -f database/seed_double_quotes.sql
        unset PGPASSWORD
        ```

## إعداد الواجهة الخلفية (Backend)

1.  **الانتقال إلى مجلد الواجهة الخلفية:**
    ```bash
    cd backend
    ```
2.  **تثبيت الاعتماديات:** (تأكد من تثبيت `uuid` إذا لم يكن موجوداً)
    ```bash
    npm install
    ```
3.  **إعداد متغيرات البيئة:**
    *   انسخ ملف `.env.example` إلى `.env`:
        ```bash
        cp .env.example .env
        ```
    *   قم بتحرير ملف `.env` وتحديث قيم متغيرات البيئة، خاصة تفاصيل الاتصال بقاعدة البيانات (`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`) والمفتاح السري لـ JWT (`JWT_SECRET`). استخدم كلمة المرور التي أنشأتها لقاعدة البيانات.
        ```dotenv
        PORT=5000
        DB_USER=school_user
        DB_HOST=localhost
        DB_DATABASE=school_db
        DB_PASSWORD=school_password
        DB_PORT=5432
        JWT_SECRET=your_very_strong_jwt_secret_key # استبدل هذا بمفتاح سري قوي
        ```
4.  **إنشاء مجلدات الرفع:** تتطلب ميزات النشرات و ملفات الأقسام وجود مجلدات لتخزين المرفقات. تأكد من أن الخادم لديه صلاحية الكتابة في هذه المسارات (سيتم إنشاؤها تلقائيًا عند أول عملية رفع إذا كانت الصلاحيات متوفرة):
    *   `backend/uploads/bulletins/department`
    *   `backend/uploads/bulletins/parent`
    *   `backend/uploads/departments` (أو المسار المحدد في `departmentController.js`)
5.  **تشغيل الخادم الخلفي:**
    ```bash
    node server.js
    ```
    *   يجب أن يعمل الخادم الآن على المنفذ المحدد في ملف `.env` (الافتراضي 5000).

## إعداد الواجهة الأمامية (Frontend)

1.  **تكوين الاتصال بالواجهة الخلفية:**
    *   تأكد من أن ملف `frontend/public/js/config.js` يشير إلى عنوان URL الصحيح للخادم الخلفي (الافتراضي هو `http://localhost:5000/api`). إذا قمت بتغيير المنفذ أو عنوان الخادم، قم بتحديث هذا الملف.
        ```javascript
        // frontend/public/js/config.js
        const config = {
            API_BASE_URL: "http://localhost:5000/api" // تأكد من صحة هذا العنوان
        };
        ```
2.  **تضمين ملفات JavaScript الجديدة:** تأكد من أن صفحات HTML ذات الصلة (مثل صفحة الإدارة، صفحة المعلم، إلخ) تتضمن الآن ملفات JavaScript الجديدة المطلوبة للميزات الجديدة:
    *   `<script src="js/departments.js"></script>`
    *   `<script src="js/subjects.js"></script>`
    *   `<script src="js/timeSlots.js"></script>`
    *   `<script src="js/classSchedules.js"></script>`
    *   `<script src="js/departmentBulletins.js"></script>`
    *   `<script src="js/parentBulletins.js"></script>`
    (بالإضافة إلى `api.js` و `config.js` والملفات الأخرى الموجودة).
3.  **فتح الواجهة الأمامية:**
    *   يمكنك فتح ملفات HTML مباشرة في متصفحك (مثل `frontend/public/index.html`).
    *   للحصول على أفضل تجربة، يفضل تشغيل خادم ويب بسيط لخدمة الملفات الثابتة من مجلد `frontend/public`. يمكنك استخدام أدوات مثل `http-server` (يتطلب `npm install -g http-server`).
        ```bash
        cd frontend/public
        http-server -p 8080
        ```
        *   ثم افتح `http://localhost:8080` في متصفحك.

## بيانات تسجيل الدخول التجريبية (إذا تم استخدام seed.sql)

*   **مشرف النظام:** `admin@example.com` / `admin123`
*   **مدير مساعد:** `assistant@example.com` / `assistant123`
*   **مشرف إداري:** `supervisor@example.com` / `supervisor123`
*   **رئيس قسم (مثال):** (إذا تم تعيين معلم كرئيس قسم) `teacher@example.com` / `teacher123`
*   **معلم:** `teacher@example.com` / `teacher123`
*   **ولي أمر:** `parent@example.com` / `parent123` (مربوط بالطالب `Student Alpha`)

## ملاحظات

*   تأكد من أن خدمة PostgreSQL تعمل قبل تشغيل الواجهة الخلفية.
*   استبدل `school_password` و `your_very_strong_jwt_secret_key` بقيم آمنة في بيئة الإنتاج.
*   قد تحتاج الواجهة الأمامية إلى إضافة عناصر HTML جديدة (أزرار، جداول، نماذج، قوائم منسدلة) في الصفحات المناسبة لتفعيل واجهات المستخدم للميزات الجديدة التي تم ربطها بملفات JavaScript.
"# hamadschool" 
