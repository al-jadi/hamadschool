// JavaScript for Exit Permissions Page (using API)

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
    // Parents (for their children), Admin Supervisors, Assistant Managers, System Admins
    // TODO: Add specific logic for parents viewing only their children's requests
    if (!checkUserRole(["parent", "admin_supervisor", "assistant_manager", "system_admin"])) {
        displayPermissionError("permissions-content");
        return;
    }

    // Setup event listeners and load initial data
    await populatePermissionClassFilter(user);
    setupPermissionsEventListeners(user);
    loadExitPermissions(user);
});

async function populatePermissionClassFilter(user) {
    const classFilter = document.getElementById("class-filter");
    if (!classFilter) return;

    try {
        const classes = await api.getClasses(); // Fetch all classes
        classFilter.innerHTML = "<option value=\"all\">جميع الصفوف</option>"; // Add "All" option

        if (classes.length === 0) {
            return; // No classes available, keep only "All"
        }

        classes.forEach(cls => {
            const option = document.createElement("option");
            option.value = cls.id;
            option.textContent = cls.name;
            classFilter.appendChild(option);
        });

    } catch (error) {
        console.error("Error fetching classes for filter:", error);
        // Keep "All" option even if fetch fails
    }
}

function setupPermissionsEventListeners(user) {
    const classFilter = document.getElementById("class-filter");
    const dateFilter = document.getElementById("date-filter");
    const statusFilter = document.getElementById("status-filter");
    const addPermissionBtn = document.querySelector(".add-permission-btn");

    if (classFilter) classFilter.addEventListener("change", () => loadExitPermissions(user));
    if (dateFilter) dateFilter.addEventListener("change", () => loadExitPermissions(user));
    if (statusFilter) statusFilter.addEventListener("change", () => loadExitPermissions(user));

    // Show/Hide Add button based on role (Parents, Assistant Manager, System Admin?)
    // Assuming parents can request for their child, and admins can add on behalf
    if (addPermissionBtn) {
        if (checkUserRole(["parent", "assistant_manager", "system_admin"])) {
            addPermissionBtn.style.display = ""; // Show button
            addPermissionBtn.addEventListener("click", handleAddPermission);
        } else {
            addPermissionBtn.style.display = "none"; // Hide button
        }
    }

    // TODO: Add listeners for modal forms (Add/View/Approve/Reject)
}

async function loadExitPermissions(user, filters = {}) {
    const permissionsTableBody = document.querySelector(".permissions-table tbody");
    if (!permissionsTableBody) return;

    permissionsTableBody.innerHTML = 
        `<tr><td colspan="9" class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> جارٍ تحميل الأذونات...</td></tr>`;

    try {
        // Add filters from dropdowns
        const classFilter = document.getElementById("class-filter").value;
        const dateFilter = document.getElementById("date-filter").value;
        const statusFilter = document.getElementById("status-filter").value;

        if (classFilter && classFilter !== "all") filters.class_id = classFilter;
        if (dateFilter) filters.date = dateFilter; // Assuming API supports date filter
        if (statusFilter && statusFilter !== "all") filters.status = statusFilter;

        // TODO: If user is parent, add filter for their children
        // if (user.role === 'parent') { filters.parent_id = user.id; }

        // Fetch permissions from API
        const permissions = await api.getExitPermissions(filters);
        renderPermissionsTable(permissions, permissionsTableBody, user);

    } catch (error) {
        console.error("Error loading exit permissions:", error);
        permissionsTableBody.innerHTML = 
            `<tr><td colspan="9" class="text-center text-danger">حدث خطأ أثناء تحميل الأذونات: ${error.message}</td></tr>`;
    }
}

