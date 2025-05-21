// controllers/classScheduleController.js
const pool = require("../config/database");

// Helper function to get user details (assuming req.user is populated by auth middleware)
const getUserDetails = (req) => {
    return { id: req.user.id, role: req.user.role, departmentId: req.user.departmentId };
};

// --- Schedule Entry Management ---

exports.createScheduleEntry = async (req, res) => {
    const { class_id, subject_id, teacher_user_id, time_slot_id, academic_year } = req.body;
    if (!class_id || !subject_id || !teacher_user_id || !time_slot_id || !academic_year) {
        return res.status(400).json({ msg: "Missing required fields" });
    }

    try {
        // Optional: Add validation to check if teacher belongs to the subject's department, etc.
        const newEntry = await pool.query(
            `INSERT INTO "class_schedule_entries" 
             (class_id, subject_id, teacher_user_id, time_slot_id, academic_year) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [class_id, subject_id, teacher_user_id, time_slot_id, academic_year]
        );
        res.status(201).json(newEntry.rows[0]);
    } catch (err) {
        console.error("Error creating schedule entry:", err.message);
        if (err.code === '23505') { // Unique constraint violation
             return res.status(409).json({ msg: "A schedule entry already exists for this class, time slot, and academic year." });
        }
        if (err.code === '23503') { // Foreign key violation
             return res.status(400).json({ msg: "Invalid class, subject, teacher, or time slot ID provided." });
        }
        res.status(500).send("Server error");
    }
};

exports.getAllScheduleEntries = async (req, res) => {
    // Add filters like class_id, teacher_id, day_of_week, academic_year as needed
    const { classId, teacherId, dayOfWeek, academicYear } = req.query;
    try {
        let query = `
            SELECT 
                cse.*, 
                c.name as class_name, 
                s.name as subject_name, 
                u.name as teacher_name, 
                ts.day_of_week, ts.period_number, ts.start_time, ts.end_time
            FROM "class_schedule_entries" cse
            JOIN "classes" c ON cse.class_id = c.id
            JOIN "subjects" s ON cse.subject_id = s.id
            JOIN "users" u ON cse.teacher_user_id = u.id
            JOIN "time_slots" ts ON cse.time_slot_id = ts.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (classId) { query += ` AND cse.class_id = $${paramIndex++}`; params.push(classId); }
        if (teacherId) { query += ` AND cse.teacher_user_id = $${paramIndex++}`; params.push(teacherId); }
        if (dayOfWeek) { query += ` AND ts.day_of_week = $${paramIndex++}`; params.push(dayOfWeek); }
        if (academicYear) { query += ` AND cse.academic_year = $${paramIndex++}`; params.push(academicYear); }
        
        query += " ORDER BY cse.academic_year, c.name, ts.day_of_week, ts.period_number";

        const entries = await pool.query(query, params);
        res.json(entries.rows);
    } catch (err) {
        console.error("Error fetching schedule entries:", err.message);
        res.status(500).send("Server error");
    }
};

exports.getScheduleByClass = async (req, res) => {
    const { classId } = req.params;
    const { academicYear } = req.query; // Mandatory or default?
    if (!academicYear) {
        return res.status(400).json({ msg: "Academic year query parameter is required" });
    }
    try {
         let query = `
            SELECT 
                cse.*, 
                c.name as class_name, 
                s.name as subject_name, 
                u.name as teacher_name, 
                ts.day_of_week, ts.period_number, ts.start_time, ts.end_time
            FROM "class_schedule_entries" cse
            JOIN "classes" c ON cse.class_id = c.id
            JOIN "subjects" s ON cse.subject_id = s.id
            JOIN "users" u ON cse.teacher_user_id = u.id
            JOIN "time_slots" ts ON cse.time_slot_id = ts.id
            WHERE cse.class_id = $1 AND cse.academic_year = $2
            ORDER BY ts.day_of_week, ts.period_number
        `;
        const entries = await pool.query(query, [classId, academicYear]);
        res.json(entries.rows);
    } catch (err) {
        console.error("Error fetching schedule by class:", err.message);
        res.status(500).send("Server error");
    }
};

exports.getScheduleByTeacher = async (req, res) => {
    const { teacherId } = req.params;
    const { academicYear } = req.query;
     if (!academicYear) {
        return res.status(400).json({ msg: "Academic year query parameter is required" });
    }
    try {
         let query = `
            SELECT 
                cse.*, 
                c.name as class_name, 
                s.name as subject_name, 
                u.name as teacher_name, 
                ts.day_of_week, ts.period_number, ts.start_time, ts.end_time
            FROM "class_schedule_entries" cse
            JOIN "classes" c ON cse.class_id = c.id
            JOIN "subjects" s ON cse.subject_id = s.id
            JOIN "users" u ON cse.teacher_user_id = u.id
            JOIN "time_slots" ts ON cse.time_slot_id = ts.id
            WHERE cse.teacher_user_id = $1 AND cse.academic_year = $2
            ORDER BY ts.day_of_week, ts.period_number
        `;
        const entries = await pool.query(query, [teacherId, academicYear]);
        res.json(entries.rows);
    } catch (err) {
        console.error("Error fetching schedule by teacher:", err.message);
        res.status(500).send("Server error");
    }
};

exports.updateScheduleEntry = async (req, res) => {
    const { id } = req.params;
    const { class_id, subject_id, teacher_user_id, time_slot_id, academic_year } = req.body;
    // Add validation as in create
    if (!class_id || !subject_id || !teacher_user_id || !time_slot_id || !academic_year) {
        return res.status(400).json({ msg: "Missing required fields" });
    }

    try {
        const updatedEntry = await pool.query(
            `UPDATE "class_schedule_entries" SET 
             class_id = $1, subject_id = $2, teacher_user_id = $3, time_slot_id = $4, academic_year = $5 
             WHERE id = $6 RETURNING *`,
            [class_id, subject_id, teacher_user_id, time_slot_id, academic_year, id]
        );
        if (updatedEntry.rows.length === 0) {
            return res.status(404).json({ msg: "Schedule entry not found" });
        }
        res.json(updatedEntry.rows[0]);
    } catch (err) {
        console.error("Error updating schedule entry:", err.message);
         if (err.code === '23505') { // Unique constraint violation
             return res.status(409).json({ msg: "A schedule entry already exists for this class, time slot, and academic year." });
        }
        if (err.code === '23503') { // Foreign key violation
             return res.status(400).json({ msg: "Invalid class, subject, teacher, or time slot ID provided." });
        }
        res.status(500).send("Server error");
    }
};

exports.deleteScheduleEntry = async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Check for related swap requests before deleting?
        const deleteOp = await pool.query("DELETE FROM \"class_schedule_entries\" WHERE id = $1 RETURNING id", [id]);
        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ msg: "Schedule entry not found" });
        }
        res.json({ msg: "Schedule entry deleted successfully" });
    } catch (err) {
        console.error("Error deleting schedule entry:", err.message);
        res.status(500).send("Server error");
    }
};

