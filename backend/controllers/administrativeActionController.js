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

// @desc    Create a new administrative action record
// @route   POST /api/actions
// @access  Private (System Admin, Assistant Manager)
exports.createAdministrativeAction = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, description, action_date } = req.body;
    const recordedByUserId = req.user.id;

    try {
        // Check if student exists
        const student = await pool.query("SELECT id FROM students WHERE id = $1", [student_id]);
        if (student.rows.length === 0) {
            return res.status(404).json({ msg: "Student not found" });
        }

        // Insert action
        const newAction = await pool.query(
            `INSERT INTO administrative_actions (student_id, description, action_date, recorded_by_user_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [student_id, description, action_date || new Date(), recordedByUserId]
        );

        res.status(201).json(newAction.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get administrative actions (filtered)
// @route   GET /api/actions
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Parent)
exports.getAdministrativeActions = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const requestingUser = req.user;
    const { student_id, class_id, start_date, end_date } = req.query;

    let query = `
        SELECT
            aa.id, aa.action_date, aa.description,
            aa.assistant_manager_approved_for_parent_view,
            aa.assistant_manager_approved_at,
            s.id as student_id, s.name as student_name, s.student_id as student_academic_id,
            c.id as class_id, c.name as class_name,
            recorder.name as recorded_by_name,
            approver.name as approved_by_name,
            aa.recorded_at
        FROM administrative_actions aa
        JOIN students s ON aa.student_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN users recorder ON aa.recorded_by_user_id = recorder.id
        LEFT JOIN users approver ON aa.assistant_manager_user_id = approver.id
    `;
    const conditions = [];
    const values = [];
    let valueIndex = 1;

    try {
        // Role-based filtering
        if (requestingUser.role === "parent") {
            // Parent sees only approved actions for their linked children
            const childrenResult = await pool.query("SELECT student_id FROM parent_student_link WHERE parent_user_id = $1", [requestingUser.id]);
            const childrenIds = childrenResult.rows.map(row => row.student_id);
            if (childrenIds.length === 0) {
                return res.json([]); // Parent has no linked children
            }
            // If specific student_id is requested, check if it's one of the linked children
            if (student_id && !childrenIds.includes(parseInt(student_id))) {
                 return res.status(403).json({ msg: "Forbidden: You can only view actions for your linked children." });
            }
            conditions.push(`aa.student_id = ANY($${valueIndex++})`);
            values.push(childrenIds);
            conditions.push(`aa.assistant_manager_approved_for_parent_view = TRUE`); // Only approved actions

        } else if (requestingUser.role === "admin_supervisor") {
            // Admin supervisor sees all actions but cannot modify or approve
            // No specific filter needed beyond route access, but cannot create/approve
        }

        // Apply query filters
        if (student_id && requestingUser.role !== "parent") { // Parent filter applied above
            conditions.push(`aa.student_id = $${valueIndex++}`);
            values.push(student_id);
        }
        if (class_id) {
             conditions.push(`s.class_id = $${valueIndex++}`);
             values.push(class_id);
        }
        if (start_date) {
            conditions.push(`aa.action_date >= $${valueIndex++}`);
            values.push(start_date);
        }
        if (end_date) {
            conditions.push(`aa.action_date <= $${valueIndex++}`);
            values.push(end_date);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY aa.action_date DESC, s.name ASC";

        const actions = await pool.query(query, values);
        res.json(actions.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get a specific administrative action by ID
// @route   GET /api/actions/:id
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Parent - with checks)
exports.getAdministrativeActionById = async (req, res) => {
    const actionId = parseInt(req.params.id);
    const requestingUser = req.user;

    if (isNaN(actionId)) {
        return res.status(400).json({ msg: "Invalid action ID" });
    }

    try {
        const actionResult = await pool.query(
            `SELECT aa.*, s.id as student_id, s.name as student_name
             FROM administrative_actions aa
             JOIN students s ON aa.student_id = s.id
             WHERE aa.id = $1`,
            [actionId]
        );

        if (actionResult.rows.length === 0) {
            return res.status(404).json({ msg: "Administrative action not found" });
        }

        const action = actionResult.rows[0];

        // Role-based access check
        if (requestingUser.role === "parent") {
            const linked = await isParentLinked(requestingUser.id, action.student_id);
            if (!linked || !action.assistant_manager_approved_for_parent_view) {
                return res.status(403).json({ msg: "Forbidden: You are not authorized to view this action." });
            }
        }
        // Admins, Supervisors, Assistant Managers can view any action based on route access

        // Fetch additional names for context
        const recorder = await pool.query("SELECT name FROM users WHERE id = $1", [action.recorded_by_user_id]);
        const approver = action.assistant_manager_user_id ? await pool.query("SELECT name FROM users WHERE id = $1", [action.assistant_manager_user_id]) : null;

        const responseAction = {
            ...action,
            recorded_by_name: recorder.rows[0]?.name,
            approved_by_name: approver?.rows[0]?.name
        };

        res.json(responseAction);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Approve/Disapprove an administrative action for parent view
// @route   PUT /api/actions/:id/approve-parent-view
// @access  Private (Assistant Manager only)
exports.approveForParentView = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const actionId = parseInt(req.params.id);
    if (isNaN(actionId)) {
        return res.status(400).json({ msg: "Invalid action ID" });
    }

    const { approve } = req.body; // Expecting a boolean value
    const assistantManagerUserId = req.user.id;

    try {
        // Check if action exists
        const action = await pool.query("SELECT id FROM administrative_actions WHERE id = $1", [actionId]);
        if (action.rows.length === 0) {
            return res.status(404).json({ msg: "Administrative action not found" });
        }

        // Update approval status
        const updatedAction = await pool.query(
            `UPDATE administrative_actions
             SET assistant_manager_approved_for_parent_view = $1, assistant_manager_user_id = $2, assistant_manager_approved_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [approve, assistantManagerUserId, actionId]
        );

        res.json(updatedAction.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