function renderPermissionsTable(permissions, tableBody, currentUser) {
    tableBody.innerHTML = ""; // Clear loading state or previous data

    if (permissions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center">لا توجد أذونات خروج لعرضها.</td></tr>`;
        return;
    }

    // Define status map for display
    const statusMap = {
        "pending": { text: "معلق", class: "status-pending" },
        "approved": { text: "تمت الموافقة", class: "status-approved" },
        "rejected": { text: "مرفوض", class: "status-rejected" }
    };

    permissions.forEach(permission => {
        const tr = document.createElement("tr");
        const permissionStatus = statusMap[permission.status] || { text: escapeHTML(permission.status), class: "" };
        
        // Format date and time if available
        const exitDate = permission.exit_date ? new Date(permission.exit_date).toLocaleDateString("ar-EG") : "-";
        const exitTime = permission.exit_time || "-"; // Assuming time is stored as string HH:MM

        tr.innerHTML = `
            <td>${escapeHTML(permission.id || "-")}</td>
            <td>${escapeHTML(permission.student_name || "-")}</td> <!-- Assuming student_name is joined -->
            <td>${escapeHTML(permission.class_name || "-")}</td> <!-- Assuming class_name is joined -->
            <td>${exitDate}</td>
            <td>${escapeHTML(exitTime)}</td>
            <td>${escapeHTML(permission.reason || "-")}</td>
            <td>${escapeHTML(permission.requester_name || "-")}</td> <!-- Assuming requester name is joined -->
            <td><span class="status-badge ${permissionStatus.class}">${permissionStatus.text}</span></td>
            <td>
                <div class="action-buttons"></div>
            </td>
        `;

        const actionButtonsContainer = tr.querySelector(".action-buttons");

        // View Button (All relevant roles can view)
        const viewButton = document.createElement("button");
        viewButton.className = "btn btn-sm btn-info view-btn";
        viewButton.textContent = "عرض";
        viewButton.onclick = () => handleViewPermission(permission);
        actionButtonsContainer.appendChild(viewButton);

        // Approve/Reject Buttons (Assistant Manager, System Admin)
        // Only show if status is pending
        if (permission.status === "pending" && checkUserRole(["assistant_manager", "system_admin"])) {
            const approveButton = document.createElement("button");
            approveButton.className = "btn btn-sm btn-success approve-btn";
            approveButton.textContent = "موافقة";
            approveButton.onclick = () => handleApproveRejectPermission(permission.id, "approved");
            actionButtonsContainer.appendChild(approveButton);

            const rejectButton = document.createElement("button");
            rejectButton.className = "btn btn-sm btn-danger reject-btn";
            rejectButton.textContent = "رفض";
            rejectButton.onclick = () => handleApproveRejectPermission(permission.id, "rejected");
            actionButtonsContainer.appendChild(rejectButton);
        }

        tableBody.appendChild(tr);
    });
}

function handleAddPermission() {
    // TODO: Implement logic to show an "Add Exit Permission Request" modal/form
    console.log("Add Permission button clicked");
    // Example: openPermissionModal(); // Pass no permission data for add mode
}

function handleViewPermission(permission) {
    // TODO: Implement logic to show a "View Exit Permission" modal/form (read-only)
    console.log("View Permission button clicked for:", permission);
    alert(`وظيفة عرض الإذن رقم ${permission.id} قيد التطوير.`);
    // Example: openPermissionModal(permission, true); // Pass permission data and readOnly flag
}

async function handleApproveRejectPermission(permissionId, newStatus) {
    // TODO: Add confirmation dialog
    const confirmationText = newStatus === "approved" ? "هل أنت متأكد من الموافقة على هذا الإذن؟" : "هل أنت متأكد من رفض هذا الإذن؟";
    if (!confirm(confirmationText)) {
        return;
    }

    console.log(`Attempting to ${newStatus} permission ${permissionId}`);
    try {
        await api.updateExitPermissionStatus(permissionId, { status: newStatus });
        alert(`تم ${newStatus === "approved" ? "الموافقة على" : "رفض"} الإذن بنجاح.`);
        // Reload permissions to reflect the change
        const user = await checkAuthStatus(); // Re-check user in case of role change/logout
        if (user) loadExitPermissions(user);
    } catch (error) {
        console.error(`Error updating permission status:`, error);
        alert(`فشل تحديث حالة الإذن: ${error.message}`);
    }
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

// TODO: Implement functions for Add/View Permission Modals/Forms
// function openPermissionModal(permissionData = null, readOnly = false) { ... }
// function handlePermissionFormSubmit() { ... }

