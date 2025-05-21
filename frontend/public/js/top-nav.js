// JavaScript للقائمة العلوية
document.addEventListener('DOMContentLoaded', function() {
  // تحديد الصفحة النشطة في القائمة العلوية
  const currentPage = window.location.pathname.split('/').pop();
  const topNavLinks = document.querySelectorAll('.top-nav-menu a');
  
  topNavLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || 
        (currentPage === '' && href === 'dashboard.html') || 
        (currentPage === 'index.html' && href === 'dashboard.html')) {
      link.classList.add('active');
    }
  });
  
  // إضافة وظيفة تسجيل الخروج
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', function(e) {
      e.preventDefault();
      // استدعاء دالة تسجيل الخروج من ملف local-auth.js
      if (typeof logoutUser === 'function') {
        logoutUser();
      } else {
        window.location.href = 'index.html';
      }
    });
  }
  
  // عرض اسم المستخدم
  const usernameDisplay = document.getElementById('username-display');
  if (usernameDisplay) {
    // استخدام البيانات من local-auth.js إذا كانت متوفرة
    if (typeof getCurrentUser === 'function') {
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.name) {
        usernameDisplay.textContent = currentUser.name;
      }
    }
  }
});
