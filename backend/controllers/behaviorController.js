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

// @desc    Create a new behavior report
// @route   POST /api/behavior
// @access  Private (Teacher only)
exports.createBehaviorReport = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, description, report_date } = req.body;
    const reportedByUserId = req.user.id; // Teacher's ID from token

    try {
        // Check if student exists
        const student = await pool.query("SELECT id FROM students WHERE id = $1", [student_id]);
        if (student.rows.length === 0) {
            return res.status(404).json({ msg: "Student not found" });
        }

        // Insert report
        const newReport = await pool.query(
            `INSERT INTO behavior_reports (student_id, description, report_date, reported_by_user_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [student_id, description, report_date || new Date(), reportedByUserId]
        );

        res.status(201).json(newReport.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get behavior reports (filtered)
// @route   GET /api/behavior
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher, Parent)
exports.getBehaviorReports = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const requestingUser = req.user;
    const { student_id, class_id, start_date, end_date } = req.query;

    let query = `
        SELECT
            br.id, br.report_date, br.description,
            br.supervisor_comment, br.supervisor_comment_at,
            br.assistant_manager_approved_for_parent_view,
            br.assistant_manager_approved_at,
            s.id as student_id, s.name as student_name, s.student_id as student_academic_id,
            c.id as class_id, c.name as class_name,
            reporter.name as reported_by_name,
            supervisor.name as supervisor_name,
            approver.name as approved_by_name,
            br.reported_at
        FROM behavior_reports br
        JOIN students s ON br.student_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN users reporter ON br.reported_by_user_id = reporter.id
        LEFT JOIN users supervisor ON br.supervisor_user_id = supervisor.id
        LEFT JOIN users approver ON br.assistant_manager_user_id = approver.id
    `;
    const conditions = [];
    const values = [];
    let valueIndex = 1;

    try {
        // Role-based filtering
        if (requestingUser.role === "parent") {
            // Parent sees only approved reports for their linked children
            const childrenResult = await pool.query("SELECT student_id FROM parent_student_link WHERE parent_user_id = $1", [requestingUser.id]);
            const childrenIds = childrenResult.rows.map(row => row.student_id);
            if (childrenIds.length === 0) {
                return res.json([]); // Parent has no linked children
            }
            // If specific student_id is requested, check if it's one of the linked children
            if (student_id && !childrenIds.includes(parseInt(student_id))) {
                 return res.status(403).json({ msg: "Forbidden: You can only view reports for your linked children." });
            }
            conditions.push(`br.student_id = ANY($${valueIndex++})`);
            values.push(childrenIds);
            conditions.push(`br.assistant_manager_approved_for_parent_view = TRUE`); // Only approved reports

        } else if (requestingUser.role === "teacher") {
            // Teacher sees reports they created OR reports for students in their class(es)
            // TODO: Add class filtering logic when teacher-class link is established
            conditions.push(`(br.reported_by_user_id = $${valueIndex++})`); // Reports they created
            values.push(requestingUser.id);
            // Add OR condition for students in their class if class_id filter is provided or teacher-class link exists
        }

        // Apply query filters
        if (student_id && requestingUser.role !== "parent") { // Parent filter applied above
            conditions.push(`br.student_id = $${valueIndex++}`);
            values.push(student_id);
        }
        if (class_id) {
             conditions.push(`s.class_id = $${valueIndex++}`);
             values.push(class_id);
        }
        if (start_date) {
            conditions.push(`br.report_date >= $${valueIndex++}`);
            values.push(start_date);
        }
        if (end_date) {
            conditions.push(`br.report_date <= $${valueIndex++}`);
            values.push(end_date);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY br.report_date DESC, s.name ASC";

        const reports = await pool.query(query, values);
        res.json(reports.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get a specific behavior report by ID
// @route   GET /api/behavior/:id
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher, Parent - with checks)
exports.getBehaviorReportById = async (req, res) => {
    const reportId = parseInt(req.params.id);
    const requestingUser = req.user;

    if (isNaN(reportId)) {
        return res.status(400).json({ msg: "Invalid report ID" });
    }

    try {
        const reportResult = await pool.query(
            `SELECT br.*, s.id as student_id, s.name as student_name
             FROM behavior_reports br
             JOIN students s ON br.student_id = s.id
             WHERE br.id = $1`,
            [reportId]
        );

        if (reportResult.rows.length === 0) {
            return res.status(404).json({ msg: "Behavior report not found" });
        }

        const report = reportResult.rows[0];

        // Role-based access check
        if (requestingUser.role === "parent") {
            const linked = await isParentLinked(requestingUser.id, report.student_id);
            if (!linked || !report.assistant_manager_approved_for_parent_view) {
                return res.status(403).json({ msg: "Forbidden: You are not authorized to view this report." });
            }
        } else if (requestingUser.role === "teacher") {
            // Check if teacher reported it or if student is in their class (TODO: add class check)
            if (report.reported_by_user_id !== requestingUser.id) {
                 // TODO: Add check if student belongs to teacher's class
                 // return res.status(403).json({ msg: "Forbidden: You can only view reports you created or for your students." });
            }
        }
        // Admins, Supervisors, Assistant Managers can view any report based on route access

        // Fetch additional names for context
        const reporter = await pool.query("SELECT name FROM users WHERE id = $1", [report.reported_by_user_id]);
        const supervisor = report.supervisor_user_id ? await pool.query("SELECT name FROM users WHERE id = $1", [report.supervisor_user_id]) : null;
        const approver = report.assistant_manager_user_id ? await pool.query("SELECT name FROM users WHERE id = $1", [report.assistant_manager_user_id]) : null;

        const responseReport = {
            ...report,
            reported_by_name: reporter.rows[0]?.name,
            supervisor_name: supervisor?.rows[0]?.name,
            approved_by_name: approver?.rows[0]?.name
        };

        res.json(responseReport);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Add/Update supervisor comment on a behavior report
// @route   PUT /api/behavior/:id/supervisor-comment
// @access  Private (Admin Supervisor only)
exports.addSupervisorComment = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) {
        return res.status(400).json({ msg: "Invalid report ID" });
    }

    const { supervisor_comment } = req.body;
    const supervisorUserId = req.user.id;

    try {
        // Check if report exists
        const report = await pool.query("SELECT id FROM behavior_reports WHERE id = $1", [reportId]);
        if (report.rows.length === 0) {
            return res.status(404).json({ msg: "Behavior report not found" });
        }

        // Update comment
        const updatedReport = await pool.query(
            `UPDATE behavior_reports
             SET supervisor_comment = $1, supervisor_user_id = $2, supervisor_comment_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [supervisor_comment, supervisorUserId, reportId]
        );

        res.json(updatedReport.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Approve/Disapprove a behavior report for parent view
// @route   PUT /api/behavior/:id/approve-parent-view
// @access  Private (Assistant Manager only)
exports.approveForParentView = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) {
        return res.status(400).json({ msg: "Invalid report ID" });
    }

    const { approve } = req.body; // Expecting a boolean value
    const assistantManagerUserId = req.user.id;

    try {
        // Check if report exists
        const report = await pool.query("SELECT id FROM behavior_reports WHERE id = $1", [reportId]);
        if (report.rows.length === 0) {
            return res.status(404).json({ msg: "Behavior report not found" });
        }

        // Update approval status
        const updatedReport = await pool.query(
            `UPDATE behavior_reports
             SET assistant_manager_approved_for_parent_view = $1, assistant_manager_user_id = $2, assistant_manager_approved_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [approve, assistantManagerUserId, reportId]
        );

        res.json(updatedReport.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

