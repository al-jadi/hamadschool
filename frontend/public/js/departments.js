// departments.js - Handles Department Management page logic

document.addEventListener("DOMContentLoaded", () => {
    const departmentsTableBody = document.getElementById("departments-table-body");
    const addDepartmentBtn = document.querySelector(".add-department-btn");
    const departmentModal = new bootstrap.Modal(document.getElementById("department-modal"));
    const departmentModalForm = document.getElementById("department-modal-form");
    const departmentModalTitle = document.getElementById("department-modal-title");
    const departmentIdInput = document.getElementById("department-id");
    const departmentNameInput = document.getElementById("department-name");
    const departmentHeadSelect = document.getElementById("department-head");

    const currentUser = getCurrentUser(); // From local-auth.js
    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }

    // Apply role-based UI restrictions
    applyPermissions(currentUser.role);

    // --- Function to fetch and display departments ---
    async function fetchAndDisplayDepartments() {
        departmentsTableBody.innerHTML = 
            `<tr><td colspan="3" class="text-center">جارٍ تحميل الأقسام...</td></tr>`;
        try {
            const departments = await apiRequest("departments");

            if (departments.length === 0) {
                departmentsTableBody.innerHTML = 
                    `<tr><td colspan="3" class="text-center">لا توجد أقسام لعرضها.</td></tr>`;
                return;
            }

            departmentsTableBody.innerHTML = ""; // Clear loading message
            departments.forEach(dept => {
                const row = createDepartmentRow(dept);
                departmentsTableBody.appendChild(row);
            });
        } catch (error) {
            console.error("Error fetching departments:", error);
            departmentsTableBody.innerHTML = 
                `<tr><td colspan="3" class="text-center text-danger">حدث خطأ أثناء تحميل الأقسام.</td></tr>`;
        }
    }

    // --- Function to create a department table row element ---
    function createDepartmentRow(department) {
        const row = document.createElement("tr");
        row.dataset.id = department.id;

        let actionsHtml = "";
        // Only admins can edit/delete departments
        if (isAdminRole(currentUser.role)) {
            actionsHtml = `
                <button class="btn btn-sm btn-outline-primary edit-btn">تعديل</button>
                <button class="btn btn-sm btn-outline-danger delete-btn">حذف</button>
            `;
        }

        row.innerHTML = `
            <td>${department.name}</td>
            <td>${department.head_name || "-- لا يوجد --"}</td>
            <td>${actionsHtml}</td>
        `;

        // Add event listeners for buttons
        const editBtn = row.querySelector(".edit-btn");
        const deleteBtn = row.querySelector(".delete-btn");

        if (editBtn) {
            editBtn.addEventListener("click", () => openEditModal(department));
        }
        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => handleDeleteDepartment(department.id));
        }

        return row;
    }

    // --- Function to load potential department heads into dropdown ---
    async function loadPotentialHeads() {
        try {
            // Fetch users who can be heads (e.g., teachers, admins)
            // Adjust roles as needed
            const users = await apiRequest("users?roles=teacher,department_head,admin_supervisor,assistant_manager,system_admin");
            departmentHeadSelect.innerHTML = 
                `<option value="">-- لا يوجد --</option>`; // Reset
            users.forEach(user => {
                // Avoid listing parents or students if they exist in the users table
                if (user.role_name !== 'parent' && user.role_name !== 'student') {
                    const option = document.createElement("option");
                    option.value = user.id;
                    option.textContent = `${user.name} (${user.role_name})`;
                    departmentHeadSelect.appendChild(option);
                }
            });
        } catch (error) {
            console.error("Error loading potential heads:", error);
            // Handle error display if needed
        }
    }

    // --- Function to open the modal for adding/editing ---
    function openEditModal(department) {
        departmentModalForm.reset(); // Clear previous data
        if (department) {
            // Editing existing department
            departmentModalTitle.textContent = "تعديل قسم";
            departmentIdInput.value = department.id;
            departmentNameInput.value = department.name;
            // Set the selected head, handle case where head_user_id might be null
            departmentHeadSelect.value = department.head_user_id || "";
        } else {
            // Adding new department
            departmentModalTitle.textContent = "إضافة قسم جديد";
            departmentIdInput.value = ""; // Ensure ID is empty
            departmentHeadSelect.value = ""; // Default to no head
        }
        departmentModal.show();
    }

    // --- Handle form submission for add/edit ---
    departmentModalForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const departmentId = departmentIdInput.value;
        const isEditing = !!departmentId;

        const departmentData = {
            name: departmentNameInput.value,
            head_user_id: departmentHeadSelect.value || null // Send null if no head is selected
        };

        try {
            let result;
            if (isEditing) {
                result = await apiRequest(`departments/${departmentId}`, "PUT", departmentData);
            } else {
                result = await apiRequest("departments", "POST", departmentData);
            }
            departmentModal.hide();
            await fetchAndDisplayDepartments(); // Refresh the list
            await loadPotentialHeads(); // Refresh heads list in case a user became a head
            showToast("نجاح", `تم ${isEditing ? "تعديل" : "إنشاء"} القسم بنجاح.`);
        } catch (error) {
            console.error(`Error ${isEditing ? "updating" : "creating"} department:`, error);
            let errorMsg = `فشل ${isEditing ? "تعديل" : "إنشاء"} القسم.`;
            if (error.message && error.message.includes('unique constraint')) {
                errorMsg = "فشل العملية. قد يكون اسم القسم مستخدمًا بالفعل أو المستخدم المحدد هو رئيس لقسم آخر.";
            }
            showToast("خطأ", errorMsg, "error");
        }
    });

    // --- Handle department deletion ---
    async function handleDeleteDepartment(departmentId) {
        if (!confirm("هل أنت متأكد من رغبتك في حذف هذا القسم؟ سيؤدي هذا إلى إزالة ارتباط المستخدمين والمواد الدراسية بهذا القسم. لا يمكن التراجع عن هذا الإجراء.")) {
            return;
        }

        try {
            await apiRequest(`departments/${departmentId}`, "DELETE");
            await fetchAndDisplayDepartments(); // Refresh the list
            await loadPotentialHeads(); // Refresh heads list
            showToast("نجاح", "تم حذف القسم بنجاح.");
        } catch (error) {
            console.error("Error deleting department:", error);
            showToast("خطأ", "فشل حذف القسم. قد يكون القسم مرتبطًا ببيانات أخرى.", "error");
        }
    }

    // --- Helper Function ---
    function isAdminRole(role) {
        // Define roles that can manage departments
        return ["system_admin", "assistant_manager"].includes(role);
    }

    // --- Event Listeners ---
    if (addDepartmentBtn) {
        addDepartmentBtn.addEventListener("click", () => openEditModal(null));
    }

    // --- Initial Load ---
    if (isAdminRole(currentUser.role)) {
        loadPotentialHeads(); // Load heads only if user can potentially assign them
    }
    fetchAndDisplayDepartments();
});

