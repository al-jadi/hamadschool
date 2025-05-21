// JavaScript for handling dropdown menus

document.addEventListener('DOMContentLoaded', function() {
    // Sidebar dropdown functionality
    document.querySelectorAll('.sidebar-dropdown > a').forEach(function(dropdownLink) {
        dropdownLink.addEventListener('click', function(event) {
            event.preventDefault();
            var parentLi = this.parentElement;
            // Close other open dropdowns
            document.querySelectorAll('.sidebar-dropdown.active').forEach(function(openDropdown) {
                if (openDropdown !== parentLi) {
                    openDropdown.classList.remove('active');
                }
            });
            // Toggle the clicked dropdown
            parentLi.classList.toggle('active');
        });
    });

    // Header user dropdown functionality (click instead of hover for mobile)
    const userDropdown = document.querySelector('header .dropdown');
    if (userDropdown) {
        const userDropdownLink = userDropdown.querySelector('a'); // Get the link inside the dropdown
        const userDropdownContent = userDropdown.querySelector('.dropdown-content');

        if (userDropdownLink && userDropdownContent) {
            userDropdownLink.addEventListener('click', function(event) {
                event.preventDefault(); // Prevent default link behavior
                // Toggle the display of the dropdown content
                const isDisplayed = userDropdownContent.style.display === 'block';
                userDropdownContent.style.display = isDisplayed ? 'none' : 'block';
            });

            // Close dropdown if clicking outside
            document.addEventListener('click', function(event) {
                if (!userDropdown.contains(event.target)) {
                    userDropdownContent.style.display = 'none';
                }
            });
        }
    }

    // Logout button functionality (ensure it works from dropdown)
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent default link behavior
            // Use localLogout if available (from local-auth.js), otherwise redirect
            if (typeof localLogout === 'function') {
                localLogout();
            } else {
                // Fallback if localLogout is not defined
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'index.html';
            }
        });
    }

    // Update username display
    const user = getLocalUser(); // Assuming getLocalUser is available from local-auth.js
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay && user && user.full_name) {
        usernameDisplay.textContent = user.full_name;
    } else if (usernameDisplay) {
        // Fallback if user info is not available
        usernameDisplay.textContent = 'المستخدم';
    }
});

// Ensure getLocalUser function is available or define a fallback
if (typeof getLocalUser === 'undefined') {
    function getLocalUser() {
        const userJson = localStorage.getItem('user');
        return userJson ? JSON.parse(userJson) : null;
    }
}

