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

// @desc    Record attendance for one or more students
// @route   POST /api/attendance
// @access  Private (Teacher, Admin Supervisor, System Admin)
exports.recordAttendance = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { records } = req.body; // Array of { student_id, date, period, status, notes }
    const recordedByUserId = req.user.id;
    const userRole = req.user.role;

    // Use a transaction to ensure all records are inserted or none
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const results = [];
        const errors = [];

        for (const record of records) {
            const { student_id, date, period, status, notes } = record;

            // Check if record already exists for this student, date, and period
            const existingRecord = await client.query(
                "SELECT id, recorded_by_user_id FROM attendance WHERE student_id = $1 AND date = $2 AND period = $3",
                [student_id, date, period]
            );

            if (existingRecord.rows.length > 0) {
                // Record exists - check if user is allowed to update
                if (userRole === "teacher") {
                    // Teachers cannot update existing records
                    errors.push({ student_id, date, period, msg: "Record already exists and teachers cannot modify it." });
                    continue; // Skip this record
                } else if (userRole === "admin_supervisor" || userRole === "system_admin") {
                    // Supervisor/Admin can update
                    const updateResult = await client.query(
                        `UPDATE attendance
                         SET status = $1, notes = $2, last_edited_by_user_id = $3, last_edited_at = CURRENT_TIMESTAMP
                         WHERE id = $4
                         RETURNING *`,
                        [status, notes, recordedByUserId, existingRecord.rows[0].id]
                    );
                    results.push(updateResult.rows[0]);
                } else {
                     errors.push({ student_id, date, period, msg: "Unauthorized role to update existing record." });
                     continue;
                }
            } else {
                // Record does not exist - insert new record
                const insertResult = await client.query(
                    `INSERT INTO attendance (student_id, date, period, status, notes, recorded_by_user_id)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                    [student_id, date, period, status, notes, recordedByUserId]
                );
                results.push(insertResult.rows[0]);
            }
        }

        if (errors.length > 0) {
            // If there were errors (e.g., teacher trying to update), rollback and report
            await client.query("ROLLBACK");
            // Return partial success with errors
            return res.status(400).json({ 
                msg: "Some records could not be processed.", 
                processed_records: results, 
                failed_records: errors 
            });
        } else {
            // All records processed successfully
            await client.query("COMMIT");
            res.status(201).json({ msg: "Attendance recorded successfully", records: results });
        }

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Transaction Error:", err.message);
        res.status(500).send("Server Error during attendance recording");
    } finally {
        client.release();
    }
};

// @desc    Get attendance records (filtered)
// @route   GET /api/attendance
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher, Parent)
exports.getAttendanceRecords = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const requestingUser = req.user;
    const { student_id, class_id, date, start_date, end_date, period } = req.query;

    let query = `
        SELECT
            a.id, a.date, a.period, a.status, a.notes,
            s.id as student_id, s.name as student_name, s.student_id as student_academic_id,
            c.id as class_id, c.name as class_name,
            rec_user.name as recorded_by_name,
            edit_user.name as edited_by_name,
            a.recorded_at, a.last_edited_at
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN users rec_user ON a.recorded_by_user_id = rec_user.id
        LEFT JOIN users edit_user ON a.last_edited_by_user_id = edit_user.id
    `;
    const conditions = [];
    const values = [];
    let valueIndex = 1;

    try {
        // Role-based filtering
        if (requestingUser.role === "parent") {
            // Parent can only see their linked children
            const childrenResult = await pool.query("SELECT student_id FROM parent_student_link WHERE parent_user_id = $1", [requestingUser.id]);
            const childrenIds = childrenResult.rows.map(row => row.student_id);
            if (childrenIds.length === 0) {
                return res.json([]); // Parent has no linked children
            }
            // If specific student_id is requested, check if it's one of the linked children
            if (student_id && !childrenIds.includes(parseInt(student_id))) {
                 return res.status(403).json({ msg: "Forbidden: You can only view attendance for your linked children." });
            }
            conditions.push(`a.student_id = ANY($${valueIndex++})`);
            values.push(childrenIds);

        } else if (requestingUser.role === "teacher") {
            // TODO: Implement logic for teacher to see only their assigned class(es)
            // This requires linking teachers to classes, which is not in the current schema.
            // For now, teachers can see all if no class_id filter is applied.
            if (class_id) {
                 conditions.push(`s.class_id = $${valueIndex++}`);
                 values.push(class_id);
            }
        }

        // Apply query filters
        if (student_id && requestingUser.role !== "parent") { // Parent filter applied above
            conditions.push(`a.student_id = $${valueIndex++}`);
            values.push(student_id);
        }
        if (class_id && requestingUser.role !== "teacher") { // Teacher filter applied above
             conditions.push(`s.class_id = $${valueIndex++}`);
             values.push(class_id);
        }
        if (date) {
            conditions.push(`a.date = $${valueIndex++}`);
            values.push(date);
        }
        if (start_date) {
            conditions.push(`a.date >= $${valueIndex++}`);
            values.push(start_date);
        }
        if (end_date) {
            conditions.push(`a.date <= $${valueIndex++}`);
            values.push(end_date);
        }
        if (period) {
            conditions.push(`a.period = $${valueIndex++}`);
            values.push(period);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY a.date DESC, s.name ASC, a.period ASC";

        const attendanceRecords = await pool.query(query, values);
        res.json(attendanceRecords.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Update a specific attendance record
// @route   PUT /api/attendance/:id
// @access  Private (Admin Supervisor, System Admin)
exports.updateAttendanceRecord = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const attendanceId = parseInt(req.params.id);
    if (isNaN(attendanceId)) {
        return res.status(400).json({ msg: "Invalid attendance record ID" });
    }

    const { status, notes } = req.body;
    const editedByUserId = req.user.id;

    // Ensure at least one field is being updated
    if (status === undefined && notes === undefined) {
        return res.status(400).json({ msg: "No fields provided for update (status or notes required)" });
    }

    try {
        // Check if record exists
        const record = await pool.query("SELECT id FROM attendance WHERE id = $1", [attendanceId]);
        if (record.rows.length === 0) {
            return res.status(404).json({ msg: "Attendance record not found" });
        }

        // Build update query dynamically
        const fieldsToUpdate = {};
        if (status !== undefined) fieldsToUpdate.status = status;
        if (notes !== undefined) fieldsToUpdate.notes = notes; // Allows setting notes to null
        fieldsToUpdate.last_edited_by_user_id = editedByUserId;
        fieldsToUpdate.last_edited_at = new Date(); // Use current timestamp

        const fieldNames = Object.keys(fieldsToUpdate);
        const setClauses = fieldNames.map((fieldName, index) => `"${fieldName}" = $${index + 1}`).join(", ");
        const values = fieldNames.map(fieldName => fieldsToUpdate[fieldName]);

        const updateQuery = `UPDATE attendance SET ${setClauses} WHERE id = $${fieldNames.length + 1} RETURNING *`;
        values.push(attendanceId);

        const updatedRecord = await pool.query(updateQuery, values);

        res.json(updatedRecord.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

