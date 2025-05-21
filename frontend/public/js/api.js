// Frontend API Client

// Import configuration
// Note: In a real browser environment, you might need a build step or use ES modules.
// For this static setup, we assume config.js is loaded via a <script> tag before this file.

const api = {
    /**
     * Makes a request to the backend API.
     * @param {string} endpoint - The API endpoint (e.g., 
/auth/login").
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
     * @param {object|null} body - Request body for POST/PUT requests.
     * @param {boolean} requiresAuth - Whether the request requires authentication (sends token).
     * @returns {Promise<object>} - The JSON response from the API.
     * @throws {Error} - Throws an error if the request fails or returns an error status.
     */
    async request(endpoint, method = "GET", body = null, requiresAuth = true) {
        const url = `${config.API_BASE_URL}${endpoint}`;
        const options = {
            method: method,
            headers: {
                "Content-Type": "application/json",
            },
        };

        if (requiresAuth) {
            const token = localStorage.getItem("authToken");
            if (token) {
                options.headers["x-auth-token"] = token;
            } else {
                console.error("Authentication required, but no token found.");
                // Redirect to login if no token and auth is required
                if (window.location.pathname !== "/index.html" && window.location.pathname !== "/") {
                     window.location.href = "/index.html";
                }
                throw new Error("Authentication token not found.");
            }
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (parseError) {
                    errorData = { msg: `HTTP error! Status: ${response.status}` };
                }
                console.error("API Error:", errorData);
                // Handle specific auth errors (e.g., invalid token)
                if (response.status === 401 && requiresAuth) {
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("userRole");
                    localStorage.removeItem("userName");
                    if (window.location.pathname !== "/index.html" && window.location.pathname !== "/") {
                        window.location.href = "/index.html";
                    }
                }
                throw new Error(errorData.msg || `Request failed with status ${response.status}`);
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            } else {
                // Handle cases where the response might not be JSON (e.g., file download)
                // For now, return an empty object or handle based on content type if needed
                return {}; 
            }

        } catch (error) {
            console.error("Fetch Error:", error);
            throw error;
        }
    },

    // --- Authentication Methods ---
    async login(email, password) {
        return this.request("/auth/login", "POST", { email, password }, false);
    },
    async getLoggedInUser() {
        return this.request("/auth/user", "GET", null, true);
    },

    // --- User Management Methods ---
    async getAllUsers(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/users?${queryString}`, "GET", null, true);
    },
    async getUserById(id) {
        return this.request(`/users/${id}`, "GET", null, true);
    },
    async createUser(userData) {
        return this.request("/users", "POST", userData, true);
    },
    async updateUser(id, userData) {
        return this.request(`/users/${id}`, "PUT", userData, true);
    },
    async deleteUser(id) {
        return this.request(`/users/${id}`, "DELETE", null, true);
    },

    // --- Student Management Methods ---
    async getAllStudents(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/students?${queryString}`, "GET", null, true);
    },
    async getMyChildren() {
        return this.request("/students/my-children", "GET", null, true);
    },
    async getStudentById(id) {
        return this.request(`/students/${id}`, "GET", null, true);
    },
    async createStudent(studentData) {
        return this.request("/students", "POST", studentData, true);
    },
    async updateStudent(id, studentData) {
        return this.request(`/students/${id}`, "PUT", studentData, true);
    },
    async deleteStudent(id) {
        return this.request(`/students/${id}`, "DELETE", null, true);
    },
    async linkParentToStudent(linkData) {
        return this.request("/students/link-parent", "POST", linkData, true);
    },
    async unlinkParentFromStudent(linkId) {
        return this.request(`/students/unlink-parent/${linkId}`, "DELETE", null, true);
    },

    // --- Class Management Methods ---
    async getAllClasses() {
        return this.request("/classes", "GET", null, true);
    },
    async getClassById(id) {
        return this.request(`/classes/${id}`, "GET", null, true);
    },
    async createClass(classData) {
        return this.request("/classes", "POST", classData, true);
    },
    async updateClass(id, classData) {
        return this.request(`/classes/${id}`, "PUT", classData, true);
    },
    async deleteClass(id) {
        return this.request(`/classes/${id}`, "DELETE", null, true);
    },

    // --- Attendance Methods ---
    async recordAttendance(records) {
        return this.request("/attendance", "POST", { records }, true);
    },
    async getAttendanceRecords(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/attendance?${queryString}`, "GET", null, true);
    },
    async updateAttendanceRecord(id, updateData) {
        return this.request(`/attendance/${id}`, "PUT", updateData, true);
    },

    // --- Behavior Report Methods ---
    async createBehaviorReport(reportData) {
        return this.request("/behavior", "POST", reportData, true);
    },
    async getBehaviorReports(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/behavior?${queryString}`, "GET", null, true);
    },
    async getBehaviorReportById(id) {
        return this.request(`/behavior/${id}`, "GET", null, true);
    },
    async addSupervisorComment(id, commentData) {
        return this.request(`/behavior/${id}/supervisor-comment`, "PUT", commentData, true);
    },
    async approveBehaviorReportForParentView(id, approvalData) {
        return this.request(`/behavior/${id}/approve-parent-view`, "PUT", approvalData, true);
    },

    // --- Administrative Action Methods ---
    async createAdministrativeAction(actionData) {
        return this.request("/actions", "POST", actionData, true);
    },
    async getAdministrativeActions(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/actions?${queryString}`, "GET", null, true);
    },
    async getAdministrativeActionById(id) {
        return this.request(`/actions/${id}`, "GET", null, true);
    },
    async approveAdministrativeActionForParentView(id, approvalData) {
        return this.request(`/actions/${id}/approve-parent-view`, "PUT", approvalData, true);
    },

    // --- Exit Permission Methods ---
    async createExitPermission(permissionData) {
        return this.request("/permissions", "POST", permissionData, true); // Corrected endpoint
    },
    async getExitPermissions(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/permissions?${queryString}`, "GET", null, true); // Corrected endpoint
    },
    async getExitPermissionById(id) {
        return this.request(`/permissions/${id}`, "GET", null, true); // Corrected endpoint
    },
    async updateExitPermissionStatus(id, statusData) {
        return this.request(`/permissions/${id}/status`, "PUT", statusData, true); // Corrected endpoint
    },

    // --- Settings Methods ---
    async getAllSettings() {
        return this.request("/settings", "GET", null, true);
    },
    async getSettingByKey(key) {
        return this.request(`/settings/${key}`, "GET", null, true);
    },
    async updateSetting(key, valueData) {
        return this.request(`/settings/${key}`, "PUT", valueData, true);
    },

    // --- Department Methods ---
    async getAllDepartments() {
        return this.request("/departments", "GET", null, true);
    },
    async getDepartmentById(id) {
        return this.request(`/departments/${id}`, "GET", null, true);
    },
    async createDepartment(deptData) {
        return this.request("/departments", "POST", deptData, true);
    },
    async updateDepartment(id, deptData) {
        return this.request(`/departments/${id}`, "PUT", deptData, true);
    },
    async assignDepartmentHead(id, headData) {
        return this.request(`/departments/${id}/head`, "PUT", headData, true); // Corrected: Added closing backtick
    },
    async deleteDepartment(id) {
        return this.request(`/departments/${id}`, "DELETE", null, true);
    },
    async uploadDepartmentFile(departmentId, fileData) { // fileData = { file_name, description, file_content (base64), file_extension }
        return this.request(`/departments/${departmentId}/files`, "POST", fileData, true);
    },
    async getDepartmentFiles(departmentId) {
        return this.request(`/departments/${departmentId}/files`, "GET", null, true);
    },
    async getDepartmentFileById(fileId) {
        // Note: This endpoint might need adjustment based on backend implementation
        // Assuming a structure like /files/{fileId} or similar if files are global
        // Or keep as is if files are always accessed via department context
        return this.request(`/departments/files/${fileId}`, "GET", null, true); 
    },
    async deleteDepartmentFile(fileId) {
        // Similar note as getDepartmentFileById
        return this.request(`/departments/files/${fileId}`, "DELETE", null, true);
    },

    // --- Subject Methods ---
    async getAllSubjects(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/subjects?${queryString}`, "GET", null, true);
    },
    async getSubjectById(id) {
        return this.request(`/subjects/${id}`, "GET", null, true);
    },
    async createSubject(subjectData) {
        return this.request("/subjects", "POST", subjectData, true);
    },
    async updateSubject(id, subjectData) {
        return this.request(`/subjects/${id}`, "PUT", subjectData, true);
    },
    async deleteSubject(id) {
        return this.request(`/subjects/${id}`, "DELETE", null, true);
    },

    // --- Time Slot Methods ---
    async getAllTimeSlots() {
        return this.request("/time-slots", "GET", null, true);
    },
    async getTimeSlotById(id) {
        return this.request(`/time-slots/${id}`, "GET", null, true);
    },
    async createTimeSlot(timeSlotData) {
        return this.request("/time-slots", "POST", timeSlotData, true);
    },
    async updateTimeSlot(id, timeSlotData) {
        return this.request(`/time-slots/${id}`, "PUT", timeSlotData, true);
    },
    async deleteTimeSlot(id) {
        return this.request(`/time-slots/${id}`, "DELETE", null, true);
    },

    // --- Class Schedule Methods ---
    async createScheduleEntry(entryData) {
        return this.request("/class-schedules", "POST", entryData, true);
    },
    async getAllScheduleEntries(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/class-schedules?${queryString}`, "GET", null, true);
    },
    async getScheduleByClass(classId, filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/class-schedules/class/${classId}?${queryString}`, "GET", null, true);
    },
    async getScheduleByTeacher(teacherId, filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/class-schedules/teacher/${teacherId}?${queryString}`, "GET", null, true);
    },
    async updateScheduleEntry(id, entryData) {
        return this.request(`/class-schedules/${id}`, "PUT", entryData, true);
    },
    async deleteScheduleEntry(id) {
        return this.request(`/class-schedules/${id}`, "DELETE", null, true);
    },

    // --- Schedule Swap Request Methods ---
    async createSwapRequest(requestData) {
        return this.request("/class-schedules/swap-requests", "POST", requestData, true);
    },
    async getAllSwapRequests(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/class-schedules/swap-requests?${queryString}`, "GET", null, true);
    },
    async getSwapRequestById(id) {
        return this.request(`/class-schedules/swap-requests/${id}`, "GET", null, true);
    },
    async approveSwapRequestFirstStep(id) {
        return this.request(`/class-schedules/swap-requests/${id}/approve-first`, "PUT", {}, true);
    },
    async approveSwapRequestFinal(id) {
        return this.request(`/class-schedules/swap-requests/${id}/approve-final`, "PUT", {}, true);
    },
    async rejectSwapRequest(id, reasonData) {
        return this.request(`/class-schedules/swap-requests/${id}/reject`, "PUT", reasonData, true);
    },

    // --- Department Bulletin Methods ---
    async createDepartmentBulletin(bulletinData) { // Includes attachment_content (base64), attachment_extension
        return this.request("/department-bulletins", "POST", bulletinData, true);
    },
    async getAllDepartmentBulletins(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/department-bulletins?${queryString}`, "GET", null, true);
    },
    async getBulletinsByDepartment(departmentId, filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/department-bulletins/department/${departmentId}?${queryString}`, "GET", null, true);
    },
    async getDepartmentBulletinById(id) {
        return this.request(`/department-bulletins/${id}`, "GET", null, true);
    },
    async updateDepartmentBulletin(id, bulletinData) {
        return this.request(`/department-bulletins/${id}`, "PUT", bulletinData, true);
    },
    async submitDepartmentBulletinForApproval(id) {
        return this.request(`/department-bulletins/${id}/submit`, "PUT", {}, true);
    },
    async approveDepartmentBulletin(id) {
        return this.request(`/department-bulletins/${id}/approve`, "PUT", {}, true);
    },
    async archiveDepartmentBulletin(id) {
        return this.request(`/department-bulletins/${id}/archive`, "PUT", {}, true);
    },
    async deleteDepartmentBulletin(id) {
        return this.request(`/department-bulletins/${id}`, "DELETE", null, true);
    },
    async acknowledgeDepartmentBulletin(id) {
        return this.request(`/department-bulletins/${id}/acknowledge`, "POST", {}, true);
    },
    async getDepartmentBulletinAcknowledgements(id) {
        return this.request(`/department-bulletins/${id}/acknowledgements`, "GET", null, true);
    },

    // --- Parent Bulletin Methods ---
    async createParentBulletin(bulletinData) { // Includes attachment_content (base64), attachment_extension
        return this.request("/parent-bulletins", "POST", bulletinData, true);
    },
    async getAllParentBulletins(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return this.request(`/parent-bulletins?${queryString}`, "GET", null, true);
    },
    async getParentBulletinById(id) {
        return this.request(`/parent-bulletins/${id}`, "GET", null, true);
    },
    async updateParentBulletin(id, bulletinData) {
        return this.request(`/parent-bulletins/${id}`, "PUT", bulletinData, true);
    },
    async approveParentBulletin(id) {
        return this.request(`/parent-bulletins/${id}/approve`, "PUT", {}, true);
    },
    async archiveParentBulletin(id) {
        return this.request(`/parent-bulletins/${id}/archive`, "PUT", {}, true);
    },
    async deleteParentBulletin(id) {
        return this.request(`/parent-bulletins/${id}`, "DELETE", null, true);
    },
    async acknowledgeParentBulletin(id) {
        return this.request(`/parent-bulletins/${id}/acknowledge`, "POST", {}, true);
    },
    async getParentBulletinAcknowledgements(id) {
        return this.request(`/parent-bulletins/${id}/acknowledgements`, "GET", null, true);
    }

};

