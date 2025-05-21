// JavaScript for Behavior Reports Page (using API)

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
    // Teachers, Admin Supervisors, Assistant Managers, System Admins
    if (!checkUserRole(["teacher", "admin_supervisor", "assistant_manager", "system_admin"])) {
        displayPermissionError("behavior-content");
        return;
    }

    // Setup event listeners and load initial data
    await populateBehaviorClassFilter(user);
    setupBehaviorEventListeners(user);
    loadBehaviorReports(user);
});

async function populateBehaviorClassFilter(user) {
    const classFilter = document.getElementById("class-filter");
    if (!classFilter) return;

    try {
        const classes = await api.getClasses(); // Fetch all classes
        classFilter.innerHTML = "<option value=\"all\">جميع الصفوف</option>"; // Add "All" option

        if (classes.length === 0) {
            // No classes available, keep only "All"
            return;
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

function setupBehaviorEventListeners(user) {
    const classFilter = document.getElementById("class-filter");
    const dateFilter = document.getElementById("date-filter");
    const statusFilter = document.getElementById("status-filter");
    const addReportBtn = document.querySelector(".add-report-btn");

    if (classFilter) classFilter.addEventListener("change", () => loadBehaviorReports(user));
    if (dateFilter) dateFilter.addEventListener("change", () => loadBehaviorReports(user));
    if (statusFilter) statusFilter.addEventListener("change", () => loadBehaviorReports(user));

    // Show/Hide Add button based on role (Only Teachers can add)
    if (addReportBtn) {
        if (user.role === "teacher") {
            addReportBtn.style.display = ""; // Show button
            addReportBtn.addEventListener("click", handleAddBehaviorReport);
        } else {
            addReportBtn.style.display = "none"; // Hide button
        }
    }

    // TODO: Add listeners for modal forms (Add/View/Edit)
}

async function loadBehaviorReports(user, filters = {}) {
    const behaviorTableBody = document.querySelector(".behavior-table tbody");
    if (!behaviorTableBody) return;

    behaviorTableBody.innerHTML = 
        `<tr><td colspan="8" class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> جارٍ تحميل التقارير...</td></tr>`;

    try {
        // Add filters from dropdowns
        const classFilter = document.getElementById("class-filter").value;
        const dateFilter = document.getElementById("date-filter").value;
        const statusFilter = document.getElementById("status-filter").value;

        if (classFilter && classFilter !== "all") filters.class_id = classFilter;
        if (dateFilter) filters.date = dateFilter; // Assuming API supports date filter
        if (statusFilter && statusFilter !== "all") filters.status = statusFilter;

        // Fetch reports from API
        const reports = await api.getBehaviorReports(filters);
        renderBehaviorTable(reports, behaviorTableBody, user);

    } catch (error) {
        console.error("Error loading behavior reports:", error);
        behaviorTableBody.innerHTML = 
            `<tr><td colspan="8" class="text-center text-danger">حدث خطأ أثناء تحميل التقارير: ${error.message}</td></tr>`;
    }
}

function renderBehaviorTable(reports, tableBody, currentUser) {
    tableBody.innerHTML = ""; // Clear loading state or previous data

    if (reports.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">لا توجد تقارير سلوك لعرضها.</td></tr>`;
        return;
    }

    // Define status map for display
    const statusMap = {
        "new": { text: "جديد", class: "status-new" },
        "processing": { text: "قيد المعالجة", class: "status-processing" },
        "resolved": { text: "تم الحل", class: "status-resolved" }
    };

    reports.forEach(report => {
        const tr = document.createElement("tr");
        const reportStatus = statusMap[report.status] || { text: escapeHTML(report.status), class: "" };
        
        // Format date if available
        const reportDate = report.report_date ? new Date(report.report_date).toLocaleDateString("ar-EG") : "-";

        tr.innerHTML = `
            <td>${escapeHTML(report.id || "-")}</td>
            <td>${escapeHTML(report.student_name || "-")}</td> <!-- Assuming student_name is joined in backend -->
            <td>${escapeHTML(report.class_name || "-")}</td> <!-- Assuming class_name is joined -->
            <td>${escapeHTML(report.incident_type || "-")}</td>
            <td>${reportDate}</td>
            <td>${escapeHTML(report.reporter_name || "-")}</td> <!-- Assuming reporter_name is joined -->
            <td><span class="status-badge ${reportStatus.class}">${reportStatus.text}</span></td>
            <td>
                <div class="action-buttons"></div>
            </td>
        `;

        const actionButtonsContainer = tr.querySelector(".action-buttons");

        // View Button (All relevant roles can view)
        const viewButton = document.createElement("button");
        viewButton.className = "btn btn-sm btn-info view-btn"; // Changed color to info
        viewButton.textContent = "عرض";
        viewButton.onclick = () => handleViewBehaviorReport(report);
        actionButtonsContainer.appendChild(viewButton);

        // Edit Button (Admin Supervisor, Assistant Manager, System Admin)
        // Teachers cannot edit after submission (enforced by backend, reflected here)
        if (checkUserRole(["admin_supervisor", "assistant_manager", "system_admin"])) {
            const editButton = document.createElement("button");
            editButton.className = "btn btn-sm btn-warning edit-btn"; // Changed color to warning
            editButton.textContent = "تعديل/تعليق"; // Changed text
            editButton.onclick = () => handleEditBehaviorReport(report);
            actionButtonsContainer.appendChild(editButton);
        }

        tableBody.appendChild(tr);
    });
}

function handleAddBehaviorReport() {
    // TODO: Implement logic to show an "Add Behavior Report" modal/form
    console.log("Add Behavior Report button clicked");
    alert("وظيفة إضافة تقرير سلوك جديد قيد التطوير.");
    // Example: openBehaviorModal(); // Pass no report data for add mode
}

function handleViewBehaviorReport(report) {
    // TODO: Implement logic to show a "View Behavior Report" modal/form (read-only)
    console.log("View Behavior Report button clicked for:", report);
    alert(`وظيفة عرض التقرير رقم ${report.id} قيد التطوير.`);
    // Example: openBehaviorModal(report, true); // Pass report data and readOnly flag
}

function handleEditBehaviorReport(report) {
    // TODO: Implement logic to show an "Edit Behavior Report" modal/form 
    // Allows Admin Supervisor to add comments, and relevant roles to change status.
    console.log("Edit Behavior Report button clicked for:", report);
    alert(`وظيفة تعديل/تعليق على التقرير رقم ${report.id} قيد التطوير.`);
    // Example: openBehaviorModal(report, false); // Pass report data for edit mode
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
            '"': '&quot;',
        };
        return entityMap[s];
    });
}

// TODO: Implement functions for Add/View/Edit Behavior Report Modals/Forms
// function openBehaviorModal(reportData = null, readOnly = false) { ... }
// function handleBehaviorFormSubmit() { ... }

