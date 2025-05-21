// JavaScript for User Management Page (using API)

document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkAuthStatus(); // Check authentication and get user details
    if (!user) return;

    // Update UI elements based on user role
    updateUserUIBasedOnRole(user);

    // Remove the static demo notice if it exists (should have been removed earlier)
    const demoNotice = document.querySelector(".demo-notice");
    if (demoNotice) {
        demoNotice.remove();
    }

    // Check if the user has permission to view this page
    // System Admin, Assistant Manager, and Department Head can view users
    if (!checkUserRole(["system_admin", "assistant_manager", "department_head"])) {
        displayPermissionError();
        return;
    }

    // Add event listeners and load initial data
    setupEventListeners(user);
    loadUsers(user);
});

function displayPermissionError() {
    const mainContent = document.querySelector(".main-content");
    mainContent.innerHTML = `<div class="alert alert-danger">ليس لديك الصلاحية لعرض هذه الصفحة.</div>`;
}

let allUsersData = []; // Store fetched users

async function loadUsers(currentUser, filters = {}) {
    const usersTableBody = document.querySelector(".users-table tbody");
    if (!usersTableBody) return;

    usersTableBody.innerHTML = 
        `<tr><td colspan="6" class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> جارٍ تحميل المستخدمين...</td></tr>`;

    try {
        // Add role filter from dropdown if selected
        const roleFilter = document.getElementById("role-filter").value;
        if (roleFilter && roleFilter !== "all") {
            filters.role = roleFilter;
        }
        
        // Department Heads should only see their department's teachers by default
        // Backend API handles this filtering based on the authenticated user's token/role
        // No explicit department filter needed here unless admin wants to filter

        // Fetch users from API
        allUsersData = await api.getAllUsers(filters); // Backend filters based on user role
        renderUsersTable(allUsersData, usersTableBody, currentUser);

    } catch (error) {
        console.error("Error loading users:", error);
        usersTableBody.innerHTML = 
            `<tr><td colspan="6" class="text-center text-danger">حدث خطأ أثناء تحميل المستخدمين: ${error.message}</td></tr>`;
    }
}

