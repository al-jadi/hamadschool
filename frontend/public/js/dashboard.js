// JavaScript for Dashboard Page (using API)

document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkAuthStatus(); // Check authentication and get user details
    if (!user) {
        // If checkAuthStatus redirects, the rest of the code might not execute,
        // but it's good practice to return if user is not authenticated.
        return;
    }

    // Update UI elements based on user role (e.g., show/hide menu items, display user name)
    updateUserUIBasedOnRole(user);

    // Remove the static demo notice
    const demoNotice = document.querySelector(".demo-notice");
    if (demoNotice) {
        demoNotice.remove();
    }

    // Load dashboard data
    loadDashboardData(user);
});

async function loadDashboardData(user) {
    console.log("Loading dashboard data for user:", user);
    const statsCardsContainer = document.querySelector(".stats-cards");
    const notificationsList = document.querySelector("section:nth-of-type(1) ul"); // Assuming first section is notifications
    const activityList = document.querySelector("section:nth-of-type(2) ul"); // Assuming second section is activity

    // Clear existing static data
    if (statsCardsContainer) statsCardsContainer.innerHTML = "";
    if (notificationsList) notificationsList.innerHTML = "";
    if (activityList) activityList.innerHTML = "";

    try {
        // --- Fetch Stats (Example - adjust based on available API endpoints) ---
        // These might require new backend endpoints or aggregation logic
        let studentCount = 0;
        let teacherCount = 0;
        let attendancePercentage = 0;
        let newBehaviorReports = 0;

        // Example: Fetch student count (requires admin/assistant manager role)
        if (checkUserRole(["system_admin", "assistant_manager"])) {
            try {
                // Assuming an endpoint /stats/counts or similar exists
                // const counts = await api.request("/stats/counts", "GET");
                // studentCount = counts.students;
                // teacherCount = counts.teachers;
                // For now, using placeholder values as stats endpoints are not defined
                studentCount = await fetchPlaceholderStudentCount();
                teacherCount = await fetchPlaceholderTeacherCount();
            } catch (err) {
                console.error("Error fetching counts:", err);
            }
        }

        // Example: Fetch today's attendance percentage (requires relevant role)
        if (checkUserRole(["system_admin", "assistant_manager", "admin_supervisor"])) {
             try {
                // const attendanceStats = await api.request("/stats/attendance/today", "GET");
                // attendancePercentage = attendanceStats.percentage;
                attendancePercentage = await fetchPlaceholderAttendance();
             } catch (err) {
                 console.error("Error fetching attendance stats:", err);
             }
        }

        // Example: Fetch new behavior reports count (requires relevant role)
        if (checkUserRole(["system_admin", "assistant_manager", "admin_supervisor"])) {
            try {
                const reports = await api.getBehaviorReports({ status: "pending" }); // Assuming status filter
                newBehaviorReports = reports.length;
            } catch (err) {
                console.error("Error fetching behavior reports:", err);
            }
        }

        // --- Display Stats ---
        if (statsCardsContainer) {
            addStatCard(statsCardsContainer, "عدد الطلاب", studentCount);
            addStatCard(statsCardsContainer, "عدد المعلمين", teacherCount);
            addStatCard(statsCardsContainer, "نسبة الحضور اليوم", `${attendancePercentage}%`);
            addStatCard(statsCardsContainer, "تقارير سلوك جديدة", newBehaviorReports);
        }

        // --- Fetch Notifications & Activities (Example - adjust based on API) ---
        // These would likely come from dedicated notification/activity endpoints
        const notifications = await fetchPlaceholderNotifications();
        const activities = await fetchPlaceholderActivities();

        // --- Display Notifications ---
        if (notificationsList) {
            notifications.forEach(item => {
                const li = document.createElement("li");
                li.textContent = item;
                notificationsList.appendChild(li);
            });
            if (notifications.length === 0) {
                 notificationsList.innerHTML = "<li>لا توجد إشعارات جديدة.</li>";
            }
        }

        // --- Display Activities ---
        if (activityList) {
            activities.forEach(item => {
                const li = document.createElement("li");
                li.textContent = item;
                activityList.appendChild(li);
            });
             if (activities.length === 0) {
                 activityList.innerHTML = "<li>لا توجد أنشطة حديثة.</li>";
            }
        }

    } catch (error) {
        console.error("Error loading dashboard data:", error);
        // Display a general error message on the dashboard
        const mainContent = document.querySelector(".main-content");
        if (mainContent) {
            const errorDiv = document.createElement("div");
            errorDiv.className = "alert alert-danger";
            errorDiv.textContent = `حدث خطأ أثناء تحميل بيانات لوحة التحكم: ${error.message}`;
            mainContent.prepend(errorDiv);
        }
    }
}

// Helper function to add a stat card
function addStatCard(container, title, value) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>${title}</h3><p>${value}</p>`;
    container.appendChild(card);
}

// --- Placeholder Fetch Functions (Replace with actual API calls) ---
async function fetchPlaceholderStudentCount() {
    // Replace with: await api.request("/stats/students/count");
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    return 1250; // Placeholder
}
async function fetchPlaceholderTeacherCount() {
    // Replace with: await api.request("/stats/teachers/count");
    await new Promise(resolve => setTimeout(resolve, 100));
    return 85; // Placeholder
}
async function fetchPlaceholderAttendance() {
    // Replace with: await api.request("/stats/attendance/today");
    await new Promise(resolve => setTimeout(resolve, 100));
    return 95; // Placeholder
}
async function fetchPlaceholderNotifications() {
    // Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 100));
    return [
        "اجتماع قسم اللغة العربية يوم الثلاثاء القادم.",
        "يرجى تحديث بيانات الطلاب قبل نهاية الأسبوع.",
        "ورشة عمل حول استخدام التكنولوجيا في التعليم يوم الخميس."
    ];
}
async function fetchPlaceholderActivities() {
    // Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 100));
    return [
        "تم إضافة طالب جديد: أحمد خالد",
        "تم تسجيل غياب الطالب: محمد علي",
        "تم رفع تقرير سلوك للطالب: عبدالله فهد"
    ];
}

