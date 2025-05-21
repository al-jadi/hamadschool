// JavaScript for Attendance Page (using API)

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
        displayPermissionError("attendance-content");
        return;
    }

    // Setup event listeners and load initial data
    await populateClassFilter(user);
    setupAttendanceEventListeners(user);
    loadAttendanceData(user);
});

async function populateClassFilter(user) {
    const classFilter = document.getElementById("class-filter");
    if (!classFilter) return;

    try {
        // Fetch classes - adjust API endpoint/params as needed
        // Maybe fetch classes assigned to the teacher if role is teacher?
        const classes = await api.getClasses(); // Assuming an endpoint exists
        classFilter.innerHTML = ""; // Clear existing options

        if (classes.length === 0) {
            classFilter.innerHTML = "<option value=\"\">لا توجد فصول</option>";
            return;
        }

        classes.forEach(cls => {
            const option = document.createElement("option");
            option.value = cls.id;
            option.textContent = cls.name;
            classFilter.appendChild(option);
        });

        // Trigger loading data for the first class in the list
        if (classes.length > 0) {
            loadAttendanceData(user);
        }

    } catch (error) {
        console.error("Error fetching classes:", error);
        classFilter.innerHTML = "<option value=\"\">خطأ في تحميل الفصول</option>";
    }
}

function setupAttendanceEventListeners(user) {
    const classFilter = document.getElementById("class-filter");
    const dateFilter = document.getElementById("date-filter");
    const periodFilter = document.getElementById("period-filter");
    const saveButton = document.querySelector(".save-attendance-btn");

    if (classFilter) classFilter.addEventListener("change", () => loadAttendanceData(user));
    if (dateFilter) dateFilter.addEventListener("change", () => loadAttendanceData(user));
    if (periodFilter) periodFilter.addEventListener("change", () => loadAttendanceData(user));

    if (saveButton) {
        // Enable/disable save button based on role
        if (checkUserRole(["teacher", "admin_supervisor", "assistant_manager", "system_admin"])) {
            saveButton.style.display = ""; // Show button
            saveButton.addEventListener("click", () => handleSaveAttendance(user));
        } else {
            saveButton.style.display = "none"; // Hide button
        }
    }
}

async function loadAttendanceData(user) {
    const attendanceTableBody = document.querySelector(".attendance-table tbody");
    const classFilter = document.getElementById("class-filter");
    const dateFilter = document.getElementById("date-filter");
    const periodFilter = document.getElementById("period-filter");
    const saveButton = document.querySelector(".save-attendance-btn");

    if (!attendanceTableBody || !classFilter || !dateFilter || !periodFilter) return;

    const classId = classFilter.value;
    const date = dateFilter.value;
    const period = periodFilter.value; // "all" or period number

    if (!classId || !date) {
        attendanceTableBody.innerHTML = `<tr><td colspan="4" class="text-center">يرجى تحديد الصف والتاريخ.</td></tr>`;
        return;
    }

    attendanceTableBody.innerHTML = 
        `<tr><td colspan="4" class="text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> جارٍ تحميل الطلاب والحضور...</td></tr>`;
    if (saveButton) saveButton.disabled = true; // Disable save while loading

    try {
        // 1. Fetch students for the selected class
        const students = await api.getStudents({ class_id: classId }); // Assuming filter by class_id

        // 2. Fetch existing attendance records for the selected class, date, and period
        const attendanceParams = { class_id: classId, date: date };
        if (period !== "all") {
            attendanceParams.period = period;
        }
        const existingAttendance = await api.getAttendance(attendanceParams);

        // Create a map for quick lookup of existing records
        const attendanceMap = new Map();
        existingAttendance.forEach(record => {
            // Key might need adjustment based on API response (e.g., student_id + period)
            const key = period === "all" ? record.student_id : `${record.student_id}-${record.period}`;
            attendanceMap.set(key, record);
        });

        renderAttendanceTable(students, attendanceMap, attendanceTableBody, user, period);

        // Enable save button after loading
        if (saveButton && checkUserRole(["teacher", "admin_supervisor", "assistant_manager", "system_admin"])) {
            saveButton.disabled = false;
        }

    } catch (error) {
        console.error("Error loading attendance data:", error);
        attendanceTableBody.innerHTML = 
            `<tr><td colspan="4" class="text-center text-danger">حدث خطأ أثناء تحميل البيانات: ${error.message}</td></tr>`;
    }
}

