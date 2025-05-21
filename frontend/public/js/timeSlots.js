// timeSlots.js - Handles time slot management functionality

document.addEventListener("DOMContentLoaded", function() {
    // Check if we are on a page with time slot management elements
    const timeSlotsContainer = document.getElementById("time-slots-container");
    if (!timeSlotsContainer) return;

    // DOM elements
    const timeSlotsList = document.getElementById("time-slots-list");
    const timeSlotForm = document.getElementById("time-slot-form");
    const timeSlotModal = document.getElementById("time-slot-modal");

    let currentTimeSlotId = null;

    // Map day numbers to Arabic names
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    // Initialize
    loadTimeSlots();

    // Event listeners
    if (timeSlotForm) {
        timeSlotForm.addEventListener("submit", handleTimeSlotSubmit);
    }
    
    // Assuming a button to open the modal for creating a new time slot
    const addTimeSlotBtn = document.getElementById("add-time-slot-btn");
    if (addTimeSlotBtn) {
        addTimeSlotBtn.addEventListener("click", () => openTimeSlotModal());
    }

    // Load all time slots
    async function loadTimeSlots() {
        try {
            showLoader(timeSlotsContainer);
            const timeSlots = await api.getAllTimeSlots();
            renderTimeSlotsList(timeSlots);
            hideLoader(timeSlotsContainer);
        } catch (error) {
            showError("Failed to load time slots: " + error.message);
            hideLoader(timeSlotsContainer);
        }
    }

    // Render time slots list
    function renderTimeSlotsList(timeSlots) {
        if (!timeSlotsList) return;
        
        timeSlotsList.innerHTML = "";
        
        if (timeSlots.length === 0) {
            timeSlotsList.innerHTML = "<tr><td colspan=\"5\" class=\"text-center\">لا توجد فترات زمنية</td></tr>";
            return;
        }
        
        // Sort by day then period number
        timeSlots.sort((a, b) => {
            if (a.day_of_week !== b.day_of_week) {
                return a.day_of_week - b.day_of_week;
            }
            return a.period_number - b.period_number;
        });
        
        timeSlots.forEach(slot => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${dayNames[slot.day_of_week] || slot.day_of_week}</td>
                <td>${slot.period_number}</td>
                <td>${slot.start_time}</td>
                <td>${slot.end_time}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-slot" data-id="${slot.id}">تعديل</button>
                    <button class="btn btn-sm btn-danger delete-slot" data-id="${slot.id}">حذف</button>
                </td>
            `;
            timeSlotsList.appendChild(row);
            
            // Add event listeners
            row.querySelector(".edit-slot").addEventListener("click", () => openTimeSlotModal(slot));
            row.querySelector(".delete-slot").addEventListener("click", () => deleteTimeSlot(slot.id));
        });
    }

    // Open time slot modal for create/edit
    function openTimeSlotModal(slot = null) {
        const modalTitle = document.querySelector("#time-slot-modal .modal-title");
        const daySelect = document.getElementById("time-slot-day");
        const periodInput = document.getElementById("time-slot-period");
        const startInput = document.getElementById("time-slot-start");
        const endInput = document.getElementById("time-slot-end");
        const submitBtn = document.getElementById("time-slot-submit");
        
        // Reset form
        timeSlotForm.reset();
        
        if (slot) {
            // Edit mode
            modalTitle.textContent = "تعديل الفترة الزمنية";
            daySelect.value = slot.day_of_week;
            periodInput.value = slot.period_number;
            startInput.value = slot.start_time;
            endInput.value = slot.end_time;
            submitBtn.textContent = "تحديث";
            currentTimeSlotId = slot.id;
        } else {
            // Create mode
            modalTitle.textContent = "إضافة فترة زمنية جديدة";
            submitBtn.textContent = "إضافة";
            currentTimeSlotId = null;
        }
        
        // Show modal
        $(timeSlotModal).modal("show");
    }

    // Handle time slot form submission
    async function handleTimeSlotSubmit(e) {
        e.preventDefault();
        
        const daySelect = document.getElementById("time-slot-day");
        const periodInput = document.getElementById("time-slot-period");
        const startInput = document.getElementById("time-slot-start");
        const endInput = document.getElementById("time-slot-end");
        
        const timeSlotData = {
            day_of_week: parseInt(daySelect.value),
            period_number: parseInt(periodInput.value),
            start_time: startInput.value,
            end_time: endInput.value
        };
        
        if (isNaN(timeSlotData.day_of_week) || isNaN(timeSlotData.period_number) || !timeSlotData.start_time || !timeSlotData.end_time) {
            showError("جميع الحقول مطلوبة");
            return;
        }
        
        try {
            showLoader(timeSlotForm);
            
            if (currentTimeSlotId) {
                // Update existing time slot
                await api.updateTimeSlot(currentTimeSlotId, timeSlotData);
                showSuccess("تم تحديث الفترة الزمنية بنجاح");
            } else {
                // Create new time slot
                await api.createTimeSlot(timeSlotData);
                showSuccess("تم إضافة الفترة الزمنية بنجاح");
            }
            
            // Reload time slots and close modal
            await loadTimeSlots();
            $(timeSlotModal).modal("hide");
            
        } catch (error) {
            showError("فشل في حفظ الفترة الزمنية: " + error.message);
        } finally {
            hideLoader(timeSlotForm);
        }
    }

    // Delete time slot
    async function deleteTimeSlot(slotId) {
        if (!confirm("هل أنت متأكد من حذف هذه الفترة الزمنية؟")) {
            return;
        }
        
        try {
            showLoader(timeSlotsContainer);
            
            await api.deleteTimeSlot(slotId);
            
            showSuccess("تم حذف الفترة الزمنية بنجاح");
            
            // Reload time slots
            await loadTimeSlots();
            
            hideLoader(timeSlotsContainer);
            
        } catch (error) {
            showError("فشل في حذف الفترة الزمنية: " + error.message);
            hideLoader(timeSlotsContainer);
        }
    }

    // --- Utility functions (assuming they exist globally or are imported) ---
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

