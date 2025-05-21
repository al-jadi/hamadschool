// JavaScript for the new mobile bottom navigation and FAB menu
document.addEventListener("DOMContentLoaded", function() {
    // Check if we are on a mobile device based on screen width
    if (window.innerWidth <= 768) {
        // Create and append the bottom navigation bar
        const bottomNavHTML = `
            <nav class="mobile-bottom-nav">
                <a href="dashboard.html" class="mobile-bottom-nav-item" id="nav-dashboard">
                    <i class="bi bi-house-door mobile-bottom-nav-icon"></i>
                    <span>الرئيسية</span>
                </a>
                <a href="attendance.html" class="mobile-bottom-nav-item" id="nav-attendance">
                    <i class="bi bi-calendar-check mobile-bottom-nav-icon"></i>
                    <span>الحضور</span>
                </a>
                <a href="users.html" class="mobile-bottom-nav-item" id="nav-users">
                    <i class="bi bi-people mobile-bottom-nav-icon"></i>
                    <span>المستخدمون</span>
                </a>
                <a href="reports.html" class="mobile-bottom-nav-item" id="nav-reports">
                    <i class="bi bi-file-earmark-text mobile-bottom-nav-icon"></i>
                    <span>التقارير</span>
                </a>
            </nav>
        `;
        document.body.insertAdjacentHTML("beforeend", bottomNavHTML);

        // Create and append the Floating Action Button (FAB) for the menu
        const fabHTML = `
            <button class="mobile-menu-button" aria-label="فتح القائمة">
                <i class="bi bi-list"></i>
            </button>
        `;
        document.body.insertAdjacentHTML("beforeend", fabHTML);

        // Create and append the popup menu (initially hidden)
        const popupMenuHTML = `
            <div class="mobile-menu-popup" id="mobile-menu-popup">
                <ul>
                    <li><a href="behavior.html"><i class="bi bi-emoji-neutral"></i> تقارير السلوك</a></li>
                    <li><a href="actions.html"><i class="bi bi-exclamation-triangle"></i> الإجراءات الإدارية</a></li>
                    <li><a href="permissions.html"><i class="bi bi-door-open"></i> أذونات الخروج</a></li>
                    <li><a href="admin.html"><i class="bi bi-gear"></i> الإعدادات</a></li>
                    <li><a href="#" id="mobile-logout-button"><i class="bi bi-box-arrow-right"></i> تسجيل الخروج</a></li>
                </ul>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", popupMenuHTML);

        // FAB and Popup Menu Logic
        const fabButton = document.querySelector(".mobile-menu-button");
        const popupMenu = document.getElementById("mobile-menu-popup");

        fabButton.addEventListener("click", function(event) {
            event.stopPropagation(); // Prevent click from closing the menu immediately
            popupMenu.classList.toggle("active");
            // Change FAB icon based on state
            const icon = fabButton.querySelector("i");
            if (popupMenu.classList.contains("active")) {
                icon.classList.remove("bi-list");
                icon.classList.add("bi-x");
                fabButton.setAttribute("aria-label", "إغلاق القائمة");
            } else {
                icon.classList.remove("bi-x");
                icon.classList.add("bi-list");
                fabButton.setAttribute("aria-label", "فتح القائمة");
            }
        });

        // Close popup when clicking outside
        document.addEventListener("click", function(event) {
            if (popupMenu.classList.contains("active") && !popupMenu.contains(event.target) && event.target !== fabButton) {
                popupMenu.classList.remove("active");
                const icon = fabButton.querySelector("i");
                icon.classList.remove("bi-x");
                icon.classList.add("bi-list");
                fabButton.setAttribute("aria-label", "فتح القائمة");
            }
        });
        
        // Handle logout from mobile menu
        const mobileLogoutButton = document.getElementById("mobile-logout-button");
        if (mobileLogoutButton) {
            mobileLogoutButton.addEventListener("click", function(event) {
                event.preventDefault();
                logoutUser(); // Assuming logoutUser function exists from local-auth.js
            });
        }

        // Set active state for bottom navigation
        const currentPage = window.location.pathname.split("/").pop();
        if (currentPage === "dashboard.html") {
            document.getElementById("nav-dashboard")?.classList.add("active");
        } else if (currentPage === "attendance.html") {
            document.getElementById("nav-attendance")?.classList.add("active");
        } else if (currentPage === "users.html") {
            document.getElementById("nav-users")?.classList.add("active");
        } else if (currentPage === "reports.html") {
            document.getElementById("nav-reports")?.classList.add("active");
        }
        // Note: Other pages accessed via FAB won't have an active state in the bottom nav
    }
});