function renderAttendanceTable(students, attendanceMap, tableBody, currentUser, selectedPeriod) {
    tableBody.innerHTML = ""; // Clear loading/error state

    if (students.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center">لا يوجد طلاب في هذا الصف.</td></tr>`;
        return;
    }

    let attendanceAlreadySavedForPeriod = false; // Flag for teacher role restriction

    students.forEach(student => {
        const studentId = student.id;
        // Determine the key based on whether a specific period is selected
        const recordKey = selectedPeriod === "all" ? studentId : `${studentId}-${selectedPeriod}`;
        const record = attendanceMap.get(recordKey);

        // Check if attendance was already saved for this specific period (relevant for teachers)
        if (record && selectedPeriod !== "all" && record.period == selectedPeriod) {
            attendanceAlreadySavedForPeriod = true;
        }

        const tr = document.createElement("tr");
        tr.dataset.studentId = studentId;

        const currentStatus = record ? record.status : "present"; // Default to present if no record
        const currentNotes = record ? record.notes : "";

        // Determine if fields should be disabled (for teachers after saving)
        // Admin Supervisors etc. should always be able to edit
        const isDisabled = currentUser.role === "teacher" && record && selectedPeriod !== "all" && record.period == selectedPeriod;

        tr.innerHTML = `
            <td>${escapeHTML(student.name || "-")}</td>
            <td>${escapeHTML(student.student_id || "-")}</td> <!-- Assuming student_id field exists -->
            <td>
                <select class="status-select" ${isDisabled ? "disabled" : ""}>
                    <option value="present" ${currentStatus === "present" ? "selected" : ""}>حاضر</option>
                    <option value="absent" ${currentStatus === "absent" ? "selected" : ""}>غائب</option>
                    <option value="late" ${currentStatus === "late" ? "selected" : ""}>متأخر</option>
                </select>
            </td>
            <td><input type="text" placeholder="أضف ملاحظة..." value="${escapeHTML(currentNotes)}" ${isDisabled ? "disabled" : ""}></td>
        `;

        // Add event listener for status change to update background color
        const statusSelect = tr.querySelector(".status-select");
        statusSelect.classList.add(currentStatus); // Set initial color
        statusSelect.addEventListener("change", function() {
            this.className = "status-select"; // Reset classes
            this.classList.add(this.value);
        });

        tableBody.appendChild(tr);
    });

    // Disable save button for teacher if attendance for the specific period was already saved
    const saveButton = document.querySelector(".save-attendance-btn");
    if (saveButton && currentUser.role === "teacher" && attendanceAlreadySavedForPeriod && selectedPeriod !== "all") {
        saveButton.disabled = true;
        saveButton.title = "تم حفظ الحضور لهذه الحصة بالفعل.";
    } else if (saveButton) {
        saveButton.disabled = false;
        saveButton.title = "";
    }
}

async function handleSaveAttendance(user) {
    const attendanceTableBody = document.querySelector(".attendance-table tbody");
    const classFilter = document.getElementById("class-filter");
    const dateFilter = document.getElementById("date-filter");
    const periodFilter = document.getElementById("period-filter");
    const saveButton = document.querySelector(".save-attendance-btn");

    const classId = classFilter.value;
    const date = dateFilter.value;
    const period = periodFilter.value;

    if (!classId || !date || period === "all") {
        alert("يرجى تحديد الصف والتاريخ وحصة معينة لحفظ الحضور.");
        return;
    }

    const attendanceData = [];
    const rows = attendanceTableBody.querySelectorAll("tr");

    rows.forEach(row => {
        const studentId = row.dataset.studentId;
        const statusSelect = row.querySelector(".status-select");
        const notesInput = row.querySelector("input[type=\"text\"]");

        // Only include if studentId exists and select is not disabled (relevant for teacher re-saving)
        if (studentId && statusSelect && !statusSelect.disabled) {
            attendanceData.push({
                student_id: parseInt(studentId),
                class_id: parseInt(classId),
                date: date,
                period: parseInt(period),
                status: statusSelect.value,
                notes: notesInput.value,
                recorded_by: user.id // Add user ID who recorded
            });
        }
    });

    if (attendanceData.length === 0) {
        alert("لا توجد بيانات حضور جديدة أو قابلة للتعديل للحفظ.");
        return;
    }

    saveButton.disabled = true;
    saveButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جارٍ الحفظ...`;

    try {
        // Use bulk update/insert endpoint
        await api.saveAttendanceBulk(attendanceData);
        alert("تم حفظ بيانات الحضور بنجاح!");

        // Reload data to reflect changes and potentially disable fields for teacher
        loadAttendanceData(user);

    } catch (error) {
        console.error("Error saving attendance:", error);
        alert(`فشل حفظ الحضور: ${error.message}`);
        saveButton.disabled = false; // Re-enable on error
    } finally {
        saveButton.innerHTML = "حفظ الحضور";
    }
}

// Helper function to display permission errors
function displayPermissionError(containerClass) {
    const mainContent = document.querySelector(`.${containerClass}`);
    if (mainContent) {
        mainContent.innerHTML = `<div class="alert alert-danger">ليس لديك الصلاحية لعرض أو استخدام هذه الصفحة.</div>`;
    }
}

// Helper function to escape HTML (reuse from users.js or create shared utility)
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