// --- Schedule Swap Request Management ---

exports.createSwapRequest = async (req, res) => {
    const { original_entry_id, target_entry_id, reason } = req.body;
    const requestingUser = getUserDetails(req);

    if (!original_entry_id || !target_entry_id) {
        return res.status(400).json({ msg: "Original and target schedule entry IDs are required" });
    }
    if (original_entry_id === target_entry_id) {
         return res.status(400).json({ msg: "Cannot swap an entry with itself" });
    }

    try {
        // Fetch details of both entries to validate swap possibility (e.g., same time slot)
        const entryDetails = await pool.query(
            `SELECT cse.*, u.department_id as teacher_dept_id 
             FROM "class_schedule_entries" cse 
             JOIN "users" u ON cse.teacher_user_id = u.id
             WHERE cse.id = ANY($1::int[])`, 
            [[original_entry_id, target_entry_id]]
        );

        if (entryDetails.rows.length !== 2) {
            return res.status(404).json({ msg: "One or both schedule entries not found" });
        }
        const originalEntry = entryDetails.rows.find(e => e.id === original_entry_id);
        const targetEntry = entryDetails.rows.find(e => e.id === target_entry_id);

        // Basic validation: Must be for the same time slot and academic year
        if (originalEntry.time_slot_id !== targetEntry.time_slot_id || originalEntry.academic_year !== targetEntry.academic_year) {
            return res.status(400).json({ msg: "Swap request invalid: Entries must be for the same time slot and academic year." });
        }

        // Check for existing pending/approved swaps involving these entries?

        const newRequest = await pool.query(
            `INSERT INTO "schedule_swap_requests" 
             (requesting_user_id, original_entry_id, target_entry_id, reason, status) 
             VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
            [requestingUser.id, original_entry_id, target_entry_id, reason]
        );
        res.status(201).json(newRequest.rows[0]);
        // TODO: Add notification logic here (e.g., notify relevant Dept Heads)

    } catch (err) {
        console.error("Error creating swap request:", err.message);
         if (err.code === '23503') { // Foreign key violation
             return res.status(400).json({ msg: "Invalid original or target entry ID provided." });
        }
        res.status(500).send("Server error");
    }
};

exports.getAllSwapRequests = async (req, res) => {
    const requestingUser = getUserDetails(req);
    // Filter by status, requester, involved teacher/dept etc.
    const { status, departmentId } = req.query;
    try {
        let query = `
            SELECT 
                ssr.*, 
                req_user.name as requester_name,
                orig_entry.class_id as orig_class_id, orig_c.name as orig_class_name, 
                orig_entry.subject_id as orig_subject_id, orig_s.name as orig_subject_name,
                orig_entry.teacher_user_id as orig_teacher_id, orig_t.name as orig_teacher_name,
                target_entry.class_id as target_class_id, target_c.name as target_class_name, 
                target_entry.subject_id as target_subject_id, target_s.name as target_subject_name,
                target_entry.teacher_user_id as target_teacher_id, target_t.name as target_teacher_name,
                ts.day_of_week, ts.period_number, ts.start_time, ts.end_time,
                head1_user.name as head1_approver_name,
                final_user.name as final_approver_name
            FROM "schedule_swap_requests" ssr
            JOIN "users" req_user ON ssr.requesting_user_id = req_user.id
            JOIN "class_schedule_entries" orig_entry ON ssr.original_entry_id = orig_entry.id
            JOIN "class_schedule_entries" target_entry ON ssr.target_entry_id = target_entry.id
            JOIN "classes" orig_c ON orig_entry.class_id = orig_c.id
            JOIN "subjects" orig_s ON orig_entry.subject_id = orig_s.id
            JOIN "users" orig_t ON orig_entry.teacher_user_id = orig_t.id
            JOIN "classes" target_c ON target_entry.class_id = target_c.id
            JOIN "subjects" target_s ON target_entry.subject_id = target_s.id
            JOIN "users" target_t ON target_entry.teacher_user_id = target_t.id
            JOIN "time_slots" ts ON orig_entry.time_slot_id = ts.id
            LEFT JOIN "users" head1_user ON ssr.approving_head1_user_id = head1_user.id
            LEFT JOIN "users" final_user ON ssr.final_approver_user_id = final_user.id
            WHERE 1=1 
        `;
        const params = [];
        let paramIndex = 1;

        // Authorization: Filter requests based on user role and department
        if (requestingUser.role === 'department_head') {
            // Dept Heads see requests involving their teachers or initiated by them
            query += ` AND (orig_t.department_id = $${paramIndex} OR target_t.department_id = $${paramIndex} OR ssr.requesting_user_id = $${paramIndex + 1})`;
            params.push(requestingUser.departmentId, requestingUser.id);
            paramIndex += 2;
        } else if (requestingUser.role !== 'system_admin' && requestingUser.role !== 'assistant_manager') {
            // Should not happen if roleMiddleware is correct, but as a safeguard
            return res.status(403).json({ msg: "Forbidden" });
        }

        if (status) { query += ` AND ssr.status = $${paramIndex++}`; params.push(status); }
        // Add department filter if needed (e.g., filter by department of involved teachers)
        if (departmentId && (requestingUser.role === 'system_admin' || requestingUser.role === 'assistant_manager')) {
             query += ` AND (orig_t.department_id = $${paramIndex} OR target_t.department_id = $${paramIndex})`;
             params.push(departmentId);
             paramIndex++;
        }

        query += " ORDER BY ssr.request_date DESC";

        const requests = await pool.query(query, params);
        res.json(requests.rows);
    } catch (err) {
        console.error("Error fetching swap requests:", err.message);
        res.status(500).send("Server error");
    }
};

exports.getSwapRequestById = async (req, res) => {
    const { id } = req.params;
    const requestingUser = getUserDetails(req);
    try {
        // Similar detailed query as getAllSwapRequests but filtered by ID
        const query = `
             SELECT 
                ssr.*, 
                req_user.name as requester_name,
                orig_entry.class_id as orig_class_id, orig_c.name as orig_class_name, 
                orig_entry.subject_id as orig_subject_id, orig_s.name as orig_subject_name,
                orig_entry.teacher_user_id as orig_teacher_id, orig_t.name as orig_teacher_name, orig_t.department_id as orig_teacher_dept_id,
                target_entry.class_id as target_class_id, target_c.name as target_class_name, 
                target_entry.subject_id as target_subject_id, target_s.name as target_subject_name,
                target_entry.teacher_user_id as target_teacher_id, target_t.name as target_teacher_name, target_t.department_id as target_teacher_dept_id,
                ts.day_of_week, ts.period_number, ts.start_time, ts.end_time,
                head1_user.name as head1_approver_name,
                final_user.name as final_approver_name
            FROM "schedule_swap_requests" ssr
            JOIN "users" req_user ON ssr.requesting_user_id = req_user.id
            JOIN "class_schedule_entries" orig_entry ON ssr.original_entry_id = orig_entry.id
            JOIN "class_schedule_entries" target_entry ON ssr.target_entry_id = target_entry.id
            JOIN "classes" orig_c ON orig_entry.class_id = orig_c.id
            JOIN "subjects" orig_s ON orig_entry.subject_id = orig_s.id
            JOIN "users" orig_t ON orig_entry.teacher_user_id = orig_t.id
            JOIN "classes" target_c ON target_entry.class_id = target_c.id
            JOIN "subjects" target_s ON target_entry.subject_id = target_s.id
            JOIN "users" target_t ON target_entry.teacher_user_id = target_t.id
            JOIN "time_slots" ts ON orig_entry.time_slot_id = ts.id
            LEFT JOIN "users" head1_user ON ssr.approving_head1_user_id = head1_user.id
            LEFT JOIN "users" final_user ON ssr.final_approver_user_id = final_user.id
            WHERE ssr.id = $1
        `;
        const requestResult = await pool.query(query, [id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ msg: "Swap request not found" });
        }
        const swapRequest = requestResult.rows[0];

        // Authorization check for Department Heads
        if (requestingUser.role === 'department_head' && 
            swapRequest.orig_teacher_dept_id !== requestingUser.departmentId &&
            swapRequest.target_teacher_dept_id !== requestingUser.departmentId &&
            swapRequest.requesting_user_id !== requestingUser.id) {
             return res.status(403).json({ msg: "Forbidden: You can only view requests involving your department or initiated by you." });
        }

        res.json(swapRequest);
    } catch (err) {
        console.error("Error fetching swap request by ID:", err.message);
        res.status(500).send("Server error");
    }
};

// Approve Swap Request - First Step (Department Head of one involved teacher)
exports.approveSwapRequestFirstStep = async (req, res) => {
    const { id } = req.params;
    const approvingUser = getUserDetails(req);

    // This route is only for department heads
    if (approvingUser.role !== 'department_head') {
        return res.status(403).json({ msg: "Forbidden: Only Department Heads can perform this action." });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get request details and involved teachers/departments
            const requestQuery = await client.query(
                `SELECT ssr.*, 
                        orig_t.department_id as orig_dept, 
                        target_t.department_id as target_dept,
                        orig_t.id as orig_teacher_id,
                        target_t.id as target_teacher_id
                 FROM "schedule_swap_requests" ssr
                 JOIN "class_schedule_entries" orig_e ON ssr.original_entry_id = orig_e.id
                 JOIN "users" orig_t ON orig_e.teacher_user_id = orig_t.id
                 JOIN "class_schedule_entries" target_e ON ssr.target_entry_id = target_e.id
                 JOIN "users" target_t ON target_e.teacher_user_id = target_t.id
                 WHERE ssr.id = $1 FOR UPDATE`, 
                [id]
            );

            if (requestQuery.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ msg: "Swap request not found" });
            }
            const swapRequest = requestQuery.rows[0];

            // Check if the current user is the head of one of the involved departments
            const isHeadOfOrig = swapRequest.orig_dept === approvingUser.departmentId;
            const isHeadOfTarget = swapRequest.target_dept === approvingUser.departmentId;

            if (!isHeadOfOrig && !isHeadOfTarget) {
                 await client.query('ROLLBACK');
                 return res.status(403).json({ msg: "Forbidden: You are not the head of either department involved." });
            }
            
            // Check current status
            if (swapRequest.status !== 'pending') {
                await client.query('ROLLBACK');
                return res.status(400).json({ msg: `Request is already ${swapRequest.status}` });
            }
            
            // Check if this head has already approved (if departments are different)
            if (swapRequest.approving_head1_user_id === approvingUser.id) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ msg: "You have already approved this step." });
            }

            let nextStatus = 'approved_by_head1';
            let finalApproverId = null;
            let finalApprovalTime = null;

            // Determine if final approval is needed or if this is the final step
            // Case 1: Both teachers in the same department, head approves -> 'approved'
            if (swapRequest.orig_dept === swapRequest.target_dept && isHeadOfOrig) {
                nextStatus = 'approved';
                finalApproverId = approvingUser.id;
                finalApprovalTime = new Date();
            }
            // Case 2: Teachers in different departments, this is the first head -> 'approved_by_head1'
            // (The second head or assistant manager will use the 'approveSwapRequestFinal' route)

            const updateResult = await client.query(
                `UPDATE "schedule_swap_requests" 
                 SET status = $1, approving_head1_user_id = $2, approving_head1_at = NOW(),
                     final_approver_user_id = $3, final_approved_at = $4
                 WHERE id = $5 RETURNING *`,
                [nextStatus, approvingUser.id, finalApproverId, finalApprovalTime, id]
            );

            // If status is now 'approved', perform the actual swap in class_schedule_entries
            if (nextStatus === 'approved') {
                await client.query(
                    `UPDATE "class_schedule_entries" SET teacher_user_id = $1 WHERE id = $2`,
                    [swapRequest.target_teacher_id, swapRequest.original_entry_id]
                );
                 await client.query(
                    `UPDATE "class_schedule_entries" SET teacher_user_id = $1 WHERE id = $2`,
                    [swapRequest.orig_teacher_id, swapRequest.target_entry_id]
                );
                 // TODO: Add notification logic (e.g., notify involved teachers, requester)
            } else {
                 // TODO: Add notification logic (e.g., notify other dept head or asst manager)
            }

            await client.query('COMMIT');
            res.json(updateResult.rows[0]);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error in first step approval:", err.message);
            res.status(500).send("Server error");
        } finally {
            client.release();
        }
    } catch (dbErr) {
        console.error("Database connection error:", dbErr.message);
        res.status(500).send("Database error");
    }
};

// Approve Swap Request - Final Step (Assistant Manager or Second Department Head)
exports.approveSwapRequestFinal = async (req, res) => {
    const { id } = req.params;
    const approvingUser = getUserDetails(req);

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const requestQuery = await client.query(
                 `SELECT ssr.*, 
                        orig_t.department_id as orig_dept, 
                        target_t.department_id as target_dept,
                        orig_t.id as orig_teacher_id,
                        target_t.id as target_teacher_id
                 FROM "schedule_swap_requests" ssr
                 JOIN "class_schedule_entries" orig_e ON ssr.original_entry_id = orig_e.id
                 JOIN "users" orig_t ON orig_e.teacher_user_id = orig_t.id
                 JOIN "class_schedule_entries" target_e ON ssr.target_entry_id = target_e.id
                 JOIN "users" target_t ON target_e.teacher_user_id = target_t.id
                 WHERE ssr.id = $1 FOR UPDATE`, 
                [id]
            );

            if (requestQuery.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ msg: "Swap request not found" });
            }
            const swapRequest = requestQuery.rows[0];

            // Authorization:
            // 1. Must be Asst Manager OR
            // 2. Must be Dept Head of the *other* department (if different departments)
            const isAsstManager = approvingUser.role === 'assistant_manager' || approvingUser.role === 'system_admin';
            const isSecondDeptHead = approvingUser.role === 'department_head' && 
                                     swapRequest.orig_dept !== swapRequest.target_dept &&
                                     (approvingUser.departmentId === swapRequest.orig_dept || approvingUser.departmentId === swapRequest.target_dept) &&
                                     approvingUser.id !== swapRequest.approving_head1_user_id; // Ensure it's not the first head approving again

            if (!isAsstManager && !isSecondDeptHead) {
                 await client.query('ROLLBACK');
                 return res.status(403).json({ msg: "Forbidden: You do not have permission for final approval." });
            }

            // Check current status - must be 'approved_by_head1' or 'pending' (if asst mgr overrides)
            if (swapRequest.status !== 'approved_by_head1' && !(isAsstManager && swapRequest.status === 'pending')) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ msg: `Request status is '${swapRequest.status}', cannot perform final approval.` });
            }

            // Update status to 'approved'
            const updateResult = await client.query(
                `UPDATE "schedule_swap_requests" 
                 SET status = 'approved', final_approver_user_id = $1, final_approved_at = NOW() 
                 WHERE id = $2 RETURNING *`,
                [approvingUser.id, id]
            );

            // Perform the actual swap in class_schedule_entries
            await client.query(
                `UPDATE "class_schedule_entries" SET teacher_user_id = $1 WHERE id = $2`,
                [swapRequest.target_teacher_id, swapRequest.original_entry_id]
            );
            await client.query(
                `UPDATE "class_schedule_entries" SET teacher_user_id = $1 WHERE id = $2`,
                [swapRequest.orig_teacher_id, swapRequest.target_entry_id]
            );

            // TODO: Add notification logic (e.g., notify involved teachers, requester, first head)

            await client.query('COMMIT');
            res.json(updateResult.rows[0]);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error in final step approval:", err.message);
            res.status(500).send("Server error");
        } finally {
            client.release();
        }
    } catch (dbErr) {
        console.error("Database connection error:", dbErr.message);
        res.status(500).send("Database error");
    }
};

exports.rejectSwapRequest = async (req, res) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const rejectingUser = getUserDetails(req);

    if (!rejection_reason) {
        return res.status(400).json({ msg: "Rejection reason is required" });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const requestQuery = await client.query(
                 `SELECT ssr.*, 
                        orig_t.department_id as orig_dept, 
                        target_t.department_id as target_dept
                 FROM "schedule_swap_requests" ssr
                 JOIN "class_schedule_entries" orig_e ON ssr.original_entry_id = orig_e.id
                 JOIN "users" orig_t ON orig_e.teacher_user_id = orig_t.id
                 JOIN "class_schedule_entries" target_e ON ssr.target_entry_id = target_e.id
                 JOIN "users" target_t ON target_e.teacher_user_id = target_t.id
                 WHERE ssr.id = $1 FOR UPDATE`, 
                [id]
            );

            if (requestQuery.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ msg: "Swap request not found" });
            }
            const swapRequest = requestQuery.rows[0];

            // Authorization: Asst Manager or involved Dept Head can reject
             const isAsstManager = rejectingUser.role === 'assistant_manager' || rejectingUser.role === 'system_admin';
             const isInvolvedDeptHead = rejectingUser.role === 'department_head' && 
                                     (rejectingUser.departmentId === swapRequest.orig_dept || rejectingUser.departmentId === swapRequest.target_dept);

            if (!isAsstManager && !isInvolvedDeptHead) {
                 await client.query('ROLLBACK');
                 return res.status(403).json({ msg: "Forbidden: You do not have permission to reject this request." });
            }

            // Check current status - cannot reject if already approved or rejected
            if (swapRequest.status === 'approved' || swapRequest.status === 'rejected') {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ msg: `Request is already ${swapRequest.status}` });
            }

            // Update status to 'rejected'
            const updateResult = await client.query(
                `UPDATE "schedule_swap_requests" 
                 SET status = 'rejected', final_approver_user_id = $1, final_approved_at = NOW(), rejection_reason = $2 
                 WHERE id = $3 RETURNING *`,
                [rejectingUser.id, rejection_reason, id]
            );

            // TODO: Add notification logic (e.g., notify requester, involved teachers/heads)

            await client.query('COMMIT');
            res.json(updateResult.rows[0]);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error rejecting swap request:", err.message);
            res.status(500).send("Server error");
        } finally {
            client.release();
        }
    } catch (dbErr) {
        console.error("Database connection error:", dbErr.message);
        res.status(500).send("Database error");
    }
};

