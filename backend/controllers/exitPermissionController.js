const pool = require("../config/database");
const { validationResult } = require("express-validator");

// Helper function to check if a parent is linked to a student
async function isParentLinked(parentId, studentId) {
    const link = await pool.query(
        "SELECT id FROM parent_student_link WHERE parent_user_id = $1 AND student_id = $2",
        [parentId, studentId]
    );
    return link.rows.length > 0;
}

// @desc    Request or record an exit permission
// @route   POST /api/exit-permissions
// @access  Private (System Admin, Assistant Manager, Admin Supervisor)
exports.createExitPermission = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, permission_date, reason, status } = req.body;
    const requestedByUserId = req.user.id;

    try {
        // Check if student exists
        const student = await pool.query("SELECT id FROM students WHERE id = $1", [student_id]);
        if (student.rows.length === 0) {
            return res.status(404).json({ msg: "Student not found" });
        }

        // Insert permission request
        const newPermission = await pool.query(
            `INSERT INTO exit_permissions (student_id, permission_date, reason, status, requested_by_user_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [student_id, permission_date, reason, status || "pending", requestedByUserId]
        );

        res.status(201).json(newPermission.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get exit permissions (filtered)
// @route   GET /api/exit-permissions
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Parent)
exports.getExitPermissions = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const requestingUser = req.user;
    const { student_id, class_id, start_date, end_date, status } = req.query;

    let query = `
        SELECT
            ep.id, ep.permission_date, ep.reason, ep.status,
            ep.approved_rejected_at, ep.requested_at,
            s.id as student_id, s.name as student_name, s.student_id as student_academic_id,
            c.id as class_id, c.name as class_name,
            requester.name as requested_by_name,
            approver.name as approved_rejected_by_name
        FROM exit_permissions ep
        JOIN students s ON ep.student_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN users requester ON ep.requested_by_user_id = requester.id
        LEFT JOIN users approver ON ep.approved_rejected_by_user_id = approver.id
    `;
    const conditions = [];
    const values = [];
    let valueIndex = 1;

    try {
        // Role-based filtering
        if (requestingUser.role === "parent") {
            // Parent sees only permissions for their linked children
            const childrenResult = await pool.query("SELECT student_id FROM parent_student_link WHERE parent_user_id = $1", [requestingUser.id]);
            const childrenIds = childrenResult.rows.map(row => row.student_id);
            if (childrenIds.length === 0) {
                return res.json([]); // Parent has no linked children
            }
            // If specific student_id is requested, check if it's one of the linked children
            if (student_id && !childrenIds.includes(parseInt(student_id))) {
                 return res.status(403).json({ msg: "Forbidden: You can only view permissions for your linked children." });
            }
            conditions.push(`ep.student_id = ANY($${valueIndex++})`);
            values.push(childrenIds);
        }

        // Apply query filters
        if (student_id && requestingUser.role !== "parent") { // Parent filter applied above
            conditions.push(`ep.student_id = $${valueIndex++}`);
            values.push(student_id);
        }
        if (class_id) {
             conditions.push(`s.class_id = $${valueIndex++}`);
             values.push(class_id);
        }
        if (start_date) {
            conditions.push(`ep.permission_date >= $${valueIndex++}`);
            values.push(start_date);
        }
        if (end_date) {
            conditions.push(`ep.permission_date <= $${valueIndex++}`);
            values.push(end_date);
        }
        if (status) {
            conditions.push(`ep.status = $${valueIndex++}`);
            values.push(status);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY ep.permission_date DESC, s.name ASC";

        const permissions = await pool.query(query, values);
        res.json(permissions.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get a specific exit permission by ID
// @route   GET /api/exit-permissions/:id
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Parent - with checks)
exports.getExitPermissionById = async (req, res) => {
    const permissionId = parseInt(req.params.id);
    const requestingUser = req.user;

    if (isNaN(permissionId)) {
        return res.status(400).json({ msg: "Invalid permission ID" });
    }

    try {
        const permissionResult = await pool.query(
            `SELECT ep.*, s.id as student_id, s.name as student_name
             FROM exit_permissions ep
             JOIN students s ON ep.student_id = s.id
             WHERE ep.id = $1`,
            [permissionId]
        );

        if (permissionResult.rows.length === 0) {
            return res.status(404).json({ msg: "Exit permission not found" });
        }

        const permission = permissionResult.rows[0];

        // Role-based access check
        if (requestingUser.role === "parent") {
            const linked = await isParentLinked(requestingUser.id, permission.student_id);
            if (!linked) {
                return res.status(403).json({ msg: "Forbidden: You are not authorized to view this permission." });
            }
        }
        // Admins, Supervisors, Assistant Managers can view any permission based on route access

        // Fetch additional names for context
        const requester = await pool.query("SELECT name FROM users WHERE id = $1", [permission.requested_by_user_id]);
        const approver = permission.approved_rejected_by_user_id ? await pool.query("SELECT name FROM users WHERE id = $1", [permission.approved_rejected_by_user_id]) : null;

        const responsePermission = {
            ...permission,
            requested_by_name: requester.rows[0]?.name,
            approved_rejected_by_name: approver?.rows[0]?.name
        };

        res.json(responsePermission);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Update the status of an exit permission (approve/reject)
// @route   PUT /api/exit-permissions/:id/status
// @access  Private (System Admin, Assistant Manager, Admin Supervisor)
exports.updateExitPermissionStatus = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const permissionId = parseInt(req.params.id);
    if (isNaN(permissionId)) {
        return res.status(400).json({ msg: "Invalid permission ID" });
    }

    const { status } = req.body; // Expecting 'approved' or 'rejected'
    const approverUserId = req.user.id;

    try {
        // Check if permission exists and is pending
        const permission = await pool.query("SELECT id, status FROM exit_permissions WHERE id = $1", [permissionId]);
        if (permission.rows.length === 0) {
            return res.status(404).json({ msg: "Exit permission not found" });
        }
        // Optional: Prevent updating status if not pending
        // if (permission.rows[0].status !== 'pending') {
        //     return res.status(400).json({ msg: `Permission status is already '${permission.rows[0].status}' and cannot be changed.` });
        // }

        // Update status
        const updatedPermission = await pool.query(
            `UPDATE exit_permissions
             SET status = $1, approved_rejected_by_user_id = $2, approved_rejected_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [status, approverUserId, permissionId]
        );

        res.json(updatedPermission.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

