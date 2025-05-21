// subjects.js - Handles subject management functionality

document.addEventListener("DOMContentLoaded", function() {
    // Check if we are on a page with subject management elements
    const subjectsContainer = document.getElementById("subjects-container");
    if (!subjectsContainer) return;

    // DOM elements
    const subjectsList = document.getElementById("subjects-list");
    const subjectForm = document.getElementById("subject-form");
    const subjectModal = document.getElementById("subject-modal");
    const departmentSelect = document.getElementById("subject-department"); // Select dropdown for department

    let currentSubjectId = null;
    let departments = [];

    // Initialize
    loadSubjects();
    loadDepartmentsForSelect();

    // Event listeners
    if (subjectForm) {
        subjectForm.addEventListener("submit", handleSubjectSubmit);
    }
    
    // Assuming a button to open the modal for creating a new subject
    const addSubjectBtn = document.getElementById("add-subject-btn");
    if (addSubjectBtn) {
        addSubjectBtn.addEventListener("click", () => openSubjectModal());
    }

    // Load all subjects
    async function loadSubjects() {
        try {
            showLoader(subjectsContainer);
            const subjects = await api.getAllSubjects();
            renderSubjectsList(subjects);
            hideLoader(subjectsContainer);
        } catch (error) {
            showError("Failed to load subjects: " + error.message);
            hideLoader(subjectsContainer);
        }
    }

    // Load departments for the select dropdown
    async function loadDepartmentsForSelect() {
        if (!departmentSelect) return;
        try {
            departments = await api.getAllDepartments();
            departmentSelect.innerHTML = 
                '<option value="">اختر القسم (اختياري)</option>' + 
                departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join("");
        } catch (error) {
            showError("Failed to load departments for selection: " + error.message);
        }
    }

    // Render subjects list
    function renderSubjectsList(subjects) {
        if (!subjectsList) return;
        
        subjectsList.innerHTML = "";
        
        if (subjects.length === 0) {
            subjectsList.innerHTML = "<tr><td colspan=\"4\" class=\"text-center\">لا توجد مواد دراسية</td></tr>";
            return;
        }
        
        subjects.forEach(subj => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${subj.name}</td>
                <td>${subj.department_name || "غير محدد"}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-subj" data-id="${subj.id}">تعديل</button>
                    <button class="btn btn-sm btn-danger delete-subj" data-id="${subj.id}">حذف</button>
                </td>
            `;
            subjectsList.appendChild(row);
            
            // Add event listeners
            row.querySelector(".edit-subj").addEventListener("click", () => openSubjectModal(subj));
            row.querySelector(".delete-subj").addEventListener("click", () => deleteSubject(subj.id));
        });
    }

    // Open subject modal for create/edit
    function openSubjectModal(subject = null) {
        const modalTitle = document.querySelector("#subject-modal .modal-title");
        const nameInput = document.getElementById("subject-name");
        const submitBtn = document.getElementById("subject-submit");
        
        // Reset form
        subjectForm.reset();
        
        if (subject) {
            // Edit mode
            modalTitle.textContent = "تعديل المادة الدراسية";
            nameInput.value = subject.name;
            if (departmentSelect && subject.department_id) {
                departmentSelect.value = subject.department_id;
            }
            submitBtn.textContent = "تحديث";
            currentSubjectId = subject.id;
        } else {
            // Create mode
            modalTitle.textContent = "إضافة مادة دراسية جديدة";
            submitBtn.textContent = "إضافة";
            currentSubjectId = null;
        }
        
        // Show modal
        $(subjectModal).modal("show");
    }

    // Handle subject form submission
    async function handleSubjectSubmit(e) {
        e.preventDefault();
        
        const nameInput = document.getElementById("subject-name");
        
        const subjectData = {
            name: nameInput.value.trim(),
            department_id: departmentSelect.value || null
        };
        
        if (!subjectData.name) {
            showError("اسم المادة الدراسية مطلوب");
            return;
        }
        
        try {
            showLoader(subjectForm);
            
            if (currentSubjectId) {
                // Update existing subject
                await api.updateSubject(currentSubjectId, subjectData);
                showSuccess("تم تحديث المادة الدراسية بنجاح");
            } else {
                // Create new subject
                await api.createSubject(subjectData);
                showSuccess("تم إضافة المادة الدراسية بنجاح");
            }
            
            // Reload subjects and close modal
            await loadSubjects();
            $(subjectModal).modal("hide");
            
        } catch (error) {
            showError("فشل في حفظ المادة الدراسية: " + error.message);
        } finally {
            hideLoader(subjectForm);
        }
    }

    // Delete subject
    async function deleteSubject(subjectId) {
        if (!confirm("هل أنت متأكد من حذف هذه المادة الدراسية؟")) {
            return;
        }
        
        try {
            showLoader(subjectsContainer);
            
            await api.deleteSubject(subjectId);
            
            showSuccess("تم حذف المادة الدراسية بنجاح");
            
            // Reload subjects
            await loadSubjects();
            
            hideLoader(subjectsContainer);
            
        } catch (error) {
            showError("فشل في حذف المادة الدراسية: " + error.message);
            hideLoader(subjectsContainer);
        }
    }

    // --- Utility functions (assuming they exist globally or are imported) ---
    // showLoader, hideLoader, showError, showSuccess
    // These should be defined in a shared utility file or main.js
    function showLoader(container) {
        if (!container) return;
        const loader = document.createElement("div");
        loader.className = "loader-overlay";
        loader.innerHTML = 
            '<div class="spinner-border text-primary" role="status"></div>';
        container.appendChild(loader);
    }

    function hideLoader(container) {
        if (!container) return;
        const loader = container.querySelector(".loader-overlay");
        if (loader) {
            loader.remove();
        }
    }

    function showError(message) {
        const alertContainer = document.getElementById("alert-container");
        if (!alertContainer) return;
        
        const alert = document.createElement("div");
        alert.className = "alert alert-danger alert-dismissible fade show";
        alert.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        `;
        
        alertContainer.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.remove("show");
            setTimeout(() => alert.remove(), 150);
        }, 5000);
    }

    function showSuccess(message) {
        const alertContainer = document.getElementById("alert-container");
        if (!alertContainer) return;
        
        const alert = document.createElement("div");
        alert.className = "alert alert-success alert-dismissible fade show";
        alert.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        `;
        
        alertContainer.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.remove("show");
            setTimeout(() => alert.remove(), 150);
        }, 3000);
    }
});

