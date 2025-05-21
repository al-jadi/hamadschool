// departmentBulletins.js - Handles department bulletin management

document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkAuthStatus();
    if (!user) return;
    updateUserUIBasedOnRole(user);

    // Check if we are on the department bulletins page
    const bulletinsContainer = document.getElementById("bulletins-list");
    if (!bulletinsContainer) return;

    // Check permissions
    if (!checkUserRole(["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher"])) {
        displayPermissionError(bulletinsContainer);
        return;
    }

    // DOM elements
    const addBulletinBtn = document.querySelector(".add-bulletin-btn");
    const bulletinModalElement = document.getElementById("bulletin-modal");
    const bulletinModal = bulletinModalElement ? new bootstrap.Modal(bulletinModalElement) : null;
    const bulletinForm = document.getElementById("bulletin-modal-form");
    const bulletinIdInput = document.getElementById("bulletin-id");
    const bulletinTitleInput = document.getElementById("bulletin-title");
    const bulletinContentInput = document.getElementById("bulletin-content");
    const bulletinStatusSelect = document.getElementById("bulletin-status");

    const acknowledgementsModalElement = document.getElementById("acknowledgements-modal");
    const acknowledgementsModal = acknowledgementsModalElement ? new bootstrap.Modal(acknowledgementsModalElement) : null;
    const acknowledgementsList = document.getElementById("acknowledgements-list");

    const departmentFilterSelect = document.getElementById("department-filter");
    const statusFilterSelect = document.getElementById("status-filter");
    const filterBtn = document.getElementById("filter-btn");

    let currentBulletins = []; // Store fetched bulletins

    // Initialize
    async function initialize() {
        if (checkUserRole(["system_admin", "assistant_manager", "admin_supervisor"])) {
            await loadDepartmentsForFilter();
        } else {
            // Hide filters if not admin
            const filterOptionsDiv = document.querySelector(".filter-options");
            if (filterOptionsDiv) filterOptionsDiv.style.display = "none";
        }
        loadBulletins();
    }
    initialize();

    // Event listeners
    if (addBulletinBtn) {
        addBulletinBtn.addEventListener("click", () => openBulletinModal());
    }
    if (bulletinForm) {
        bulletinForm.addEventListener("submit", handleBulletinSubmit);
    }
    if (filterBtn) {
        filterBtn.addEventListener("click", loadBulletins);
    }

    // --- Data Loading Functions ---
    async function loadDepartmentsForFilter() {
        try {
            const departments = await api.getAllDepartments();
            if (departmentFilterSelect) {
                departmentFilterSelect.innerHTML = `<option value="">كل الأقسام</option>` +
                    departments.map(d => `<option value="${d.id}">${escapeHTML(d.name)}</option>`).join("");
            }
        } catch (error) {
            showError("فشل تحميل الأقسام للفلتر: " + error.message);
        }
    }

    // --- Bulletin Management ---
    async function loadBulletins() {
        const filters = {};
        if (departmentFilterSelect && departmentFilterSelect.value) filters.departmentId = departmentFilterSelect.value; // API needs to support this
        if (statusFilterSelect && statusFilterSelect.value) filters.status = statusFilterSelect.value;

        try {
            showLoader(bulletinsContainer);
            // API automatically filters by department/status based on role
            currentBulletins = await api.getAllDepartmentBulletins(filters);
            renderBulletinsList(currentBulletins);
            hideLoader(bulletinsContainer);
        } catch (error) {
            showError("فشل تحميل النشرات: " + error.message, bulletinsContainer);
            hideLoader(bulletinsContainer);
        }
    }

    function renderBulletinsList(bulletins) {
        bulletinsContainer.innerHTML = "";

        if (bulletins.length === 0) {
            bulletinsContainer.innerHTML = `<p class="text-center">لا توجد نشرات لعرضها.</p>`;
            return;
        }

        const currentUser = getCurrentUser();
        const canManage = checkUserRole(["system_admin", "assistant_manager", "department_head"]);
        const isTeacher = checkUserRole(["teacher"]);

        bulletins.forEach(bulletin => {
            const card = document.createElement("div");
            card.className = "bulletin-card";
            card.innerHTML = `
                <h5>${escapeHTML(bulletin.title)}</h5>
                <div class="bulletin-meta">
                    <span>القسم: ${escapeHTML(bulletin.department_name)}</span> | 
                    <span>بواسطة: ${escapeHTML(bulletin.created_by_name)}</span> | 
                    <span>في: ${new Date(bulletin.created_at).toLocaleDateString("ar-SA")}</span> | 
                    <span>الحالة: ${translateStatus(bulletin.status)}</span>
                    ${bulletin.published_at ? ` | <span>تاريخ النشر: ${new Date(bulletin.published_at).toLocaleDateString("ar-SA")}</span>` : ""}
                </div>
                <p>${escapeHTML(bulletin.content.substring(0, 200))}${bulletin.content.length > 200 ? "..." : ""}</p>
                <!-- TODO: Add link to view full content/attachment -->
                <div class="bulletin-actions"></div>
            `;

            const actionsContainer = card.querySelector(".bulletin-actions");

            // Edit/Delete buttons for creator (Head) or Admins
            if (canManage && (bulletin.created_by_user_id === currentUser?.id || checkUserRole(["system_admin", "assistant_manager"]))) {
                const editButton = document.createElement("button");
                editButton.className = "btn btn-sm btn-warning edit-bulletin";
                editButton.innerHTML = ".تعديل <i class="bi bi-pencil"></i>";
                editButton.dataset.id = bulletin.id;
                editButton.addEventListener("click", () => openBulletinModal(bulletin.id));
                actionsContainer.appendChild(editButton);

                const deleteButton = document.createElement("button");
                deleteButton.className = "btn btn-sm btn-danger delete-bulletin";
                deleteButton.innerHTML = ".حذف <i class="bi bi-trash"></i>";
                deleteButton.dataset.id = bulletin.id;
                deleteButton.addEventListener("click", () => deleteBulletin(bulletin.id));
                actionsContainer.appendChild(deleteButton);
            }

            // View Acknowledgements button for Head or Admins
            if (canManage && (bulletin.department_id === currentUser?.department_id || checkUserRole(["system_admin", "assistant_manager", "admin_supervisor"]))) {
                 const viewAcksButton = document.createElement("button");
                 viewAcksButton.className = "btn btn-sm btn-info view-acknowledgements";
                 viewAcksButton.innerHTML = ".عرض التأكيدات <i class="bi bi-eye"></i>";
                 viewAcksButton.dataset.id = bulletin.id;
                 viewAcksButton.addEventListener("click", () => viewAcknowledgements(bulletin.id));
                 actionsContainer.appendChild(viewAcksButton);
            }

            // Acknowledge button for Teachers (if published and not already acknowledged)
            if (isTeacher && bulletin.status === "published") {
                // We need to know if the current teacher has acknowledged this bulletin.
                // This requires an API endpoint or modification to getAllDepartmentBulletins
                // to include acknowledgement status for the current user.
                // Placeholder: Assume we have bulletin.acknowledged_by_current_user (boolean)
                if (bulletin.acknowledged_by_current_user) {
                    const acknowledgedText = document.createElement("span");
                    acknowledgedText.className = "acknowledged-text";
                    acknowledgedText.innerHTML = ".تم التأكيد <i class="bi bi-check-circle-fill"></i>";
                    actionsContainer.appendChild(acknowledgedText);
                } else {
                    const acknowledgeButton = document.createElement("button");
                    acknowledgeButton.className = "btn btn-sm acknowledge-btn";
                    acknowledgeButton.innerHTML = ".تأكيد القراءة <i class="bi bi-check-lg"></i>";
                    acknowledgeButton.dataset.id = bulletin.id;
                    acknowledgeButton.addEventListener("click", () => acknowledgeBulletin(bulletin.id, acknowledgeButton));
                    actionsContainer.appendChild(acknowledgeButton);
                }
            }

            bulletinsContainer.appendChild(card);
        });
    }

    function translateStatus(status) {
        switch (status) {
            case "draft": return "مسودة";
            case "published": return "منشورة";
            case "archived": return "مؤرشفة";
            case "pending_approval": return "بانتظار الموافقة";
            default: return status;
        }
    }

    function openBulletinModal(bulletinId = null) {
        if (!bulletinModal) return;
        bulletinForm.reset();
        bulletinIdInput.value = "";

        if (bulletinId) {
            // Editing existing bulletin
            const bulletin = currentBulletins.find(b => b.id === bulletinId);
            if (!bulletin) {
                showError("لم يتم العثور على النشرة للتعديل.");
                return;
            }
            document.getElementById("bulletin-modal-title").textContent = "تعديل نشرة قسم";
            bulletinIdInput.value = bulletin.id;
            bulletinTitleInput.value = bulletin.title;
            bulletinContentInput.value = bulletin.content;
            bulletinStatusSelect.value = bulletin.status;
            // TODO: Handle attachment display/update
        } else {
            // Creating new bulletin
            document.getElementById("bulletin-modal-title").textContent = "إنشاء نشرة قسم جديدة";
        }
        bulletinModal.show();
    }

    async function handleBulletinSubmit(e) {
        e.preventDefault();

        const bulletinData = {
            title: bulletinTitleInput.value.trim(),
            content: bulletinContentInput.value.trim(),
            status: bulletinStatusSelect.value,
            // attachment_path: null // TODO: Handle attachment upload
        };
        const bulletinId = bulletinIdInput.value;

        if (!bulletinData.title || !bulletinData.content) {
            showError("العنوان والمحتوى مطلوبان.", bulletinForm);
            return;
        }

        try {
            showLoader(bulletinForm);
            if (bulletinId) {
                // Update existing bulletin
                await api.updateDepartmentBulletin(bulletinId, bulletinData);
                showSuccess("تم تحديث النشرة بنجاح");
            } else {
                // Create new bulletin
                await api.createDepartmentBulletin(bulletinData);
                showSuccess("تم إنشاء النشرة بنجاح");
            }
            await loadBulletins(); // Reload list
            bulletinModal.hide();
        } catch (error) {
            showError("فشل في حفظ النشرة: " + error.message, bulletinForm);
        } finally {
            hideLoader(bulletinForm);
        }
    }

    async function deleteBulletin(bulletinId) {
        if (!confirm("هل أنت متأكد من حذف هذه النشرة؟ لا يمكن التراجع عن هذا الإجراء.")) {
            return;
        }

        try {
            showLoader(bulletinsContainer);
            await api.deleteDepartmentBulletin(bulletinId);
            showSuccess("تم حذف النشرة بنجاح");
            await loadBulletins(); // Reload list
            hideLoader(bulletinsContainer);
        } catch (error) {
            showError("فشل في حذف النشرة: " + error.message, bulletinsContainer);
            hideLoader(bulletinsContainer);
        }
    }

    async function acknowledgeBulletin(bulletinId, buttonElement) {
        try {
            buttonElement.disabled = true;
            buttonElement.innerHTML = "جارٍ التأكيد...";
            await api.acknowledgeDepartmentBulletin(bulletinId);
            // Replace button with acknowledged text
            const acknowledgedText = document.createElement("span");
            acknowledgedText.className = "acknowledged-text";
            acknowledgedText.innerHTML = ".تم التأكيد <i class="bi bi-check-circle-fill"></i>";
            buttonElement.replaceWith(acknowledgedText);
            showSuccess("تم تأكيد قراءة النشرة.");
        } catch (error) {
            showError("فشل في تأكيد القراءة: " + error.message);
            buttonElement.disabled = false;
            buttonElement.innerHTML = ".تأكيد القراءة <i class="bi bi-check-lg"></i>";
        } 
    }

    async function viewAcknowledgements(bulletinId) {
        if (!acknowledgementsModal) return;
        acknowledgementsList.innerHTML = `<li class="list-group-item text-center">جارٍ التحميل...</li>`;
        acknowledgementsModal.show();

        try {
            const acks = await api.getDepartmentBulletinAcknowledgements(bulletinId);
            acknowledgementsList.innerHTML = "";
            if (acks.length === 0) {
                acknowledgementsList.innerHTML = `<li class="list-group-item text-center">لم يقم أحد بتأكيد القراءة بعد.</li>`;
            } else {
                acks.forEach(ack => {
                    const li = document.createElement("li");
                    li.className = "list-group-item d-flex justify-content-between align-items-center";
                    li.textContent = escapeHTML(ack.user_name);
                    const dateSpan = document.createElement("span");
                    dateSpan.className = "badge bg-secondary rounded-pill";
                    dateSpan.textContent = new Date(ack.acknowledged_at).toLocaleString("ar-SA");
                    li.appendChild(dateSpan);
                    acknowledgementsList.appendChild(li);
                });
            }
        } catch (error) {
            showError("فشل في تحميل تأكيدات القراءة: " + error.message, acknowledgementsList);
        }
    }

    // --- Utility Functions (Assume defined elsewhere) ---
    // showLoader, hideLoader, showError, showSuccess, escapeHTML, displayPermissionError, getCurrentUser, checkUserRole, updateUserUIBasedOnRole
    // Make sure these are available from other JS files like admin-permissions.js, local-auth.js, etc.
});

