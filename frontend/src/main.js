// إعداد ملف التكوين الرئيسي للواجهة الأمامية
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import router from './router'
import './styles/main.scss'
import ar from './locales/ar.json'

// إعداد الترجمة
const i18n = createI18n({
  legacy: false,
  locale: 'ar',
  fallbackLocale: 'ar',
  messages: {
    ar
  }
})

// إنشاء تطبيق Vue
const app = createApp(App)

// استخدام الإضافات
app.use(createPinia())
app.use(router)
app.use(i18n)

// تركيب التطبيق
app.mount('#app')
