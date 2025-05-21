#!/bin/bash

echo "بدء تثبيت نظام إدارة المدرسة..."

# التحقق من وجود Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js غير مثبت. يرجى تثبيت Node.js قبل المتابعة."
    exit 1
fi

# التحقق من وجود npm
if ! command -v npm &> /dev/null; then
    echo "npm غير مثبت. يرجى تثبيت npm قبل المتابعة."
    exit 1
fi

# التحقق من وجود MySQL
if ! command -v mysql &> /dev/null; then
    echo "MySQL غير مثبت. يرجى تثبيت MySQL قبل المتابعة."
    exit 1
fi

# تثبيت تبعيات الواجهة الخلفية
echo "تثبيت تبعيات الواجهة الخلفية..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "فشل في تثبيت تبعيات الواجهة الخلفية."
    exit 1
fi

# إعداد ملف البيئة
if [ ! -f .env ]; then
    echo "إنشاء ملف .env..."
    cp .env.example .env
    echo "يرجى تعديل ملف .env بإعدادات قاعدة البيانات الخاصة بك."
fi

cd ..

# تثبيت تبعيات الواجهة الأمامية
echo "تثبيت تبعيات الواجهة الأمامية..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "فشل في تثبيت تبعيات الواجهة الأمامية."
    exit 1
fi

cd ..

echo "اكتمل التثبيت بنجاح!"
echo "لتشغيل الواجهة الخلفية: cd backend && npm start"
echo "لتشغيل الواجهة الأمامية: cd frontend && npm start"
echo "لا تنس إعداد قاعدة البيانات باستخدام ملف database/schema.sql"
