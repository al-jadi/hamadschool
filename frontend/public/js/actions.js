// JavaScript for Administrative Actions Page (using API)

document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkAuthStatus(); // Check authentication and get user details
    if (!user) return;

    // Update UI elements based on user role
    updateUserUIBasedOnRole(user);

    // Remove the static demo notice
    const demoNotice = document.querySelector(".demo-notice");
    if (demoNotice) {
        demoNotice.remove();
    }

    // Check if the user has permission to view/use this page
    // Admin Supervisors, Assistant Managers, System Admins can view
    // Parents might view specific actions related to their child (handled later)
    if (!checkUserRole(["admin_supervisor", "assistant_manager", "system_admin"])) {
        // Allow parents if a specific student context is provided (e.g., via query param)
        // For now, restrict general view
        // TODO: Add logic for parent view of specific student actions
        displayPermissionError("actions-content");
        return;
    }

    // Setup event listeners and load initial data
    setupActionsEventListeners(user);
    loadAdministrativeActions(user);
});

function setupActionsEventListeners(user) {
    const actionTypeFilter = document.getElementById("action-type-filter");
    const dateFilter = document.getElementById("date-filter");
    const statusFilter = document.getElementById("status-filter");
    const addActionBtn = document.querySelector(".add-action-btn");

    if (actionTypeFilter) actionTypeFilter.addEventListener("change", () => loadAdministrativeActions(user));
    if (dateFilter) dateFilter.addEventListener("change", () => loadAdministrativeActions(user));
    if (statusFilter) statusFilter.addEventListener("change", () => loadAdministrativeActions(user));

    // Show/Hide Add button based on role (Assistant Manager, System Admin)
    if (addActionBtn) {
        if (checkUserRole(["assistant_manager", "system_admin"])) {
            addActionBtn.style.display = ""; // Show button
            addActionBtn.addEventListener("click", handleAddAction);
        } else {
            addActionBtn.style.display = "none"; // Hide button
        }
    }

    // TODO: Add listeners for modal forms (Add/View/Edit)
}

async function loadAdministrativeActions(user, filters = {}) {
    const actionsTableBody = document.querySelector(".actions-table tbody");
    if (!actionsTableBody) return;

    actionsTableBody.innerHTML = 
        `<tr><td colspan="8" class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> جارٍ تحميل الإجراءات...</td></tr>`;

    try {
        // Add filters from dropdowns
        const actionTypeFilter = document.getElementById("action-type-filter").value;
        const dateFilter = document.getElementById("date-filter").value;
        const statusFilter = document.getElementById("status-filter").value;

        if (actionTypeFilter && actionTypeFilter !== "all") filters.action_type = actionTypeFilter;
        if (dateFilter) filters.date = dateFilter; // Assuming API supports date filter
        if (statusFilter && statusFilter !== "all") filters.status = statusFilter;

        // Fetch actions from API
        const actions = await api.getAdministrativeActions(filters);
        renderActionsTable(actions, actionsTableBody, user);

    } catch (error) {
        console.error("Error loading administrative actions:", error);
        actionsTableBody.innerHTML = 
            `<tr><td colspan="8" class="text-center text-danger">حدث خطأ أثناء تحميل الإجراءات: ${error.message}</td></tr>`;
    }
}

function renderActionsTable(actions, tableBody, currentUser) {
    tableBody.innerHTML = ""; // Clear loading state or previous data

    if (actions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">لا توجد إجراءات إدارية لعرضها.</td></tr>`;
        return;
    }

    // Define status map for display
    const statusMap = {
        "pending": { text: "معلق", class: "status-pending" },
        "approved": { text: "تمت الموافقة", class: "status-approved" },
        "rejected": { text: "مرفوض", class: "status-rejected" }
    };
    // Define action type map for display (assuming keys match backend)
    const actionTypeMap = {
        "call_parent": "استدعاء ولي أمر",
        "student_pledge": "تعهد طالب",
        "suspension": "فصل",
        // Add other types as needed
    };

    actions.forEach(action => {
        const tr = document.createElement("tr");
        const actionStatus = statusMap[action.status] || { text: escapeHTML(action.status), class: "" };
        const actionTypeDisplay = actionTypeMap[action.action_type] || escapeHTML(action.action_type);
        
        // Format date if available
        const actionDate = action.action_date ? new Date(action.action_date).toLocaleDateString("ar-EG") : "-";

        tr.innerHTML = `
            <td>${escapeHTML(action.id || "-")}</td>
            <td>${escapeHTML(action.student_name || "-")}</td> <!-- Assuming student_name is joined -->
            <td>${escapeHTML(action.class_name || "-")}</td> <!-- Assuming class_name is joined -->
            <td>${actionTypeDisplay}</td>
            <td>${actionDate}</td>
            <td>${escapeHTML(action.administrator_name || "-")}</td> <!-- Assuming admin name is joined -->
            <td><span class="status-badge ${actionStatus.class}">${actionStatus.text}</span></td>
            <td>
                <div class="action-buttons"></div>
            </td>
        `;

        const actionButtonsContainer = tr.querySelector(".action-buttons");

        // View Button (All relevant roles can view)
        const viewButton = document.createElement("button");
        viewButton.className = "btn btn-sm btn-info view-btn";
        viewButton.textContent = "عرض";
        viewButton.onclick = () => handleViewAction(action);
        actionButtonsContainer.appendChild(viewButton);

        // Edit/Approve/Reject Button (Assistant Manager, System Admin)
        // Admin Supervisor cannot edit based on requirements
        if (checkUserRole(["assistant_manager", "system_admin"])) {
            const editButton = document.createElement("button");
            editButton.className = "btn btn-sm btn-warning edit-btn";
            editButton.textContent = "تعديل/مراجعة";
            editButton.onclick = () => handleEditAction(action);
            actionButtonsContainer.appendChild(editButton);
        }

        tableBody.appendChild(tr);
    });
}

function handleAddAction() {
    // TODO: Implement logic to show an "Add Administrative Action" modal/form
    console.log("Add Action button clicked");
    alert("وظيفة إضافة إجراء إداري جديد قيد التطوير.");
    // Example: openActionModal(); // Pass no action data for add mode
}

function handleViewAction(action) {
    // TODO: Implement logic to show a "View Administrative Action" modal/form (read-only)
    console.log("View Action button clicked for:", action);
    alert(`وظيفة عرض الإجراء رقم ${action.id} قيد التطوير.`);
    // Example: openActionModal(action, true); // Pass action data and readOnly flag
}

function handleEditAction(action) {
    // TODO: Implement logic to show an "Edit Administrative Action" modal/form 
    // Allows Assistant Manager/System Admin to modify details or change status (approve/reject).
    console.log("Edit Action button clicked for:", action);
    alert(`وظيفة تعديل/مراجعة الإجراء رقم ${action.id} قيد التطوير.`);
    // Example: openActionModal(action, false); // Pass action data for edit mode
}

// Helper function to display permission errors (reuse or place in shared utility)
function displayPermissionError(containerClass) {
    const mainContent = document.querySelector(`.${containerClass}`);
    if (mainContent) {
        mainContent.innerHTML = `<div class="alert alert-danger">ليس لديك الصلاحية لعرض أو استخدام هذه الصفحة.</div>`;
    }
}

// Helper function to escape HTML (reuse or place in shared utility)
function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"]/g, function (s) {
        const entityMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '"',
        };
        return entityMap[s];
    });
}

// TODO: Implement functions for Add/View/Edit Action Modals/Forms
// function openActionModal(actionData = null, readOnly = false) { ... }
// function handleActionFormSubmit() { ... }

