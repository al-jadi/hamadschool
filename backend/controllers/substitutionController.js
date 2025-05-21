// controllers/substitutionController.js
const pool = require("../config/database");

// Helper function to get user details (assuming req.user is populated by auth middleware)
const getUserDetails = (req) => {
    return { id: req.user.id, role: req.user.role, departmentId: req.user.departmentId }; // Assuming departmentId is added to req.user
};

// Helper to get department ID of a user (especially for Dept Head)
const getDepartmentIdForUser = async (userId) => {
    // Check if user has department_id directly in users table
    const userInfo = await pool.query("SELECT department_id FROM users WHERE id = $1", [userId]);
    if (userInfo.rows.length > 0 && userInfo.rows[0].department_id) {
        return userInfo.rows[0].department_id;
    }
    // Check if user is a head of a department via departments table
    const deptInfo = await pool.query("SELECT id FROM departments WHERE head_id = $1", [userId]);
    if (deptInfo.rows.length > 0) {
        return deptInfo.rows[0].id;
    }
    return null;
};

// @desc    Record a new temporary substitution
// @route   POST /api/substitutions
// @access  Private (Department Head, Admin, Assistant Manager)
exports.createSubstitution = async (req, res) => {
    const { original_schedule_entry_id, substitute_teacher_user_id, substitution_date, reason } = req.body;
    const requestingUser = getUserDetails(req);

    if (!original_schedule_entry_id || !substitute_teacher_user_id || !substitution_date) {
        return res.status(400).json({ msg: "Missing required fields: schedule entry ID, substitute teacher ID, and date" });
    }

    try {
        // 1. Get details of the original schedule entry, including original teacher and their department
        const scheduleEntryQuery = await pool.query(
            `SELECT cse.teacher_user_id as original_teacher_user_id, u.department_id as original_teacher_dept_id
             FROM "class_schedule_entries" cse
             JOIN "users" u ON cse.teacher_user_id = u.id
             WHERE cse.id = $1`,
            [original_schedule_entry_id]
        );

        if (scheduleEntryQuery.rows.length === 0) {
            return res.status(404).json({ msg: "Original schedule entry not found" });
        }
        const { original_teacher_user_id, original_teacher_dept_id } = scheduleEntryQuery.rows[0];

        // 2. Verify substitute teacher exists
        const substituteTeacherQuery = await pool.query("SELECT id FROM users WHERE id = $1 AND role_id = (SELECT id FROM roles WHERE name = 'teacher')", [substitute_teacher_user_id]);
        if (substituteTeacherQuery.rows.length === 0) {
            return res.status(404).json({ msg: "Substitute teacher not found or is not a teacher" });
        }
        
        // 3. Permission Check: Admins/Assistants can record any substitution.
        //    Dept Heads can only record substitutions for teachers in their own department.
        let canRecord = false;
        if (requestingUser.role === 'system_admin' || requestingUser.role === 'assistant_manager') {
            canRecord = true;
        } else if (requestingUser.role === 'department_head') {
            const headDepartmentId = await getDepartmentIdForUser(requestingUser.id);
            if (headDepartmentId && original_teacher_dept_id === headDepartmentId) {
                canRecord = true;
            } else {
                console.log(`Forbidden: Dept Head ${requestingUser.id} (Dept ${headDepartmentId}) tried to record substitution for teacher ${original_teacher_user_id} in Dept ${original_teacher_dept_id}`);
            }
        }

        if (!canRecord) {
            return res.status(403).json({ msg: "Forbidden: You do not have permission to record this substitution" });
        }

        // 4. Check for existing substitution for the same entry on the same date?
        const existingSub = await pool.query(
            "SELECT id FROM temporary_substitutions WHERE original_schedule_entry_id = $1 AND substitution_date = $2 AND status = 'active'",
            [original_schedule_entry_id, substitution_date]
        );
        if (existingSub.rows.length > 0) {
            return res.status(409).json({ msg: "An active substitution already exists for this class period on this date." });
        }

        // 5. Insert the substitution record
        const newSubstitution = await pool.query(
            `INSERT INTO "temporary_substitutions" 
             (original_schedule_entry_id, original_teacher_user_id, substitute_teacher_user_id, substitution_date, reason, recorded_by_user_id, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
            [original_schedule_entry_id, original_teacher_user_id, substitute_teacher_user_id, substitution_date, reason, requestingUser.id]
        );

        res.status(201).json(newSubstitution.rows[0]);

    } catch (err) {
        console.error("Error creating substitution:", err.message);
        if (err.code === '23503') { // Foreign key violation
             return res.status(400).json({ msg: "Invalid schedule entry ID or teacher ID provided." });
        }
        res.status(500).send("Server error");
    }
};

// @desc    Get all temporary substitutions (filtered for Dept Heads)
// @route   GET /api/substitutions
// @access  Private (Department Head, Admin, Assistant Manager)
exports.getAllSubstitutions = async (req, res) => {
    const requestingUser = getUserDetails(req);
    const { date, teacherId, substituteId, departmentId } = req.query; // Add filters

    try {
        let query = `
            SELECT 
                ts.*, 
                orig_sched.class_id, c.name as class_name,
                orig_sched.subject_id, s.name as subject_name,
                orig_sched.time_slot_id, tslot.day_of_week, tslot.period_number, tslot.start_time, tslot.end_time,
                orig_teacher.name as original_teacher_name, orig_teacher.department_id as original_teacher_dept_id,
                sub_teacher.name as substitute_teacher_name,
                recorder.name as recorded_by_name
            FROM "temporary_substitutions" ts
            JOIN "class_schedule_entries" orig_sched ON ts.original_schedule_entry_id = orig_sched.id
            JOIN "users" orig_teacher ON ts.original_teacher_user_id = orig_teacher.id
            JOIN "users" sub_teacher ON ts.substitute_teacher_user_id = sub_teacher.id
            JOIN "users" recorder ON ts.recorded_by_user_id = recorder.id
            JOIN "classes" c ON orig_sched.class_id = c.id
            JOIN "subjects" s ON orig_sched.subject_id = s.id
            JOIN "time_slots" tslot ON orig_sched.time_slot_id = tslot.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        // Permission Filtering: Dept Heads only see substitutions involving their department's teachers
        if (requestingUser.role === 'department_head') {
            const headDepartmentId = await getDepartmentIdForUser(requestingUser.id);
            if (!headDepartmentId) {
                console.warn(`Department Head ${requestingUser.id} not assigned to a department.`);
                return res.json([]); // Return empty if head has no department
            }
            query += ` AND (orig_teacher.department_id = $${paramIndex++})`;
            params.push(headDepartmentId);
        } else if (requestingUser.role !== 'system_admin' && requestingUser.role !== 'assistant_manager') {
            // Should not happen due to route middleware, but safeguard
            return res.status(403).json({ msg: "Forbidden" });
        }

        // Apply query filters
        if (date) { query += ` AND ts.substitution_date = $${paramIndex++}`; params.push(date); }
        if (teacherId) { query += ` AND ts.original_teacher_user_id = $${paramIndex++}`; params.push(teacherId); }
        if (substituteId) { query += ` AND ts.substitute_teacher_user_id = $${paramIndex++}`; params.push(substituteId); }
        // Allow Admin/Assistant to filter by department
        if (departmentId && (requestingUser.role === 'system_admin' || requestingUser.role === 'assistant_manager')) {
             query += ` AND (orig_teacher.department_id = $${paramIndex++})`;
             params.push(departmentId);
        }

        query += " ORDER BY ts.substitution_date DESC, tslot.start_time";

        const substitutions = await pool.query(query, params);
        res.json(substitutions.rows);

    } catch (err) {
        console.error("Error fetching substitutions:", err.message);
        res.status(500).send("Server error");
    }
};

// @desc    Get a specific temporary substitution by ID
// @route   GET /api/substitutions/:id
// @access  Private (Department Head, Admin, Assistant Manager)
exports.getSubstitutionById = async (req, res) => {
    const { id } = req.params;
    const requestingUser = getUserDetails(req);

    try {
        // Query similar to getAllSubstitutions but filtered by ts.id
         let query = `
            SELECT 
                ts.*, 
                orig_sched.class_id, c.name as class_name,
                orig_sched.subject_id, s.name as subject_name,
                orig_sched.time_slot_id, tslot.day_of_week, tslot.period_number, tslot.start_time, tslot.end_time,
                orig_teacher.name as original_teacher_name, orig_teacher.department_id as original_teacher_dept_id,
                sub_teacher.name as substitute_teacher_name,
                recorder.name as recorded_by_name
            FROM "temporary_substitutions" ts
            JOIN "class_schedule_entries" orig_sched ON ts.original_schedule_entry_id = orig_sched.id
            JOIN "users" orig_teacher ON ts.original_teacher_user_id = orig_teacher.id
            JOIN "users" sub_teacher ON ts.substitute_teacher_user_id = sub_teacher.id
            JOIN "users" recorder ON ts.recorded_by_user_id = recorder.id
            JOIN "classes" c ON orig_sched.class_id = c.id
            JOIN "subjects" s ON orig_sched.subject_id = s.id
            JOIN "time_slots" tslot ON orig_sched.time_slot_id = tslot.id
            WHERE ts.id = $1
        `;
        const params = [id];

        const substitutionResult = await pool.query(query, params);

        if (substitutionResult.rows.length === 0) {
            return res.status(404).json({ msg: "Substitution record not found" });
        }
        const substitution = substitutionResult.rows[0];

        // Permission Check: Admins/Assistants can view any. Dept Heads can view if it involves their dept.
        let canView = false;
         if (requestingUser.role === 'system_admin' || requestingUser.role === 'assistant_manager') {
            canView = true;
        } else if (requestingUser.role === 'department_head') {
            const headDepartmentId = await getDepartmentIdForUser(requestingUser.id);
            if (headDepartmentId && substitution.original_teacher_dept_id === headDepartmentId) {
                canView = true;
            }
        }

        if (!canView) {
             console.log(`Forbidden: User ${requestingUser.id} (${requestingUser.role}) tried to view substitution ${id} outside their scope.`);
            return res.status(403).json({ msg: "Forbidden: You do not have permission to view this substitution record" });
        }

        res.json(substitution);

    } catch (err) {
        console.error("Error fetching substitution by ID:", err.message);
        res.status(500).send("Server error");
    }
};

// @desc    Cancel a temporary substitution (update status)
// @route   PUT /api/substitutions/:id/cancel
// @access  Private (Department Head, Admin, Assistant Manager)
exports.cancelSubstitution = async (req, res) => {
    const { id } = req.params;
    const requestingUser = getUserDetails(req);

    try {
        // 1. Get substitution details including original teacher's department
        const subQuery = await pool.query(
            `SELECT ts.*, u.department_id as original_teacher_dept_id 
             FROM "temporary_substitutions" ts
             JOIN "users" u ON ts.original_teacher_user_id = u.id
             WHERE ts.id = $1`, 
             [id]
        );
        if (subQuery.rows.length === 0) {
            return res.status(404).json({ msg: "Substitution record not found" });
        }
        const substitution = subQuery.rows[0];

        // 2. Permission Check: Admins/Assistants can cancel any. Dept Heads can cancel if it involves their dept.
        let canCancel = false;
         if (requestingUser.role === 'system_admin' || requestingUser.role === 'assistant_manager') {
            canCancel = true;
        } else if (requestingUser.role === 'department_head') {
            const headDepartmentId = await getDepartmentIdForUser(requestingUser.id);
            // Check if the head recorded it OR if the original teacher is in their department
            if (headDepartmentId && (substitution.recorded_by_user_id === requestingUser.id || substitution.original_teacher_dept_id === headDepartmentId)) {
                canCancel = true;
            }
        }

        if (!canCancel) {
            console.log(`Forbidden: User ${requestingUser.id} (${requestingUser.role}) tried to cancel substitution ${id} outside their scope.`);
            return res.status(403).json({ msg: "Forbidden: You do not have permission to cancel this substitution" });
        }

        // 3. Update status to 'cancelled'
        const updatedSub = await pool.query(
            "UPDATE temporary_substitutions SET status = 'cancelled' WHERE id = $1 RETURNING *",
            [id]
        );

        res.json(updatedSub.rows[0]);

    } catch (err) {
        console.error("Error cancelling substitution:", err.message);
        res.status(500).send("Server error");
    }
};

// Note: Deleting substitution records might be needed too, similar logic to cancel.

