// parentBulletins.js - Handles Parent Bulletins page logic

document.addEventListener("DOMContentLoaded", () => {
    const bulletinsList = document.getElementById("bulletins-list");
    const addBulletinBtn = document.querySelector(".add-bulletin-btn");
    const bulletinModal = new bootstrap.Modal(document.getElementById("bulletin-modal"));
    const bulletinModalForm = document.getElementById("bulletin-modal-form");
    const bulletinModalTitle = document.getElementById("bulletin-modal-title");
    const bulletinIdInput = document.getElementById("bulletin-id");
    const bulletinTitleInput = document.getElementById("bulletin-title");
    const bulletinContentInput = document.getElementById("bulletin-content");
    const bulletinTypeInput = document.getElementById("bulletin-type");
    const bulletinStatusInput = document.getElementById("bulletin-status");
    const bulletinTargetClassInput = document.getElementById("bulletin-target-class");
    const classFilterSelect = document.getElementById("class-filter");
    const typeFilterSelect = document.getElementById("type-filter");
    const statusFilterSelect = document.getElementById("status-filter");
    const filterBtn = document.getElementById("filter-btn");

    const currentUser = getCurrentUser(); // From local-auth.js
    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }

    // Apply role-based UI restrictions
    applyPermissions(currentUser.role);

    // --- Function to fetch and display bulletins ---
    async function fetchAndDisplayBulletins() {
        bulletinsList.innerHTML = 
            '<p class="text-center">جارٍ تحميل النشرات...</p>';
        try {
            const params = new URLSearchParams();
            if (typeFilterSelect.value) params.append("type", typeFilterSelect.value);
            if (classFilterSelect.value) params.append("classId", classFilterSelect.value);
            // Only add status filter for admins
            if (isAdminRole(currentUser.role) && statusFilterSelect.value) {
                params.append("status", statusFilterSelect.value);
            }

            const bulletins = await apiRequest(`parent-bulletins?${params.toString()}`);

            if (bulletins.length === 0) {
                bulletinsList.innerHTML = 
                    '<p class="text-center">لا توجد نشرات لعرضها.</p>';
                return;
            }

            bulletinsList.innerHTML = ""; // Clear loading message
            bulletins.forEach(bulletin => {
                const card = createBulletinCard(bulletin);
                bulletinsList.appendChild(card);
            });
        } catch (error) {
            console.error("Error fetching bulletins:", error);
            bulletinsList.innerHTML = 
                '<p class="text-center text-danger">حدث خطأ أثناء تحميل النشرات.</p>';
        }
    }

    // --- Function to create a bulletin card element ---
    function createBulletinCard(bulletin) {
        const card = document.createElement("div");
        card.className = "bulletin-card";
        card.dataset.id = bulletin.id;

        let metaInfo = `
            <span class="badge bg-secondary">${translateBulletinType(bulletin.type)}</span>
            <span class="badge bg-${getBootstrapStatusClass(bulletin.status)}">${translateBulletinStatus(bulletin.status)}</span>
            <small> بواسطة: ${bulletin.created_by_name || "غير معروف"} | بتاريخ: ${new Date(bulletin.created_at).toLocaleDateString("ar-EG")}</small>
        `;
        if (bulletin.target_class_name) {
            metaInfo += ` | <small>الفصل: ${bulletin.target_class_name}</small>`;
        }
        if (bulletin.published_at && bulletin.status === "published") {
            metaInfo += ` | <small>نشر في: ${new Date(bulletin.published_at).toLocaleDateString("ar-EG")}</small>`;
        }

        let actionsHtml = "";
        if (isAdminRole(currentUser.role)) {
            actionsHtml = `
                <button class="btn btn-sm btn-outline-primary edit-btn">تعديل</button>
                <button class="btn btn-sm btn-outline-danger delete-btn">حذف</button>
            `;
        }

        card.innerHTML = `
            <h5>${bulletin.title}</h5>
            <div class="bulletin-meta">${metaInfo}</div>
            <p>${bulletin.content.replace(/\n/g, 
                '<br>')}</p>
            ${bulletin.attachment_path ? `<p><a href="${API_BASE_URL}/uploads/${bulletin.attachment_path}" target="_blank">عرض المرفق</a></p>` : ""}
            <div class="bulletin-actions">
                ${actionsHtml}
            </div>
        `;

        // Add event listeners for buttons
        const editBtn = card.querySelector(".edit-btn");
        const deleteBtn = card.querySelector(".delete-btn");

        if (editBtn) {
            editBtn.addEventListener("click", () => openEditModal(bulletin));
        }
        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => handleDeleteBulletin(bulletin.id));
        }

        return card;
    }

    // --- Function to load classes into dropdowns ---
    async function loadClasses() {
        try {
            const classes = await apiRequest("classes");
            classFilterSelect.innerHTML = 
                '<option value="">الكل</option>'; // Reset
            bulletinTargetClassInput.innerHTML = 
                '<option value="">عام (للكل)</option>'; // Reset
            classes.forEach(cls => {
                const optionFilter = document.createElement("option");
                optionFilter.value = cls.id;
                optionFilter.textContent = cls.name;
                classFilterSelect.appendChild(optionFilter);

                const optionModal = document.createElement("option");
                optionModal.value = cls.id;
                optionModal.textContent = cls.name;
                bulletinTargetClassInput.appendChild(optionModal);
            });
        } catch (error) {
            console.error("Error loading classes:", error);
            // Handle error display if needed
        }
    }

    // --- Function to open the modal for adding/editing ---
    function openEditModal(bulletin) {
        bulletinModalForm.reset(); // Clear previous data
        if (bulletin) {
            // Editing existing bulletin
            bulletinModalTitle.textContent = "تعديل نشرة أولياء الأمور";
            bulletinIdInput.value = bulletin.id;
            bulletinTitleInput.value = bulletin.title;
            bulletinContentInput.value = bulletin.content;
            bulletinTypeInput.value = bulletin.type;
            bulletinStatusInput.value = bulletin.status;
            bulletinTargetClassInput.value = bulletin.target_class_id || "";
            // TODO: Handle attachment display/update if implemented
        } else {
            // Adding new bulletin
            bulletinModalTitle.textContent = "إنشاء نشرة أولياء الأمور";
            bulletinIdInput.value = ""; // Ensure ID is empty
        }
        bulletinModal.show();
    }

    // --- Handle form submission for add/edit ---
    bulletinModalForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const bulletinId = bulletinIdInput.value;
        const isEditing = !!bulletinId;

        const bulletinData = {
            title: bulletinTitleInput.value,
            content: bulletinContentInput.value,
            type: bulletinTypeInput.value,
            status: bulletinStatusInput.value,
            target_class_id: bulletinTargetClassInput.value || null,
            // TODO: Handle attachment upload if implemented
            // attachment_path: ...
        };

        try {
            let result;
            if (isEditing) {
                result = await apiRequest(`parent-bulletins/${bulletinId}`, "PUT", bulletinData);
            } else {
                result = await apiRequest("parent-bulletins", "POST", bulletinData);
            }
            bulletinModal.hide();
            await fetchAndDisplayBulletins(); // Refresh the list
            showToast("نجاح", `تم ${isEditing ? "تعديل" : "إنشاء"} النشرة بنجاح.`);
        } catch (error) {
            console.error(`Error ${isEditing ? "updating" : "creating"} bulletin:`, error);
            showToast("خطأ", `فشل ${isEditing ? "تعديل" : "إنشاء"} النشرة.`, "error");
        }
    });

    // --- Handle bulletin deletion ---
    async function handleDeleteBulletin(bulletinId) {
        if (!confirm("هل أنت متأكد من رغبتك في حذف هذه النشرة؟ لا يمكن التراجع عن هذا الإجراء.")) {
            return;
        }

        try {
            await apiRequest(`parent-bulletins/${bulletinId}`, "DELETE");
            await fetchAndDisplayBulletins(); // Refresh the list
            showToast("نجاح", "تم حذف النشرة بنجاح.");
        } catch (error) {
            console.error("Error deleting bulletin:", error);
            showToast("خطأ", "فشل حذف النشرة.", "error");
        }
    }

    // --- Helper Functions ---
    function isAdminRole(role) {
        return ["system_admin", "assistant_manager", "admin_supervisor"].includes(role);
    }

    function translateBulletinStatus(status) {
        switch (status) {
            case "draft": return "مسودة";
            case "published": return "منشورة";
            case "archived": return "مؤرشفة";
            default: return status;
        }
    }

    function translateBulletinType(type) {
        switch (type) {
            case "general_announcement": return "إعلان عام";
            case "class_schedule": return "جدول دراسي";
            case "exam_schedule": return "جدول اختبارات";
            default: return type;
        }
    }

    function getBootstrapStatusClass(status) {
        switch (status) {
            case "draft": return "secondary";
            case "published": return "success";
            case "archived": return "warning";
            default: return "info";
        }
    }

    // --- Event Listeners ---
    if (addBulletinBtn) {
        addBulletinBtn.addEventListener("click", () => openEditModal(null));
    }
    if (filterBtn) {
        filterBtn.addEventListener("click", fetchAndDisplayBulletins);
    }

    // --- Initial Load ---
    loadClasses();
    fetchAndDisplayBulletins();
});

