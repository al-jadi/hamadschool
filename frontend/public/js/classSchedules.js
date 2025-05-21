// classSchedules.js - Handles class schedule management and swap requests

document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkAuthStatus();
    if (!user) return;
    updateUserUIBasedOnRole(user);

    // Check if we are on a page with schedule management elements
    const scheduleContainer = document.getElementById("schedule-container");
    const swapRequestsContainer = document.getElementById("swap-requests-container");
    if (!scheduleContainer && !swapRequestsContainer) return;

    // DOM elements
    const scheduleTableBody = document.getElementById("schedule-table-body");
    const scheduleForm = document.getElementById("schedule-form");
    const scheduleModalElement = document.getElementById("schedule-modal");
    const scheduleModal = scheduleModalElement ? new bootstrap.Modal(scheduleModalElement) : null;
    const classSelect = document.getElementById("schedule-class");
    const teacherSelect = document.getElementById("schedule-teacher");
    const subjectSelect = document.getElementById("schedule-subject");
    const timeSlotSelect = document.getElementById("schedule-time-slot");
    const scheduleFilterForm = document.getElementById("schedule-filter-form");
    const filterClassSelect = document.getElementById("filter-class");
    const filterTeacherSelect = document.getElementById("filter-teacher");

    const swapRequestsList = document.getElementById("swap-requests-list");
    const swapRequestModalElement = document.getElementById("swap-request-modal");
    const swapRequestModal = swapRequestModalElement ? new bootstrap.Modal(swapRequestModalElement) : null;
    const swapRequestForm = document.getElementById("swap-request-form");
    const swapTargetTeacherSelect = document.getElementById("swap-target-teacher");
    const swapTargetTimeSlotSelect = document.getElementById("swap-target-time-slot");
    const swapReasonInput = document.getElementById("swap-reason");
    const swapDetailsModalElement = document.getElementById("swap-details-modal");
    const swapDetailsModal = swapDetailsModalElement ? new bootstrap.Modal(swapDetailsModalElement) : null;

    let currentScheduleEntryId = null;
    let currentSwapRequestId = null;
    let classes = [];
    let teachers = [];
    let subjects = [];
    let timeSlots = [];
    let scheduleEntries = [];
    let swapRequests = [];
    let selectedScheduleEntryForSwap = null;

    // Map day numbers to Arabic names
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    // Initialize
    async function initialize() {
        // Check permissions
        if (scheduleContainer && !checkUserRole(["system_admin", "assistant_manager", "department_head", "teacher"])) {
            displayPermissionError(scheduleContainer);
            return;
        }
        if (swapRequestsContainer && !checkUserRole(["system_admin", "assistant_manager", "department_head"])) {
            displayPermissionError(swapRequestsContainer);
            return;
        }

        await Promise.all([
            loadClasses(),
            loadTeachers(),
            loadSubjects(),
            loadTimeSlots() // Load time slots including 7th period
        ]);
        if (scheduleContainer) {
            loadScheduleEntries();
            populateFilterDropdowns();
            // Show/Hide Add button based on role
            const addScheduleEntryBtn = document.getElementById("add-schedule-entry-btn");
            if (addScheduleEntryBtn) {
                if (checkUserRole(["system_admin", "assistant_manager"])) {
                    addScheduleEntryBtn.style.display = "";
                } else {
                    addScheduleEntryBtn.style.display = "none";
                }
            }
        }
        if (swapRequestsContainer) {
            loadSwapRequests();
        }
    }
    initialize();

    // Event listeners
    if (scheduleForm) {
        scheduleForm.addEventListener("submit", handleScheduleSubmit);
    }
    if (scheduleFilterForm) {
        scheduleFilterForm.addEventListener("submit", handleScheduleFilter);
    }
    if (swapRequestForm) {
        swapRequestForm.addEventListener("submit", handleSwapRequestSubmit);
    }

    const addScheduleEntryBtn = document.getElementById("add-schedule-entry-btn");
    if (addScheduleEntryBtn) {
        addScheduleEntryBtn.addEventListener("click", () => openScheduleModal());
    }

    // --- Data Loading Functions ---
    async function loadClasses() {
        try {
            classes = await api.getAllClasses();
        } catch (error) {
            showError("فشل تحميل الفصول: " + error.message);
        }
    }
    async function loadTeachers() {
        try {
            teachers = await api.getAllUsers({ role: ["teacher", "department_head"] });
        } catch (error) {
            showError("فشل تحميل المعلمين: " + error.message);
        }
    }
    async function loadSubjects() {
        try {
            subjects = await api.getAllSubjects();
        } catch (error) {
            showError("فشل تحميل المواد: " + error.message);
        }
    }
    async function loadTimeSlots() {
        try {
            timeSlots = await api.getAllTimeSlots();
            timeSlots.sort((a, b) => {
                if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
                return a.period_number - b.period_number;
            });
        } catch (error) {
            showError("فشل تحميل الفترات الزمنية: " + error.message);
        }
    }

    // --- Schedule Management ---
    async function loadScheduleEntries(filters = {}) {
        if (!scheduleContainer) return;
        try {
            showLoader(scheduleTableBody);
            scheduleEntries = await api.getAllScheduleEntries(filters);
            renderScheduleTable(scheduleEntries);
            hideLoader(scheduleTableBody);
        } catch (error) {
            showError("فشل تحميل إدخالات الجدول: " + error.message, scheduleTableBody, 7);
            hideLoader(scheduleTableBody);
        }
    }

    function renderScheduleTable(entries) {
        if (!scheduleTableBody) return;
        scheduleTableBody.innerHTML = "";

        if (entries.length === 0) {
            scheduleTableBody.innerHTML = `<tr><td colspan="7" class="text-center">لا توجد إدخالات في الجدول تطابق الفلتر.</td></tr>`;
            return;
        }

        // Sort entries for display
        entries.sort((a, b) => {
            if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
            if (a.period_number !== b.period_number) return a.period_number - b.period_number;
            return (a.class_name || "").localeCompare(b.class_name || "");
        });

        const canManageSchedule = checkUserRole(["system_admin", "assistant_manager"]);
        const canRequestSwap = checkUserRole(["system_admin", "assistant_manager", "department_head"]);

        entries.forEach(entry => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${escapeHTML(entry.class_name || "N/A")}</td>
                <td>${dayNames[entry.day_of_week] || entry.day_of_week}</td>
                <td>${entry.period_number} (${entry.start_time} - ${entry.end_time})</td>
                <td>${escapeHTML(entry.subject_name || "N/A")}</td>
                <td>${escapeHTML(entry.teacher_name || "N/A")}</td>
                <td>
                    <div class="action-buttons"></div>
                </td>
            `;
            const actionButtonsContainer = row.querySelector(".action-buttons");

            if (canManageSchedule) {
                const editButton = document.createElement("button");
                editButton.className = "btn btn-sm btn-primary edit-entry";
                editButton.textContent = "تعديل";
                editButton.dataset.id = entry.id;
                editButton.addEventListener("click", () => openScheduleModal(entry));
                actionButtonsContainer.appendChild(editButton);
            }
            if (canRequestSwap) {
                const swapButton = document.createElement("button");
                swapButton.className = "btn btn-sm btn-warning request-swap";
                swapButton.textContent = "طلب تبديل";
                swapButton.dataset.id = entry.id;
                swapButton.addEventListener("click", () => openSwapRequestModal(entry));
                actionButtonsContainer.appendChild(swapButton);
            }
            if (canManageSchedule) {
                const deleteButton = document.createElement("button");
                deleteButton.className = "btn btn-sm btn-danger delete-entry";
                deleteButton.textContent = "حذف";
                deleteButton.dataset.id = entry.id;
                deleteButton.addEventListener("click", () => deleteScheduleEntry(entry.id));
                actionButtonsContainer.appendChild(deleteButton);
            }
            if (actionButtonsContainer.children.length === 0) {
                actionButtonsContainer.textContent = "-"; // No actions available
            }

            scheduleTableBody.appendChild(row);
        });
    }

    function populateDropdowns(modalElement) {
        const classSel = modalElement.querySelector(".schedule-class-select");
        const teacherSel = modalElement.querySelector(".schedule-teacher-select");
        const subjectSel = modalElement.querySelector(".schedule-subject-select");
        const timeSlotSel = modalElement.querySelector(".schedule-timeslot-select");

        if (classSel) {
            classSel.innerHTML = 
                `<option value="" disabled selected>اختر الفصل...</option>` + 
                classes.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
        }
        if (teacherSel) {
            teacherSel.innerHTML = 
                `<option value="" disabled selected>اختر المعلم...</option>` + 
                teachers.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join("");
        }
        if (subjectSel) {
            subjectSel.innerHTML = 
                `<option value="" disabled selected>اختر المادة...</option>` + 
                subjects.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join("");
        }
        if (timeSlotSel) {
            timeSlotSel.innerHTML = 
                `<option value="" disabled selected>اختر الفترة...</option>` + 
                timeSlots.map(ts => `<option value="${ts.id}">${dayNames[ts.day_of_week]} - ${ts.period_number} (${ts.start_time}-${ts.end_time})</option>`).join("");
        }
    }
    
    function populateFilterDropdowns() {
        if (filterClassSelect) {
            filterClassSelect.innerHTML = 
                `<option value="">كل الفصول</option>` + 
                classes.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
        }
        if (filterTeacherSelect) {
            filterTeacherSelect.innerHTML = 
                `<option value="">كل المعلمين</option>` + 
                teachers.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join("");
        }
    }

    function openScheduleModal(entry = null) {
        if (!scheduleModal) return;
        const modalTitle = scheduleModalElement.querySelector(".modal-title");
        const submitBtn = document.getElementById("schedule-submit");

        scheduleForm.reset();
        populateDropdowns(scheduleModalElement);

        if (entry) {
            // Edit mode
            modalTitle.textContent = "تعديل إدخال الجدول";
            if (classSelect) classSelect.value = entry.class_id;
            if (teacherSelect) teacherSelect.value = entry.teacher_id;
            if (subjectSelect) subjectSelect.value = entry.subject_id;
            if (timeSlotSelect) timeSlotSelect.value = entry.time_slot_id;
            submitBtn.textContent = "تحديث";
            currentScheduleEntryId = entry.id;
        } else {
            // Create mode
            modalTitle.textContent = "إضافة إدخال جديد للجدول";
            submitBtn.textContent = "إضافة";
            currentScheduleEntryId = null;
        }

        scheduleModal.show();
    }

    async function handleScheduleSubmit(e) {
        e.preventDefault();

        const entryData = {
            class_id: parseInt(classSelect.value, 10),
            teacher_id: parseInt(teacherSelect.value, 10),
            subject_id: parseInt(subjectSelect.value, 10),
            time_slot_id: parseInt(timeSlotSelect.value, 10),
        };

        if (!entryData.class_id || !entryData.teacher_id || !entryData.subject_id || !entryData.time_slot_id) {
            showError("جميع الحقول مطلوبة", scheduleForm);
            return;
        }

        try {
            showLoader(scheduleForm);

            if (currentScheduleEntryId) {
                await api.updateScheduleEntry(currentScheduleEntryId, entryData);
                showSuccess("تم تحديث إدخال الجدول بنجاح");
            } else {
                await api.createScheduleEntry(entryData);
                showSuccess("تم إضافة إدخال الجدول بنجاح");
            }

            await loadScheduleEntries(); // Reload with current filters
            scheduleModal.hide();

        } catch (error) {
            showError("فشل في حفظ إدخال الجدول: " + error.message, scheduleForm);
        } finally {
            hideLoader(scheduleForm);
        }
    }

    async function deleteScheduleEntry(entryId) {
        if (!confirm("هل أنت متأكد من حذف هذا الإدخال من الجدول؟")) {
            return;
        }

        try {
            showLoader(scheduleTableBody);
            await api.deleteScheduleEntry(entryId);
            showSuccess("تم حذف إدخال الجدول بنجاح");
            await loadScheduleEntries(); // Reload with current filters
            hideLoader(scheduleTableBody);
        } catch (error) {
            showError("فشل في حذف إدخال الجدول: " + error.message, scheduleTableBody, 7);
            hideLoader(scheduleTableBody);
        }
    }
    
    function handleScheduleFilter(e) {
        e.preventDefault();
        const filters = {};
        if (filterClassSelect.value) filters.classId = filterClassSelect.value;
        if (filterTeacherSelect.value) filters.teacherId = filterTeacherSelect.value;
        loadScheduleEntries(filters);
    }

    // --- Swap Request Management ---
    async function loadSwapRequests(filters = {}) {
        if (!swapRequestsContainer) return;
        try {
            showLoader(swapRequestsList);
            swapRequests = await api.getAllSwapRequests(filters);
            renderSwapRequestsList(swapRequests);
            hideLoader(swapRequestsList);
        } catch (error) {
            showError("فشل تحميل طلبات التبديل: " + error.message, swapRequestsList, 7);
            hideLoader(swapRequestsList);
        }
    }

    function renderSwapRequestsList(requests) {
        if (!swapRequestsList) return;
        swapRequestsList.innerHTML = "";

        if (requests.length === 0) {
            swapRequestsList.innerHTML = `<tr><td colspan="7" class="text-center">لا توجد طلبات تبديل حاليًا.</td></tr>`;
            return;
        }

        requests.forEach(req => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${escapeHTML(req.requesting_teacher_name)}</td>
                <td>${dayNames[req.original_day_of_week]} - ${req.original_period_number} (${escapeHTML(req.original_subject_name)})</td>
                <td>${escapeHTML(req.target_teacher_name)}</td>
                <td>${dayNames[req.target_day_of_week]} - ${req.target_period_number} (${escapeHTML(req.target_subject_name)})</td>
                <td><span class="badge bg-${getStatusColor(req.status)}">${req.status}</span></td>
                <td>${new Date(req.created_at).toLocaleString("ar-SA")}</td>
                <td>
                    <button class="btn btn-sm btn-info view-swap" data-id="${req.id}">عرض التفاصيل</button>
                </td>
            `;
            swapRequestsList.appendChild(row);

            row.querySelector(".view-swap").addEventListener("click", () => viewSwapRequestDetails(req.id));
        });
    }

    function getStatusColor(status) {
        switch (status) {
            case "pending": return "warning text-dark";
            case "approved": return "success";
            case "rejected": return "danger";
            case "cancelled": return "secondary";
            default: return "light text-dark";
        }
    }

    function openSwapRequestModal(scheduleEntry) {
        if (!swapRequestModal) return;
        selectedScheduleEntryForSwap = scheduleEntry;
        swapRequestForm.reset();

        const currentUser = getCurrentUser(); // Get current user info
        if (!currentUser) return;

        // Populate target teacher dropdown (excluding self)
        swapTargetTeacherSelect.innerHTML = 
            `<option value="" disabled selected>اختر المعلم المستهدف...</option>` + 
            teachers
                .filter(t => t.id !== currentUser.id) // Exclude self
                .map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join("");

        // Populate target time slot dropdown (excluding original slot)
        swapTargetTimeSlotSelect.innerHTML = 
            `<option value="" disabled selected>اختر الفترة المستهدفة...</option>` + 
            timeSlots
                .filter(ts => ts.id !== scheduleEntry.time_slot_id) // Exclude original slot
                .map(ts => `<option value="${ts.id}">${dayNames[ts.day_of_week]} - ${ts.period_number} (${ts.start_time}-${ts.end_time})</option>`).join("");

        swapRequestModal.show();
    }

    async function handleSwapRequestSubmit(e) {
        e.preventDefault();

        if (!selectedScheduleEntryForSwap) {
            showError("لم يتم تحديد حصة لطلب التبديل.", swapRequestForm);
            return;
        }

        const requestData = {
            original_schedule_entry_id: selectedScheduleEntryForSwap.id,
            target_teacher_id: parseInt(swapTargetTeacherSelect.value, 10),
            target_time_slot_id: parseInt(swapTargetTimeSlotSelect.value, 10),
            reason: swapReasonInput.value.trim(),
        };

        if (!requestData.target_teacher_id || !requestData.target_time_slot_id || !requestData.reason) {
            showError("المعلم المستهدف، الفترة المستهدفة، والسبب مطلوبون.", swapRequestForm);
            return;
        }

        try {
            showLoader(swapRequestForm);
            await api.createSwapRequest(requestData);
            showSuccess("تم إرسال طلب التبديل بنجاح.");
            swapRequestModal.hide();
            selectedScheduleEntryForSwap = null;
            if (swapRequestsContainer) await loadSwapRequests(); // Reload if on swap requests page
        } catch (error) {
            showError("فشل في إرسال طلب التبديل: " + error.message, swapRequestForm);
        } finally {
            hideLoader(swapRequestForm);
        }
    }

    async function viewSwapRequestDetails(requestId) {
        if (!swapDetailsModal) return;
        try {
            showLoader(swapRequestsContainer || scheduleContainer);
            const request = await api.getSwapRequestById(requestId);
            hideLoader(swapRequestsContainer || scheduleContainer);

            // Populate modal content
            document.getElementById("swap-detail-requester").textContent = escapeHTML(request.requesting_teacher_name);
            document.getElementById("swap-detail-original-slot").textContent = `${dayNames[request.original_day_of_week]} - ${request.original_period_number} (${escapeHTML(request.original_subject_name)})`;
            document.getElementById("swap-detail-target-teacher").textContent = escapeHTML(request.target_teacher_name);
            document.getElementById("swap-detail-target-slot").textContent = `${dayNames[request.target_day_of_week]} - ${request.target_period_number} (${escapeHTML(request.target_subject_name)})`;
            document.getElementById("swap-detail-reason").textContent = escapeHTML(request.reason);
            document.getElementById("swap-detail-status").innerHTML = `<span class="badge bg-${getStatusColor(request.status)}">${request.status}</span>`;
            document.getElementById("swap-detail-created").textContent = new Date(request.created_at).toLocaleString("ar-SA");

            // Approval/Rejection buttons (logic depends on user role and request status)
            const approvalSection = document.getElementById("swap-approval-section");
            approvalSection.innerHTML = ""; // Clear previous buttons
            currentSwapRequestId = requestId;

            // Example: Add buttons if user is approver and status is pending
            const currentUser = getCurrentUser();
            // This logic needs refinement based on the exact approval workflow (e.g., who approves?)
            if (request.status === "pending" && checkUserRole(["system_admin", "assistant_manager", "department_head"])) { 
                const approveBtn = document.createElement("button");
                approveBtn.className = "btn btn-success me-2";
                approveBtn.textContent = "موافقة";
                approveBtn.onclick = () => handleSwapApproval("approved");
                approvalSection.appendChild(approveBtn);

                const rejectBtn = document.createElement("button");
                rejectBtn.className = "btn btn-danger";
                rejectBtn.textContent = "رفض";
                rejectBtn.onclick = () => handleSwapApproval("rejected");
                approvalSection.appendChild(rejectBtn);
            }
            // Add cancel button if user is requester and status is pending
            if (request.status === "pending" && request.requesting_teacher_id === currentUser?.id) {
                 const cancelBtn = document.createElement("button");
                 cancelBtn.className = "btn btn-secondary ms-auto"; // Push to the right
                 cancelBtn.textContent = "إلغاء الطلب";
                 cancelBtn.onclick = () => handleSwapApproval("cancelled");
                 approvalSection.appendChild(cancelBtn);
            }

            swapDetailsModal.show();

        } catch (error) {
            showError("فشل تحميل تفاصيل طلب التبديل: " + error.message);
            hideLoader(swapRequestsContainer || scheduleContainer);
        }
    }

    async function handleSwapApproval(newStatus) {
        if (!currentSwapRequestId) return;

        const confirmationMessages = {
            approved: "هل أنت متأكد من الموافقة على طلب التبديل؟",
            rejected: "هل أنت متأكد من رفض طلب التبديل؟",
            cancelled: "هل أنت متأكد من إلغاء طلب التبديل؟"
        };

        if (!confirm(confirmationMessages[newStatus] || "هل أنت متأكد؟")) {
            return;
        }

        try {
            showLoader(swapDetailsModalElement); // Show loader inside the modal
            await api.updateSwapRequestStatus(currentSwapRequestId, { status: newStatus });
            showSuccess(`تم ${newStatus === 'approved' ? 'الموافقة على' : newStatus === 'rejected' ? 'رفض' : 'إلغاء'} الطلب بنجاح.`);
            swapDetailsModal.hide();
            if (swapRequestsContainer) await loadSwapRequests(); // Reload list
        } catch (error) {
            showError(`فشل تحديث حالة الطلب: ${error.message}`, swapDetailsModalElement);
        } finally {
            hideLoader(swapDetailsModalElement);
        }
    }

    // --- Utility Functions ---
    function showLoader(element) {
        // Simple loader indication (replace with a proper spinner if needed)
        if (element) {
            const loader = document.createElement("div");
            loader.className = "spinner-overlay";
            loader.innerHTML = `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>`;
            element.style.position = "relative"; // Needed for overlay
            element.appendChild(loader);
        }
    }

    function hideLoader(element) {
        if (element) {
            const loader = element.querySelector(".spinner-overlay");
            if (loader) {
                loader.remove();
            }
        }
    }

    function showError(message, container = document.body, colspan = 1) {
        console.error(message);
        if (container && container.tagName === "TBODY") {
            container.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-danger">${message}</td></tr>`;
        } else {
            // Simple alert for now, consider a more integrated notification system
            alert("خطأ: " + message);
        }
    }

    function showSuccess(message) {
        console.log(message);
        // Simple alert for now
        alert("نجاح: " + message);
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

    // Assume getCurrentUser() and checkUserRole() are defined globally or imported
    // Assume api object with necessary methods is defined globally or imported
});