function renderUsersTable(users, tableBody, currentUser) {
    tableBody.innerHTML = ""; // Clear loading state or previous data

    if (users.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center">لا يوجد مستخدمون لعرضهم.</td></tr>`;
        return;
    }

    // Define role map for display
    const roleMap = {
        "system_admin": "مشرف النظام",
        "assistant_manager": "مدير مساعد",
        "admin_supervisor": "مشرف إداري",
        "department_head": "رئيس قسم",
        "teacher": "معلم",
        "parent": "ولي أمر"
    };

    users.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHTML(user.name || "-")}</td>
            <td>${escapeHTML(user.email || "-")}</td>
            <td>${roleMap[user.role_name] || escapeHTML(user.role_name || "-")}</td>
            <td>${user.department_name || "-"}</td> <!-- Display department name -->
            <td>${user.created_at ? new Date(user.created_at).toLocaleDateString("ar-EG") : "-"}</td>
            <td>${user.is_active ? "نشط" : "غير نشط"}</td>
            <td>
                <div class="action-buttons"></div>
            </td>
        `;

        const actionButtonsContainer = tr.querySelector(".action-buttons");

        // Determine which actions are allowed based on current user's role and target user's role/department
        const canEdit = (currentUser.role === "system_admin") || 
                        (currentUser.role === "assistant_manager") || 
                        (currentUser.role === "department_head" && user.role_name === "teacher" /* && user.department_id === currentUser.departmentId - Backend enforces this */);
        
        const canDelete = (currentUser.role === "system_admin"); // Only system admin can delete

        if (canEdit) {
            const editButton = document.createElement("button");
            editButton.className = "btn btn-sm btn-primary edit-btn";
            editButton.textContent = "تعديل";
            editButton.onclick = () => handleEditUser(user, currentUser); // Pass currentUser for permission checks in modal
            actionButtonsContainer.appendChild(editButton);
        }

        if (canDelete) {
            const deleteButton = document.createElement("button");
            deleteButton.className = "btn btn-sm btn-danger delete-btn";
            deleteButton.textContent = "حذف";
            deleteButton.onclick = () => handleDeleteUser(user, currentUser);
            actionButtonsContainer.appendChild(deleteButton);
        }
        
        // Add other actions if needed (e.g., assign department for admins)

        tableBody.appendChild(tr);
    });
}

function setupEventListeners(currentUser) {
    const addUserBtn = document.querySelector(".add-user-btn");
    const roleFilter = document.getElementById("role-filter");

    // Show/Hide Add button based on role (Only System Admin and Assistant Manager can add users)
    if (addUserBtn) {
        if (checkUserRole(["system_admin", "assistant_manager"])) {
            addUserBtn.style.display = ""; // Show button
            addUserBtn.addEventListener("click", () => handleAddUser(currentUser));
        } else {
            addUserBtn.style.display = "none"; // Hide button
        }
    }

    // Role filter listener
    if (roleFilter) {
        roleFilter.addEventListener("change", () => loadUsers(currentUser));
    }

    // Event listener for the Add/Edit User Modal form submission
    const userModalForm = document.getElementById("user-modal-form");
    if (userModalForm) {
        userModalForm.addEventListener("submit", (event) => handleUserFormSubmit(event, currentUser));
    }
}

// --- Modal Handling --- 

const userModalElement = document.getElementById("user-modal");
const userModal = userModalElement ? new bootstrap.Modal(userModalElement) : null;
const userModalTitle = document.getElementById("user-modal-title");
const userModalForm = document.getElementById("user-modal-form");
const userIdInput = document.getElementById("user-id");
const userNameInput = document.getElementById("user-name");
const userEmailInput = document.getElementById("user-email");
const userPasswordInput = document.getElementById("user-password");
const userRoleSelect = document.getElementById("user-role");
const userDepartmentSelect = document.getElementById("user-department");
const userIsActiveCheckbox = document.getElementById("user-is-active");
const passwordHelpBlock = document.getElementById("password-help-block");

async function populateRolesAndDepartments(currentUser) {
    try {
        const roles = await api.getAllRoles(); // Assuming an API endpoint exists
        const departments = await api.getAllDepartments(); // Assuming an API endpoint exists

        userRoleSelect.innerHTML = 
            `<option value="" disabled selected>اختر الدور...</option>` + 
            roles.map(role => `<option value="${role.id}">${roleMap[role.name] || role.name}</option>`).join("");

        userDepartmentSelect.innerHTML = 
            `<option value="">-- لا يوجد --</option>` + // Allow unassigned
            departments.map(dept => `<option value="${dept.id}">${escapeHTML(dept.name)}</option>`).join("");
        
        // Disable role/department selection if user is Dept Head (can only manage teachers in their dept)
        if (currentUser.role === 'department_head') {
            userRoleSelect.value = roles.find(r => r.name === 'teacher')?.id || '';
            userRoleSelect.disabled = true;
            userDepartmentSelect.value = currentUser.departmentId || ''; // Assuming departmentId is in currentUser
            userDepartmentSelect.disabled = true;
        } else {
            userRoleSelect.disabled = false;
            userDepartmentSelect.disabled = false;
        }

    } catch (error) {
        console.error("Error populating roles/departments:", error);
        // Handle error display if needed
    }
}

function openUserModal(userData = null, currentUser) {
    if (!userModal) return;
    userModalForm.reset(); // Clear previous data
    userIdInput.value = "";
    passwordHelpBlock.textContent = userData ? "اتركه فارغًا لعدم تغيير كلمة المرور." : "مطلوب عند إنشاء مستخدم جديد.";
    userPasswordInput.required = !userData; // Password required only for new users

    populateRolesAndDepartments(currentUser); // Populate dropdowns dynamically

    if (userData) {
        // Edit mode
        userModalTitle.textContent = "تعديل مستخدم";
        userIdInput.value = userData.id;
        userNameInput.value = userData.name;
        userEmailInput.value = userData.email;
        userRoleSelect.value = userData.role_id; // Assuming role_id is available
        userDepartmentSelect.value = userData.department_id || ""; // Handle null department
        userIsActiveCheckbox.checked = userData.is_active;
    } else {
        // Add mode
        userModalTitle.textContent = "إضافة مستخدم جديد";
    }
    
    userModal.show();
}

function handleAddUser(currentUser) {
    openUserModal(null, currentUser);
}

function handleEditUser(user, currentUser) {
    openUserModal(user, currentUser);
}

async function handleUserFormSubmit(event, currentUser) {
    event.preventDefault();
    if (!userModal) return;

    const userId = userIdInput.value;
    const isEditMode = !!userId;

    const userData = {
        name: userNameInput.value,
        email: userEmailInput.value,
        role_id: parseInt(userRoleSelect.value, 10),
        department_id: userDepartmentSelect.value ? parseInt(userDepartmentSelect.value, 10) : null,
        is_active: userIsActiveCheckbox.checked
    };

    // Only include password if provided (and required for add mode)
    if (userPasswordInput.value || !isEditMode) {
        userData.password = userPasswordInput.value;
    }

    // Basic validation (more robust validation is recommended)
    if (!userData.name || !userData.email || !userData.role_id || (!isEditMode && !userData.password)) {
        alert("يرجى ملء جميع الحقول المطلوبة.");
        return;
    }

    try {
        if (isEditMode) {
            // Edit User
            await api.updateUser(userId, userData);
            alert("تم تحديث المستخدم بنجاح.");
        } else {
            // Add User
            await api.createUser(userData);
            alert("تم إضافة المستخدم بنجاح.");
        }
        userModal.hide();
        loadUsers(currentUser); // Reload the user list
    } catch (error) {
        console.error("Error saving user:", error);
        alert(`فشل حفظ المستخدم: ${error.message}`);
    }
}

async function handleDeleteUser(user, currentUser) {
    console.log("Delete User button clicked for:", user);
    // Double-check permission (although button visibility should handle this)
    if (currentUser.role !== "system_admin") {
        alert("ليس لديك الصلاحية لحذف المستخدمين.");
        return;
    }
    if (confirm(`هل أنت متأكد من رغبتك في حذف المستخدم ${user.name} (${user.email})؟ لا يمكن التراجع عن هذا الإجراء.`)) {
        try {
            await api.deleteUser(user.id);
            alert("تم حذف المستخدم بنجاح.");
            loadUsers(currentUser); // Reload the user list
        } catch (error) {
            console.error("Error deleting user:", error);
            alert(`فشل حذف المستخدم: ${error.message}`);
        }
    }
}

// Helper function to escape HTML special characters
function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"]/g, function (s) { // Removed ' and / for simplicity, adjust if needed
        const entityMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '&quot;'
        };
        return entityMap[s];
    });
}

// Role map used in multiple places
const roleMap = {
    "system_admin": "مشرف النظام",
    "assistant_manager": "مدير مساعد",
    "admin_supervisor": "مشرف إداري",
    "department_head": "رئيس قسم",
    "teacher": "معلم",
    "parent": "ولي أمر"
};

// Assume checkAuthStatus() in main.js or similar populates currentUser correctly
// Assume api.js has functions: getAllUsers(filters), createUser(data), updateUser(id, data), deleteUser(id), getAllRoles(), getAllDepartments()

