// ملف JavaScript للتعامل مع القائمة في الأجهزة المحمولة
document.addEventListener('DOMContentLoaded', function() {
    // إضافة زر القائمة للأجهزة المحمولة
    const header = document.querySelector('header');
    const mobileMenuButton = document.createElement('button');
    mobileMenuButton.className = 'mobile-menu-toggle';
    mobileMenuButton.innerHTML = '☰';
    mobileMenuButton.setAttribute('aria-label', 'فتح القائمة');
    header.appendChild(mobileMenuButton);
    
    // الحصول على الشريط الجانبي
    const sidebar = document.querySelector('.sidebar');
    
    // إضافة حدث النقر لزر القائمة
    mobileMenuButton.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        if (sidebar.classList.contains('active')) {
            mobileMenuButton.innerHTML = '✕';
            mobileMenuButton.setAttribute('aria-label', 'إغلاق القائمة');
        } else {
            mobileMenuButton.innerHTML = '☰';
            mobileMenuButton.setAttribute('aria-label', 'فتح القائمة');
        }
    });
    
    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', function(event) {
        if (!sidebar.contains(event.target) && event.target !== mobileMenuButton) {
            sidebar.classList.remove('active');
            mobileMenuButton.innerHTML = '☰';
            mobileMenuButton.setAttribute('aria-label', 'فتح القائمة');
        }
    });
    
    // إضافة وظيفة للروابط في الشريط الجانبي للأجهزة المحمولة
    const sidebarLinks = sidebar.querySelectorAll('a:not(.sidebar-dropdown > a)');
    sidebarLinks.forEach(function(link) {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                mobileMenuButton.innerHTML = '☰';
                mobileMenuButton.setAttribute('aria-label', 'فتح القائمة');
            }
        });
    });
    
    // تعديل سلوك القوائم المنسدلة في الشريط الجانبي للأجهزة المحمولة
    const dropdownMenus = document.querySelectorAll('.sidebar-dropdown > a');
    dropdownMenus.forEach(function(menu) {
        menu.addEventListener('click', function(event) {
            if (window.innerWidth <= 768) {
                event.preventDefault();
                this.parentElement.classList.toggle('active');
            }
        });
    });
});
