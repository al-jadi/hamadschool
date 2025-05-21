// ملف إدارة الصلاحيات للمشرف
// هذا الملف يوفر وظائف إضافية لإدارة صلاحيات المشرف

document.addEventListener('DOMContentLoaded', function() {
    // التحقق من دور المستخدم وإظهار/إخفاء العناصر وفقًا للصلاحيات
    setupAdminPermissions();
});

// دالة إعداد صلاحيات المشرف
function setupAdminPermissions() {
    const user = getLocalUser();
    if (!user) return;

    // إظهار جميع عناصر القائمة للمشرف
    if (user.role === 'admin') {
        showAllMenuItems();
        enableAllAdminControls();
    } else {
        // إخفاء العناصر التي لا يملك المستخدم صلاحية الوصول إليها
        hideRestrictedMenuItems(user.role);
    }
}

// دالة لإظهار جميع عناصر القائمة للمشرف
function showAllMenuItems() {
    // إظهار جميع عناصر القائمة الجانبية
    document.querySelectorAll('.sidebar ul li').forEach(function(item) {
        item.style.display = 'block';
    });

    // إظهار جميع الروابط في القوائم المنسدلة
    document.querySelectorAll('.sidebar-dropdown-content a').forEach(function(link) {
        link.style.display = 'block';
    });

    // إضافة علامة "مشرف" بجانب اسم المستخدم
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
        usernameDisplay.innerHTML += ' <span class="admin-badge">مشرف</span>';
    }
}

// دالة لتمكين جميع عناصر التحكم الإدارية
function enableAllAdminControls() {
    // إظهار قسم أدوات المشرف في لوحة التحكم إذا كان موجودًا
    const adminControls = document.querySelector('.admin-controls');
    if (adminControls) {
        adminControls.style.display = 'block';
    }

    // تمكين جميع أزرار الإدارة
    document.querySelectorAll('.admin-action-btn').forEach(function(btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
    });
}

// دالة لإخفاء العناصر المقيدة بناءً على دور المستخدم
function hideRestrictedMenuItems(role) {
    const restrictedItems = {
        'administrative_supervisor': ['.admin-only'],
        'assistant_manager': ['.admin-only', '.supervisor-only'],
        'department_head': ['.admin-only', '.supervisor-only', '.assistant-only'],
        'teacher': ['.admin-only', '.supervisor-only', '.assistant-only', '.department-only'],
        'parent': ['.admin-only', '.supervisor-only', '.assistant-only', '.department-only', '.teacher-only']
    };

    // إخفاء العناصر المقيدة بناءً على دور المستخدم
    if (restrictedItems[role]) {
        restrictedItems[role].forEach(function(selector) {
            document.querySelectorAll(selector).forEach(function(item) {
                item.style.display = 'none';
            });
        });
    }

    // إخفاء قسم أدوات المشرف في لوحة التحكم إذا لم يكن المستخدم مشرفًا
    if (role !== 'admin') {
        const adminControls = document.querySelector('.admin-controls');
        if (adminControls) {
            adminControls.style.display = 'none';
        }
    }
}
