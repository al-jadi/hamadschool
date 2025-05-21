// Frontend Authentication Handling (using API)

// Function to store auth token
function storeAuthToken(token) {
    localStorage.setItem("authToken", token);
}

// Function to get auth token
function getAuthToken() {
    return localStorage.getItem("authToken");
}

// Function to remove auth token (logout)
function removeAuthToken() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser"); // Also remove stored user details
}

// Function to store current user details
function storeCurrentUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
}

// Function to get current user details
function getCurrentUser() {
    const userString = localStorage.getItem("currentUser");
    try {
        return userString ? JSON.parse(userString) : null;
    } catch (e) {
        console.error("Error parsing stored user data:", e);
        removeAuthToken(); // Clear invalid data
        return null;
    }
}

// Function to check if user is logged in
function isLoggedIn() {
    return !!getAuthToken();
}

// Function to handle logout
function logout() {
    removeAuthToken();
    // Redirect to login page
    window.location.href = "index.html";
}

// Function to check authentication status on page load
// Redirects to login if not authenticated
// Optionally fetches user details if not already stored
async function checkAuthStatus(redirectTo = "index.html") {
    if (!isLoggedIn()) {
        console.log("User not logged in, redirecting...");
        window.location.href = redirectTo;
        return null; // Return null as user is not authenticated
    }

    let currentUser = getCurrentUser();
    if (!currentUser) {
        // If token exists but user details are missing, fetch them
        try {
            console.log("Fetching logged in user details...");
            currentUser = await api.getLoggedInUser(); // Assumes api.js is loaded
            if (currentUser && currentUser.user) {
                 // The backend returns { user: { id, name, email, role_name } }
                 // We need role_name as role for frontend logic
                 const userToStore = {
                    id: currentUser.user.id,
                    name: currentUser.user.name,
                    email: currentUser.user.email,
                    role: currentUser.user.role_name // Use role_name from backend as role
                 };
                storeCurrentUser(userToStore);
                console.log("User details fetched and stored:", userToStore);
                return userToStore;
            } else {
                 throw new Error("Failed to fetch user details or invalid response format.");
            }
        } catch (error) {
            console.error("Error fetching user details:", error);
            // If fetching fails (e.g., invalid token), log out
            logout();
            return null;
        }
    } else {
        console.log("User already authenticated:", currentUser);
        return currentUser; // Return stored user details
    }
}

// Function to check if the current user has one of the allowed roles
function checkUserRole(allowedRoles) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.role) {
        console.warn("Cannot check role: Current user or role not found.");
        return false;
    }
    // Ensure allowedRoles is an array
    if (!Array.isArray(allowedRoles)) {
        console.error("allowedRoles must be an array");
        return false;
    }
    return allowedRoles.includes(currentUser.role);
}

// Function to dynamically update UI based on user role
// This function needs to be adapted based on specific page elements
function updateUserUIBasedOnRole(user) {
    if (!user || !user.role) return;

    console.log(`Updating UI for role: ${user.role}`);

    // Example: Hide/show elements based on role
    const adminOnlyElements = document.querySelectorAll(".admin-only");
    const assistantManagerElements = document.querySelectorAll(".assistant-manager-only");
    const supervisorElements = document.querySelectorAll(".supervisor-only");
    const teacherElements = document.querySelectorAll(".teacher-only");
    const parentElements = document.querySelectorAll(".parent-only");

    // Hide all role-specific elements initially
    [...adminOnlyElements, ...assistantManagerElements, ...supervisorElements, ...teacherElements, ...parentElements].forEach(el => el.style.display = "none");

    // Show elements based on the user's role
    // Note: This assumes a hierarchical structure or specific element classes.
    // Adjust logic based on actual permission requirements.
    if (user.role === "system_admin") {
        adminOnlyElements.forEach(el => el.style.display = ""); // Show admin elements
        assistantManagerElements.forEach(el => el.style.display = ""); // Admins see assistant manager elements too
        supervisorElements.forEach(el => el.style.display = ""); // Admins see supervisor elements too
        teacherElements.forEach(el => el.style.display = ""); // Admins see teacher elements too
    } else if (user.role === "assistant_manager") {
        assistantManagerElements.forEach(el => el.style.display = "");
        supervisorElements.forEach(el => el.style.display = ""); // Assistant managers see supervisor elements
        teacherElements.forEach(el => el.style.display = ""); // Assistant managers see teacher elements
    } else if (user.role === "admin_supervisor") {
        supervisorElements.forEach(el => el.style.display = "");
        teacherElements.forEach(el => el.style.display = ""); // Supervisors see teacher elements
    } else if (user.role === "teacher") {
        teacherElements.forEach(el => el.style.display = "");
    } else if (user.role === "parent") {
        parentElements.forEach(el => el.style.display = "");
    }

    // Update user name display if element exists
    const userNameDisplay = document.getElementById("user-name-display");
    if (userNameDisplay) {
        userNameDisplay.textContent = user.name || "User";
    }

    // Update role display if element exists
    const userRoleDisplay = document.getElementById("user-role-display");
    if (userRoleDisplay) {
        // Convert role key to a more readable format if needed
        const roleMap = {
            "system_admin": "مشرف النظام",
            "assistant_manager": "مدير مساعد",
            "admin_supervisor": "مشرف إداري",
            "teacher": "معلم",
            "parent": "ولي أمر"
        };
        userRoleDisplay.textContent = roleMap[user.role] || user.role;
    }

    // Add logout button functionality
    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }
}

// --- Initialization --- 
// On protected pages, call checkAuthStatus() early
// Example for a protected page:
/*
document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkAuthStatus();
    if (user) {
        updateUserUIBasedOnRole(user);
        // Proceed to load page-specific data using api.js
        // Example: loadDashboardData();
    }
});
*/

