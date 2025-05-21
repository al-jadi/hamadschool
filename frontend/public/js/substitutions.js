// substitutions.js - Handles temporary substitution management

document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkAuthStatus();
    if (!user) return;
    updateUserUIBasedOnRole(user);

    // Check if we are on the substitutions page
    const substitutionsContainer = document.querySelector(".substitutions-content");
    if (!substitutionsContainer) return;

    // Check permissions
    if (!checkUserRole(["system_admin", "assistant_manager", "department_head"])) {
        displayPermissionError(substitutionsContainer);
        return;
    }

    // DOM elements
    const substitutionsTableBody = document.querySelector(".substitutions-table tbody");
    const substitutionForm = document.getElementById("substitution-modal-form");
    const substitutionModalElement = document.getElementById("substitution-modal");
    const substitutionModal = substitutionModalElement ? new bootstrap.Modal(substitutionModalElement) : null;
    const addSubstitutionBtn = document.querySelector(".add-substitution-btn");
    const dateFilterInput = document.getElementById("date-filter");
    const teacherFilterSelect = document.getElementById("teacher-filter");
    const filterBtn = document.getElementById("filter-btn");

    const substitutionDateInput = document.getElementById("substitution-date");
    const scheduleEntrySelect = document.getElementById("substitution-schedule-entry");
    const substituteTeacherSelect = document.getElementById("substitute-teacher");
    const substitutionReasonInput = document.getElementById("substitution-reason");
    const substitutionIdInput = document.getElementById("substitution-id");

    let allTeachers = [];
    let departmentTeachers = []; // Teachers in the current head's department
    let scheduleEntriesForDate = [];

    // Map day numbers to Arabic names
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    // Initialize
    async function initialize() {
        // Show Add button for authorized roles
        if (addSubstitutionBtn && checkUserRole(["system_admin", "assistant_manager", "department_head"])) {
            addSubstitutionBtn.style.display = "";
        }

        // Set default date filter to today
        dateFilterInput.valueAsDate = new Date();

        await loadTeachersForFilter();
        loadSubstitutions();
    }
    initialize();

    // Event listeners
    if (addSubstitutionBtn) {
        addSubstitutionBtn.addEventListener("click", () => openSubstitutionModal());
    }
    if (substitutionForm) {
        substitutionForm.addEventListener("submit", handleSubstitutionSubmit);
    }
    if (filterBtn) {
        filterBtn.addEventListener("click", loadSubstitutions);
    }
    if (substitutionDateInput) {
        substitutionDateInput.addEventListener("change", handleDateChangeForModal);
    }

    // --- Data Loading Functions ---
    async function loadTeachersForFilter() {
        try {
            // Admins see all teachers, heads see their department teachers
            if (checkUserRole(["system_admin", "assistant_manager"])) {
                allTeachers = await api.getAllUsers({ role: ["teacher", "department_head"] });
            } else if (checkUserRole(["department_head"])) {
                // Assuming the API filters by dept if the user is a dept head
                allTeachers = await api.getAllUsers({ role: ["teacher", "department_head"] });
            }
            populateTeacherFilterDropdown(allTeachers);
        } catch (error) {
            showError("فشل تحميل المعلمين للفلتر: " + error.message);
        }
    }

    async function loadTeachersForModal() {
        try {
            // Substitute can be any teacher
            const allSubstituteTeachers = await api.getAllUsers({ role: ["teacher", "department_head"] });
            populateSubstituteTeacherDropdown(allSubstituteTeachers);
        } catch (error) {
            showError("فشل تحميل المعلمين للنافذة: " + error.message);
        }
    }

    async function loadScheduleEntriesForDate(date) {
        if (!date) {
            scheduleEntrySelect.innerHTML = `<option value="" disabled selected>الرجاء تحديد التاريخ أولاً...</option>`;
            return;
        }
        try {
            const filters = { date: date };
            // Department heads should only see schedule entries for their department teachers
            if (checkUserRole(["department_head"])) {
                 // The backend getAllScheduleEntries needs to support filtering by department head's department
                 // If not, we might need to filter client-side or enhance the API
                 // For now, assume API handles it or we load all and filter later (less efficient)
            }
            scheduleEntriesForDate = await api.getAllScheduleEntries(filters);
            populateScheduleEntryDropdown(scheduleEntriesForDate);
        } catch (error) {
            showError("فشل تحميل الحصص الدراسية للتاريخ المحدد: " + error.message);
            scheduleEntrySelect.innerHTML = `<option value="" disabled selected>خطأ في تحميل الحصص...</option>`;
        }
    }

    // --- Substitution Management ---
    async function loadSubstitutions() {
        const filters = {};
        if (dateFilterInput.value) filters.date = dateFilterInput.value;
        if (teacherFilterSelect.value) filters.originalTeacherId = teacherFilterSelect.value;

        try {
            showLoader(substitutionsTableBody);
            const substitutions = await api.getAllSubstitutions(filters);
            renderSubstitutionsTable(substitutions);
            hideLoader(substitutionsTableBody);
        } catch (error) {
            showError("فشل تحميل الاستبدالات: " + error.message, substitutionsTableBody, 9);
            hideLoader(substitutionsTableBody);
        }
    }

    function renderSubstitutionsTable(substitutions) {
        substitutionsTableBody.innerHTML = "";

        if (substitutions.length === 0) {
            substitutionsTableBody.innerHTML = `<tr><td colspan="9" class="text-center">لا توجد استبدالات تطابق الفلتر.</td></tr>`;
            return;
        }

        const canManage = checkUserRole(["system_admin", "assistant_manager", "department_head"]);
        const currentUser = getCurrentUser();

        substitutions.forEach(sub => {
            const row = document.createElement("tr");
            const scheduleEntry = sub.schedule_entry || {}; // Handle potential null schedule_entry
            const timeSlot = scheduleEntry.time_slot || {};
            const originalTeacher = scheduleEntry.teacher || {};
            const originalSubject = scheduleEntry.subject || {};
            const substituteTeacher = sub.substitute_teacher || {};
            const recordedBy = sub.recorded_by_user || {};

            row.innerHTML = `
                <td>${new Date(sub.substitution_date).toLocaleDateString("ar-SA")}</td>
                <td>${dayNames[timeSlot.day_of_week] || "-"}</td>
                <td>${timeSlot.period_number || "-"} (${timeSlot.start_time || "?"} - ${timeSlot.end_time || "?"})</td>
                <td>${escapeHTML(originalTeacher.name || "N/A")}</td>
                <td>${escapeHTML(originalSubject.name || "N/A")}</td>
                <td>${escapeHTML(substituteTeacher.name || "N/A")}</td>
                <td>${escapeHTML(sub.reason || "-")}</td>
                <td>${escapeHTML(recordedBy.name || "N/A")}</td>
                <td>
                    <div class="action-buttons"></div>
                </td>
            `;
            const actionButtonsContainer = row.querySelector(".action-buttons");

            // Allow deletion only by the recorder or higher admins
            if (canManage && (sub.recorded_by === currentUser?.id || checkUserRole(["system_admin", "assistant_manager"]))) {
                const deleteButton = document.createElement("button");
                deleteButton.className = "btn btn-sm btn-danger delete-substitution";
                deleteButton.textContent = "حذف";
                deleteButton.dataset.id = sub.id;
                deleteButton.addEventListener("click", () => deleteSubstitution(sub.id));
                actionButtonsContainer.appendChild(deleteButton);
            }

            if (actionButtonsContainer.children.length === 0) {
                actionButtonsContainer.textContent = "-"; // No actions available
            }

            substitutionsTableBody.appendChild(row);
        });
    }

    function populateTeacherFilterDropdown(teachersList) {
        if (!teacherFilterSelect) return;
        teacherFilterSelect.innerHTML = `<option value="">كل المعلمين</option>` +
            teachersList.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join("");
    }

    function populateSubstituteTeacherDropdown(teachersList) {
        if (!substituteTeacherSelect) return;
        substituteTeacherSelect.innerHTML = `<option value="" disabled selected>اختر المعلم البديل...</option>` +
            teachersList.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join("");
    }

    function populateScheduleEntryDropdown(entries) {
        if (!scheduleEntrySelect) return;
        if (entries.length === 0) {
             scheduleEntrySelect.innerHTML = `<option value="" disabled selected>لا توجد حصص لهذا التاريخ...</option>`;
             return;
        }
        scheduleEntrySelect.innerHTML = `<option value="" disabled selected>اختر الحصة الأصلية...</option>` +
            entries.map(entry => {
                const timeSlot = entry.time_slot || {};
                const teacher = entry.teacher || {};
                const subject = entry.subject || {};
                return `<option value="${entry.id}">${escapeHTML(teacher.name)} - ${escapeHTML(subject.name)} (${dayNames[timeSlot.day_of_week]} - ${timeSlot.period_number})</option>`;
            }).join("");
    }

    async function openSubstitutionModal() {
        if (!substitutionModal) return;
        substitutionForm.reset();
        substitutionIdInput.value = ""; // Ensure ID is cleared for new entries
        document.getElementById("substitution-modal-title").textContent = "تسجيل استبدال مؤقت";

        // Clear dependent dropdowns
        scheduleEntrySelect.innerHTML = `<option value="" disabled selected>الرجاء تحديد التاريخ أولاً...</option>`;

        await loadTeachersForModal(); // Load teachers for substitute dropdown
        substitutionModal.show();
    }

    async function handleDateChangeForModal() {
        const selectedDate = substitutionDateInput.value;
        await loadScheduleEntriesForDate(selectedDate);
    }

    async function handleSubstitutionSubmit(e) {
        e.preventDefault();

        const substitutionData = {
            substitution_date: substitutionDateInput.value,
            schedule_entry_id: parseInt(scheduleEntrySelect.value, 10),
            substitute_teacher_id: parseInt(substituteTeacherSelect.value, 10),
            reason: substitutionReasonInput.value.trim(),
        };

        if (!substitutionData.substitution_date || !substitutionData.schedule_entry_id || !substitutionData.substitute_teacher_id || !substitutionData.reason) {
            showError("جميع الحقول مطلوبة", substitutionForm);
            return;
        }

        try {
            showLoader(substitutionForm);
            // We are only creating, not editing for now
            await api.createSubstitution(substitutionData);
            showSuccess("تم تسجيل الاستبدال بنجاح");

            await loadSubstitutions(); // Reload table
            substitutionModal.hide();

        } catch (error) {
            showError("فشل في تسجيل الاستبدال: " + error.message, substitutionForm);
        } finally {
            hideLoader(substitutionForm);
        }
    }

    async function deleteSubstitution(substitutionId) {
        if (!confirm("هل أنت متأكد من حذف هذا الاستبدال المؤقت؟ لا يمكن التراجع عن هذا الإجراء.")) {
            return;
        }

        try {
            showLoader(substitutionsTableBody);
            await api.deleteSubstitution(substitutionId);
            showSuccess("تم حذف الاستبدال بنجاح");
            await loadSubstitutions(); // Reload table
            hideLoader(substitutionsTableBody);
        } catch (error) {
            showError("فشل في حذف الاستبدال: " + error.message, substitutionsTableBody, 9);
            hideLoader(substitutionsTableBody);
        }
    }

    // --- Utility Functions (Assume defined elsewhere or copy from other files) ---
    // showLoader, hideLoader, showError, showSuccess, escapeHTML, displayPermissionError, getCurrentUser, checkUserRole
    // Make sure these functions are available in the global scope or imported correctly.

    // Simplified versions for completeness:
    function showLoader(element) {
        if (!element) return;
        const overlay = document.createElement('div');
        overlay.className = 'spinner-overlay';
        overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.7); display: flex; justify-content: center; align-items: center; z-index: 10;';
        overlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
        element.style.position = 'relative';
        element.appendChild(overlay);
    }

    function hideLoader(element) {
        if (!element) return;
        const overlay = element.querySelector('.spinner-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    function showError(message, container = document.body, colspan = 1) {
        console.error(message);
        if (container && container.tagName === "TBODY") {
            container.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-danger">${escapeHTML(message)}</td></tr>`;
        } else {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger alert-dismissible fade show';
            alertDiv.setAttribute('role', 'alert');
            alertDiv.innerHTML = `${escapeHTML(message)}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
            // Prepend error to the container or body
            const targetContainer = (container && container !== document.body) ? container : document.querySelector('.main-content') || document.body;
            targetContainer.insertBefore(alertDiv, targetContainer.firstChild);
        }
    }

    function showSuccess(message) {
        console.log(message);
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show';
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `${escapeHTML(message)}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
        const targetContainer = document.querySelector('.main-content') || document.body;
        targetContainer.insertBefore(alertDiv, targetContainer.firstChild);
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const alertInstance = bootstrap.Alert.getOrCreateInstance(alertDiv);
            if (alertInstance) {
                alertInstance.close();
            }
        }, 5000);
    }

    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return String(str).replace(/[&<>"]/g, function (s) {
            const entityMap = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': '&quot;'
            };
            return entityMap[s];
        });
    }

    function displayPermissionError(container) {
        if (container) {
            container.innerHTML = `<div class="alert alert-danger">ليس لديك الصلاحية لعرض أو إدارة هذا القسم.</div>`;
        }
    }

    // Assume getCurrentUser() and checkUserRole() are available from admin-permissions.js or local-auth.js
});

