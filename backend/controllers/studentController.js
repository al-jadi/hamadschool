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

// @desc    Get all students
// @route   GET /api/students
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher)
exports.getAllStudents = async (req, res) => {
    // TODO: Implement filtering based on role (e.g., teacher sees own class)
    try {
        const students = await pool.query(
            "SELECT s.id, s.name, s.student_id, s.created_at, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id = c.id ORDER BY s.name ASC"
        );
        res.json(students.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get students linked to the logged-in parent
// @route   GET /api/students/my-children
// @access  Private (Parent only)
exports.getMyChildren = async (req, res) => {
    const parentId = req.user.id; // Assumes user ID is attached by auth middleware
    try {
        const students = await pool.query(
            `SELECT s.id, s.name, s.student_id, c.name as class_name
             FROM students s
             JOIN parent_student_link psl ON s.id = psl.student_id
             LEFT JOIN classes c ON s.class_id = c.id
             WHERE psl.parent_user_id = $1
             ORDER BY s.name ASC`,
            [parentId]
        );
        res.json(students.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};


// @desc    Get student by ID
// @route   GET /api/students/:id
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher, Parent - with checks)
exports.getStudentById = async (req, res) => {
    const studentId = parseInt(req.params.id);
    const requestingUser = req.user; // { id, role, name }

    if (isNaN(studentId)) {
        return res.status(400).json({ msg: "Invalid student ID" });
    }

    try {
        // If the user is a parent, check if they are linked to this student
        if (requestingUser.role === "parent") {
            const linked = await isParentLinked(requestingUser.id, studentId);
            if (!linked) {
                return res.status(403).json({ msg: "Forbidden: You are not authorized to view this student\'s details" });
            }
        }

        const student = await pool.query(
            "SELECT s.id, s.name, s.student_id, s.created_at, s.class_id, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = $1",
            [studentId]
        );

        if (student.rows.length === 0) {
            return res.status(404).json({ msg: "Student not found" });
        }

        res.json(student.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Create a new student
// @route   POST /api/students
// @access  Private (System Admin, Assistant Manager)
exports.createStudent = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, student_id, class_id } = req.body;

    try {
        // Check if student_id already exists
        let student = await pool.query("SELECT id FROM students WHERE student_id = $1", [student_id]);
        if (student.rows.length > 0) {
            return res.status(400).json({ msg: "Student already exists with this academic ID" });
        }

        // Check if class_id is valid
        const classExists = await pool.query("SELECT id FROM classes WHERE id = $1", [class_id]);
        if (classExists.rows.length === 0) {
            return res.status(400).json({ msg: "Invalid class ID" });
        }

        // Insert student
        const newStudent = await pool.query(
            "INSERT INTO students (name, student_id, class_id) VALUES ($1, $2, $3) RETURNING id, name, student_id, class_id, created_at",
            [name, student_id, class_id]
        );

        res.status(201).json(newStudent.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Update student information
// @route   PUT /api/students/:id
// @access  Private (System Admin, Assistant Manager)
exports.updateStudent = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
        return res.status(400).json({ msg: "Invalid student ID" });
    }

    const { name, student_id, class_id } = req.body;

    try {
        // Check if student exists
        let student = await pool.query("SELECT * FROM students WHERE id = $1", [studentId]);
        if (student.rows.length === 0) {
            return res.status(404).json({ msg: "Student not found" });
        }

        // Check if student_id is being updated and if it conflicts
        if (student_id && student_id !== student.rows[0].student_id) {
            let existingId = await pool.query("SELECT id FROM students WHERE student_id = $1 AND id != $2", [student_id, studentId]);
            if (existingId.rows.length > 0) {
                return res.status(400).json({ msg: "Academic ID already in use by another student" });
            }
        }

        // Check if class_id is valid if provided
        if (class_id) {
            const classExists = await pool.query("SELECT id FROM classes WHERE id = $1", [class_id]);
            if (classExists.rows.length === 0) {
                return res.status(400).json({ msg: "Invalid class ID" });
            }
        }

        // Build update query dynamically
        const fieldsToUpdate = {};
        if (name !== undefined) fieldsToUpdate.name = name;
        if (student_id !== undefined) fieldsToUpdate.student_id = student_id;
        if (class_id !== undefined) fieldsToUpdate.class_id = class_id;

        const fieldNames = Object.keys(fieldsToUpdate);
        if (fieldNames.length === 0) {
            return res.status(400).json({ msg: "No valid fields provided for update" });
        }

        const setClauses = fieldNames.map((fieldName, index) => `"${fieldName}" = $${index + 1}`).join(", ");
        const values = fieldNames.map(fieldName => fieldsToUpdate[fieldName]);

        const updateQuery = `UPDATE students SET ${setClauses} WHERE id = $${fieldNames.length + 1} RETURNING id, name, student_id, class_id, created_at`;
        values.push(studentId);

        const updatedStudent = await pool.query(updateQuery, values);

        res.json(updatedStudent.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Delete a student
// @route   DELETE /api/students/:id
// @access  Private (System Admin only)
exports.deleteStudent = async (req, res) => {
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
        return res.status(400).json({ msg: "Invalid student ID" });
    }

    try {
        // Check if student exists
        let student = await pool.query("SELECT id FROM students WHERE id = $1", [studentId]);
        if (student.rows.length === 0) {
            return res.status(404).json({ msg: "Student not found" });
        }

        // Need to handle related records (attendance, behavior, parent links) before deleting.
        // For now, we will proceed with deletion, but this should be refined.
        // Consider soft delete or cascading deletes in the schema.
        await pool.query("DELETE FROM parent_student_link WHERE student_id = $1", [studentId]); // Delete links first
        await pool.query("DELETE FROM attendance WHERE student_id = $1", [studentId]); // Delete attendance
        await pool.query("DELETE FROM behavior_reports WHERE student_id = $1", [studentId]); // Delete behavior reports
        await pool.query("DELETE FROM administrative_actions WHERE student_id = $1", [studentId]); // Delete actions
        await pool.query("DELETE FROM students WHERE id = $1", [studentId]); // Finally delete student

        res.json({ msg: "Student and related records deleted successfully" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error - Ensure related records are handled");
    }
};

// @desc    Link a parent to a student
// @route   POST /api/students/link-parent
// @access  Private (System Admin, Assistant Manager)
exports.linkParentToStudent = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { parent_user_id, student_id } = req.body;

    try {
        // Check if parent user exists and has the 'parent' role
        const parentUser = await pool.query("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1 AND r.name = 'parent'", [parent_user_id]);
        if (parentUser.rows.length === 0) {
            return res.status(404).json({ msg: "Parent user not found or user is not a parent" });
        }

        // Check if student exists
        const student = await pool.query("SELECT id FROM students WHERE id = $1", [student_id]);
        if (student.rows.length === 0) {
            return res.status(404).json({ msg: "Student not found" });
        }

        // Check if link already exists
        const existingLink = await pool.query("SELECT id FROM parent_student_link WHERE parent_user_id = $1 AND student_id = $2", [parent_user_id, student_id]);
        if (existingLink.rows.length > 0) {
            return res.status(400).json({ msg: "Parent is already linked to this student" });
        }

        // Create link
        const newLink = await pool.query(
            "INSERT INTO parent_student_link (parent_user_id, student_id) VALUES ($1, $2) RETURNING id, parent_user_id, student_id",
            [parent_user_id, student_id]
        );

        res.status(201).json(newLink.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Unlink a parent from a student
// @route   DELETE /api/students/unlink-parent/:link_id
// @access  Private (System Admin, Assistant Manager)
exports.unlinkParentFromStudent = async (req, res) => {
    const linkId = parseInt(req.params.link_id);
    if (isNaN(linkId)) {
        return res.status(400).json({ msg: "Invalid link ID" });
    }

    try {
        // Check if link exists
        const link = await pool.query("SELECT id FROM parent_student_link WHERE id = $1", [linkId]);
        if (link.rows.length === 0) {
            return res.status(404).json({ msg: "Link not found" });
        }

        // Delete link
        await pool.query("DELETE FROM parent_student_link WHERE id = $1", [linkId]);

        res.json({ msg: "Parent unlinked from student successfully" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

