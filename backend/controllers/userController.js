const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");

// @desc    Get all users (filtered for Department Heads)
// @route   GET /api/users
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Department Head)
exports.getAllUsers = async (req, res) => {
    const requestingUserRole = req.user.role;
    const requestingUserId = req.user.id;

    try {
        let query = 
            `SELECT u.id, u.name, u.email, u.created_at, u.is_active, r.name as role_name, u.department_id, d.name as department_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             LEFT JOIN departments d ON u.department_id = d.id`;
        let queryParams = [];

        // If the requester is a Department Head, filter by their department
        if (requestingUserRole === 'department_head') {
            // Find the department ID for the requesting department head
            const deptHeadInfo = await pool.query(
                'SELECT department_id FROM users WHERE id = $1 AND role_id = (SELECT id FROM roles WHERE name = $2)', 
                [requestingUserId, 'department_head']
            );
            
            // It's also possible the head is assigned via the departments table head_id
            // Let's check that too for robustness, assuming a user can only head one department
            const deptInfo = await pool.query(
                'SELECT id FROM departments WHERE head_id = $1',
                [requestingUserId]
            );

            const userDepartmentId = deptHeadInfo.rows.length > 0 ? deptHeadInfo.rows[0].department_id : null;
            const headedDepartmentId = deptInfo.rows.length > 0 ? deptInfo.rows[0].id : null;
            
            // Use the department ID found from either source
            const departmentId = userDepartmentId || headedDepartmentId;

            if (!departmentId) {
                console.warn(`Department Head ${requestingUserId} is not assigned to any department.`);
                // Return empty list or handle as appropriate - returning empty for now
                return res.json([]); 
            }

            // Filter users to only show those in the same department
            // Optionally, filter further to only show specific roles like 'teacher'
            query += ` WHERE u.department_id = $1`;
            queryParams.push(departmentId);
            // Example: To only show teachers in the department:
            // query += ` WHERE u.department_id = $1 AND r.name = 'teacher'`;
            // queryParams.push(departmentId);
        }
        // Admins/Assistants/Supervisors see all users (no WHERE clause added)

        query += ' ORDER BY u.created_at DESC';

        const users = await pool.query(query, queryParams);
        res.json(users.rows);

    } catch (err) {
        console.error('Error in getAllUsers:', err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get user by ID (with department check for Head)
// @route   GET /api/users/:id
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Department Head)
exports.getUserById = async (req, res) => {
    const requestingUserRole = req.user.role;
    const requestingUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);

    if (isNaN(targetUserId)) {
        return res.status(400).json({ msg: "Invalid user ID" });
    }

    try {
        const userQuery = await pool.query(
            `SELECT u.id, u.name, u.email, u.created_at, u.is_active, r.name as role_name, u.department_id, d.name as department_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             LEFT JOIN departments d ON u.department_id = d.id 
             WHERE u.id = $1`, 
            [targetUserId]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ msg: "User not found" });
        }

        const targetUser = userQuery.rows[0];

        // Allow Admins/Assistants/Supervisors to view any user
        if (['system_admin', 'assistant_manager', 'admin_supervisor'].includes(requestingUserRole)) {
            return res.json(targetUser);
        }

        // Allow Department Heads to view users within their own department
        if (requestingUserRole === 'department_head') {
             // Find the department ID for the requesting department head (similar logic as getAllUsers)
            const deptHeadInfo = await pool.query('SELECT department_id FROM users WHERE id = $1', [requestingUserId]);
            const deptInfo = await pool.query('SELECT id FROM departments WHERE head_id = $1', [requestingUserId]);
            const userDepartmentId = deptHeadInfo.rows.length > 0 ? deptHeadInfo.rows[0].department_id : null;
            const headedDepartmentId = deptInfo.rows.length > 0 ? deptInfo.rows[0].id : null;
            const departmentId = userDepartmentId || headedDepartmentId;

            if (departmentId && targetUser.department_id === departmentId) {
                // Target user is in the same department as the head
                return res.json(targetUser);
            } else {
                // Target user not found or not in the head's department
                console.log(`Forbidden: Department Head ${requestingUserId} attempted to view user ${targetUserId} outside their department.`);
                return res.status(403).json({ msg: "Forbidden: You can only view users within your department" });
            }
        }
        
        // Other roles cannot access this specific user info endpoint directly
        return res.status(403).json({ msg: "Forbidden: You do not have permission to access this resource" });

    } catch (err) {
        console.error('Error in getUserById:', err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Create a new user
// @route   POST /api/users
// @access  Private (System Admin only - Department Heads cannot create users directly yet)
// TODO: Consider allowing Dept Heads to create teachers within their dept?
exports.createUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // Ensure only System Admin can create for now
    if (req.user.role !== 'system_admin') {
         return res.status(403).json({ msg: "Forbidden: Only System Administrators can create new users" });
    }

    const { name, email, password, role_id, department_id } = req.body; // Added department_id

    try {
        // Check if email already exists
        let user = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (user.rows.length > 0) {
            return res.status(400).json({ msg: "User already exists with this email" });
        }

        // Check if role_id is valid
        const role = await pool.query("SELECT id FROM roles WHERE id = $1", [role_id]);
        if (role.rows.length === 0) {
            return res.status(400).json({ msg: "Invalid role ID" });
        }
        const roleName = role.rows[0].name;

        // Check if department_id is valid if provided
        if (department_id) {
             const dept = await pool.query("SELECT id FROM departments WHERE id = $1", [department_id]);
             if (dept.rows.length === 0) {
                 return res.status(400).json({ msg: "Invalid department ID" });
             }
        } else if (roleName === 'teacher' || roleName === 'department_head') {
            // Require department_id for teachers and heads (can be null for others like admin)
            // return res.status(400).json({ msg: "Department ID is required for teachers and department heads" });
             // Or allow null for now and assign later?
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Insert user
        const newUser = await pool.query(
            "INSERT INTO users (name, email, password_hash, role_id, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role_id, department_id, created_at, is_active",
            [name, email, password_hash, role_id, department_id] // Use provided department_id (can be null)
        );

        // Fetch role and department names for the response
        const roleNameResult = await pool.query("SELECT name FROM roles WHERE id = $1", [newUser.rows[0].role_id]);
        const deptNameResult = newUser.rows[0].department_id ? await pool.query("SELECT name FROM departments WHERE id = $1", [newUser.rows[0].department_id]) : { rows: [{ name: null }] };
        
        const responseUser = {
            ...newUser.rows[0],
            role_name: roleNameResult.rows[0].name,
            department_name: deptNameResult.rows[0].name
        };

        res.status(201).json(responseUser);

    } catch (err) {
        console.error('Error in createUser:', err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Update user information (allowing Dept Head to update users in their dept)
// @route   PUT /api/users/:id
// @access  Private (System Admin, Department Head for their dept members)
exports.updateUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const requestingUserRole = req.user.role;
    const requestingUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);

    if (isNaN(targetUserId)) {
        return res.status(400).json({ msg: "Invalid user ID" });
    }

    // Fields that can be updated
    const { name, email, role_id, is_active, department_id } = req.body; // Added department_id

    try {
        // Check if target user exists
        let targetUserQuery = await pool.query("SELECT * FROM users WHERE id = $1", [targetUserId]);
        if (targetUserQuery.rows.length === 0) {
            return res.status(404).json({ msg: "User not found" });
        }
        const targetUser = targetUserQuery.rows[0];

        // --- Permission Check --- 
        let canUpdate = false;
        let departmentIdOfHead = null;

        if (requestingUserRole === 'system_admin') {
            canUpdate = true;
        } else if (requestingUserRole === 'department_head') {
            // Find the department ID for the requesting department head
            const deptHeadInfo = await pool.query('SELECT department_id FROM users WHERE id = $1', [requestingUserId]);
            const deptInfo = await pool.query('SELECT id FROM departments WHERE head_id = $1', [requestingUserId]);
            const userDepartmentId = deptHeadInfo.rows.length > 0 ? deptHeadInfo.rows[0].department_id : null;
            const headedDepartmentId = deptInfo.rows.length > 0 ? deptInfo.rows[0].id : null;
            departmentIdOfHead = userDepartmentId || headedDepartmentId;

            if (departmentIdOfHead && targetUser.department_id === departmentIdOfHead) {
                // Head can update users within their own department
                canUpdate = true;
            } else {
                 console.log(`Forbidden: Department Head ${requestingUserId} attempted to update user ${targetUserId} outside their department (${departmentIdOfHead}).`);
            }
        }

        if (!canUpdate) {
            return res.status(403).json({ msg: "Forbidden: You do not have permission to update this user" });
        }
        // --- End Permission Check ---

        // --- Validation --- 
        // Check if email is being updated and if it conflicts
        if (email && email !== targetUser.email) {
            let existingEmail = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, targetUserId]);
            if (existingEmail.rows.length > 0) {
                return res.status(400).json({ msg: "Email already in use by another user" });
            }
        }

        // Check if role_id is valid if provided
        let newRoleName = null;
        if (role_id !== undefined) {
            const role = await pool.query("SELECT name FROM roles WHERE id = $1", [role_id]);
            if (role.rows.length === 0) {
                return res.status(400).json({ msg: "Invalid role ID" });
            }
            newRoleName = role.rows[0].name;
            // Prevent Dept Head from changing role to something outside their authority?
            if (requestingUserRole === 'department_head' && !['teacher'].includes(newRoleName)) { // Only allow changing to teacher?
                 // return res.status(403).json({ msg: "Forbidden: Department Heads can only manage teacher roles within their department" });
            }
        }
        
        // Check if department_id is valid if provided
        if (department_id !== undefined && department_id !== null) {
             const dept = await pool.query("SELECT id FROM departments WHERE id = $1", [department_id]);
             if (dept.rows.length === 0) {
                 return res.status(400).json({ msg: "Invalid department ID" });
             }
             // Prevent Dept Head from moving user outside their department?
             if (requestingUserRole === 'department_head' && department_id !== departmentIdOfHead) {
                  return res.status(403).json({ msg: "Forbidden: Department Heads can only assign users to their own department" });
             }
        } else if (department_id === null && (newRoleName === 'teacher' || newRoleName === 'department_head')) {
             // Prevent removing department from teacher/head?
             // return res.status(400).json({ msg: "Department ID cannot be removed for teachers or department heads" });
        }
        // --- End Validation ---

        // Build update query dynamically
        const fieldsToUpdate = {};
        if (name !== undefined) fieldsToUpdate.name = name;
        if (email !== undefined) fieldsToUpdate.email = email;
        if (role_id !== undefined) fieldsToUpdate.role_id = role_id;
        if (is_active !== undefined) fieldsToUpdate.is_active = is_active;
        if (department_id !== undefined) fieldsToUpdate.department_id = department_id; // Allow updating department_id

        const fieldNames = Object.keys(fieldsToUpdate);
        if (fieldNames.length === 0) {
            return res.status(400).json({ msg: "No valid fields provided for update" });
        }

        const setClauses = fieldNames.map((fieldName, index) => `"${fieldName}" = $${index + 1}`).join(", ");
        const values = fieldNames.map(fieldName => fieldsToUpdate[fieldName]);

        const updateQuery = `UPDATE users SET ${setClauses} WHERE id = $${fieldNames.length + 1} RETURNING id, name, email, role_id, department_id, created_at, is_active`;
        values.push(targetUserId);

        const updatedUserResult = await pool.query(updateQuery, values);
        const updatedUser = updatedUserResult.rows[0];

        // Fetch role and department names for the response
        const roleNameResult = await pool.query("SELECT name FROM roles WHERE id = $1", [updatedUser.role_id]);
        const deptNameResult = updatedUser.department_id ? await pool.query("SELECT name FROM departments WHERE id = $1", [updatedUser.department_id]) : { rows: [{ name: null }] };

        const responseUser = {
            ...updatedUser,
            role_name: roleNameResult.rows[0].name,
            department_name: deptNameResult.rows[0].name
        };

        res.json(responseUser);

    } catch (err) {
        console.error('Error in updateUser:', err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Delete a user (soft delete by marking inactive)
// @route   DELETE /api/users/:id
// @access  Private (System Admin only - Dept Heads cannot delete users)
// TODO: Consider allowing Dept Heads to mark users in their dept inactive?
exports.deleteUser = async (req, res) => {
    const requestingUserRole = req.user.role;
    const requestingUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);

    if (isNaN(targetUserId)) {
        return res.status(400).json({ msg: "Invalid user ID" });
    }

    try {
        // Check if target user exists
        let targetUserQuery = await pool.query("SELECT * FROM users WHERE id = $1", [targetUserId]);
        if (targetUserQuery.rows.length === 0) {
            return res.status(404).json({ msg: "User not found" });
        }
        const targetUser = targetUserQuery.rows[0];

        // --- Permission Check --- 
        let canDelete = false;
        if (requestingUserRole === 'system_admin') {
            canDelete = true;
        } 
        // TODO: Add logic if Dept Heads should be allowed to soft-delete/deactivate users in their dept
        /* else if (requestingUserRole === 'department_head') {
            const deptHeadInfo = await pool.query('SELECT department_id FROM users WHERE id = $1', [requestingUserId]);
            const deptInfo = await pool.query('SELECT id FROM departments WHERE head_id = $1', [requestingUserId]);
            const userDepartmentId = deptHeadInfo.rows.length > 0 ? deptHeadInfo.rows[0].department_id : null;
            const headedDepartmentId = deptInfo.rows.length > 0 ? deptInfo.rows[0].id : null;
            const departmentIdOfHead = userDepartmentId || headedDepartmentId;

            if (departmentIdOfHead && targetUser.department_id === departmentIdOfHead) {
                canDelete = true; // Or maybe just deactivate?
            }
        } */

        if (!canDelete) {
             console.log(`Forbidden: User ${requestingUserId} (${requestingUserRole}) attempted to delete user ${targetUserId}.`);
            return res.status(403).json({ msg: "Forbidden: You do not have permission to delete this user" });
        }
        // --- End Permission Check ---

        // Soft delete: Mark user as inactive instead of actually deleting
        await pool.query("UPDATE users SET is_active = false WHERE id = $1", [targetUserId]);

        res.json({ msg: "User marked as inactive" });

    } catch (err) {
        console.error('Error in deleteUser:', err.message);
        res.status(500).send("Server Error");
    }
};

