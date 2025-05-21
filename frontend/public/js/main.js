// الوظائف الرئيسية للنظام
document.addEventListener('DOMContentLoaded', function() {
  // تهيئة النظام
  initializeSystem();
  
  // إضافة مستمعي الأحداث
  setupEventListeners();
});

// تهيئة النظام
function initializeSystem() {
  // التحقق من وجود رمز المصادقة
  const token = localStorage.getItem('token');
  const currentPage = window.location.pathname.split('/').pop();
  
  // إذا لم يكن هناك رمز مصادقة وليست صفحة تسجيل الدخول أو التسجيل أو نسيت كلمة المرور
  if (!token && 
      currentPage !== 'index.html' && 
      currentPage !== 'register.html' && 
      currentPage !== 'forgot-password.html') {
    // توجيه المستخدم إلى صفحة تسجيل الدخول
    window.location.href = 'index.html';
    return;
  }
  
  // تحديد العنصر النشط في القائمة الجانبية
  setActiveMenuItem();
  
  // تحميل معلومات المستخدم
  loadUserInfo();
  
  // تحميل إعدادات المدرسة
  loadSchoolSettings();
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
  // مستمع حدث تسجيل الخروج
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }
  
  // مستمعي أحداث النماذج
  setupFormListeners();
}

// تحديد العنصر النشط في القائمة الجانبية
function setActiveMenuItem() {
  const currentPage = window.location.pathname.split('/').pop();
  const menuItems = document.querySelectorAll('.sidebar ul li');
  
  menuItems.forEach(item => {
    item.classList.remove('active');
    const link = item.querySelector('a');
    if (link && link.getAttribute('href') === currentPage) {
      item.classList.add('active');
    }
  });
}

// تحميل معلومات المستخدم
function loadUserInfo() {
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  const userNameElement = document.querySelector('.user-name');
  
  if (userNameElement && userInfo.full_name) {
    userNameElement.textContent = `مرحباً، ${userInfo.full_name}`;
  }
}

// تحميل إعدادات المدرسة
function loadSchoolSettings() {
  // في التطبيق الحقيقي، يجب استدعاء واجهة برمجة التطبيقات للحصول على إعدادات المدرسة
  // هنا نستخدم إعدادات افتراضية للعرض
  const schoolSettings = {
    school_name: 'المدرسة النموذجية',
    primary_color: '#3498db',
    secondary_color: '#2ecc71',
    accent_color: '#e74c3c'
  };
  
  // تطبيق إعدادات الألوان
  document.documentElement.style.setProperty('--primary-color', schoolSettings.primary_color);
  document.documentElement.style.setProperty('--secondary-color', schoolSettings.secondary_color);
  document.documentElement.style.setProperty('--accent-color', schoolSettings.accent_color);
  
  // تحديث عنوان المدرسة في القائمة الجانبية
  const schoolNameElement = document.querySelector('.sidebar-header h3');
  if (schoolNameElement) {
    schoolNameElement.textContent = schoolSettings.school_name;
  }
}

// إعداد مستمعي أحداث النماذج
function setupFormListeners() {
  // نموذج تسجيل الدخول
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      login();
    });
  }
  
  // نموذج التسجيل
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      register();
    });
  }
  
  // نموذج نسيت كلمة المرور
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', function(e) {
      e.preventDefault();
      forgotPassword();
    });
  }
}

// تسجيل الدخول
function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  // في التطبيق الحقيقي، يجب إرسال طلب إلى الخادم للتحقق من بيانات الاعتماد
  // هنا نقوم بمحاكاة استجابة ناجحة
  
  // تخزين رمز المصادقة ومعلومات المستخدم
  localStorage.setItem('token', 'sample_token');
  localStorage.setItem('user', JSON.stringify({
    id: 1,
    full_name: 'مشرف النظام',
    email: email,
    role: 'admin'
  }));
  
  // توجيه المستخدم إلى لوحة التحكم
  window.location.href = 'dashboard.html';
}

// تسجيل حساب جديد
function register() {
  const full_name = document.getElementById('full_name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  
  // في التطبيق الحقيقي، يجب إرسال طلب إلى الخادم لإنشاء طلب تسجيل جديد
  
  // عرض رسالة نجاح
  alert('تم إرسال طلب التسجيل بنجاح وينتظر موافقة المشرف');
  
  // توجيه المستخدم إلى صفحة تسجيل الدخول
  window.location.href = 'index.html';
}

// نسيت كلمة المرور
function forgotPassword() {
  const email = document.getElementById('email').value;
  
  // في التطبيق الحقيقي، يجب إرسال طلب إلى الخادم لإرسال رابط إعادة تعيين كلمة المرور
  
  // عرض رسالة نجاح
  alert('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
  
  // توجيه المستخدم إلى صفحة تسجيل الدخول
  window.location.href = 'index.html';
}

// تسجيل الخروج
function logout() {
  // حذف رمز المصادقة ومعلومات المستخدم
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // توجيه المستخدم إلى صفحة تسجيل الدخول
  window.location.href = 'index.html';
}

// دالة مساعدة لإنشاء طلبات HTTP
async function fetchAPI(url, method = 'GET', data = null) {
  const token = localStorage.getItem('token');
  
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      // التحقق من انتهاء صلاحية الرمز
      if (response.status === 401) {
        logout();
        throw new Error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى');
      }
      
      const errorData = await response.json();
      throw new Error(errorData.message || 'حدث خطأ أثناء معالجة الطلب');
    }
    
    return await response.json();
  } catch (error) {
    console.error('خطأ في طلب API:', error);
    throw error;
  }
}

// دالة مساعدة لعرض رسائل الخطأ
function showError(message) {
  alert(message);
}

// دالة مساعدة لعرض رسائل النجاح
function showSuccess(message) {
  alert(message);
}
