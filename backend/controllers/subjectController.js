// controllers/subjectController.js
const pool = require("../config/database"); // Assuming database connection pool is configured

// Create a new subject
exports.createSubject = async (req, res) => {
    const { name, department_id } = req.body;
    if (!name) {
        return res.status(400).json({ msg: "Subject name is required" });
    }

    try {
        const newSubject = await pool.query(
            "INSERT INTO \"subjects\" (name, department_id) VALUES ($1, $2) RETURNING *",
            [name, department_id]
        );
        res.status(201).json(newSubject.rows[0]);
    } catch (err) {
        console.error("Error creating subject:", err.message);
        // Check for unique constraint violation (duplicate name)
        if (err.code === '23505' && err.constraint === 'subjects_name_key') {
            return res.status(409).json({ msg: "Subject with this name already exists" });
        }
        res.status(500).send("Server error");
    }
};

// Get all subjects (potentially filter by department)
exports.getAllSubjects = async (req, res) => {
    const { departmentId } = req.query; // Optional query parameter
    try {
        let query = "SELECT s.*, d.name as department_name FROM \"subjects\" s LEFT JOIN \"departments\" d ON s.department_id = d.id";
        const params = [];
        if (departmentId) {
            query += " WHERE s.department_id = $1";
            params.push(departmentId);
        }
        query += " ORDER BY s.name";

        const subjects = await pool.query(query, params);
        res.json(subjects.rows);
    } catch (err) {
        console.error("Error fetching subjects:", err.message);
        res.status(500).send("Server error");
    }
};

// Get subject by ID
exports.getSubjectById = async (req, res) => {
    const { id } = req.params;
    try {
        const subject = await pool.query("SELECT s.*, d.name as department_name FROM \"subjects\" s LEFT JOIN \"departments\" d ON s.department_id = d.id WHERE s.id = $1", [id]);
        if (subject.rows.length === 0) {
            return res.status(404).json({ msg: "Subject not found" });
        }
        res.json(subject.rows[0]);
    } catch (err) {
        console.error("Error fetching subject:", err.message);
        res.status(500).send("Server error");
    }
};

// Update a subject
exports.updateSubject = async (req, res) => {
    const { id } = req.params;
    const { name, department_id } = req.body;

    if (!name) {
        return res.status(400).json({ msg: "Subject name is required" });
    }

    try {
        const updatedSubject = await pool.query(
            "UPDATE \"subjects\" SET name = $1, department_id = $2 WHERE id = $3 RETURNING *",
            [name, department_id, id]
        );

        if (updatedSubject.rows.length === 0) {
            return res.status(404).json({ msg: "Subject not found" });
        }
        res.json(updatedSubject.rows[0]);
    } catch (err) {
        console.error("Error updating subject:", err.message);
        // Check for unique constraint violation (duplicate name)
        if (err.code === '23505' && err.constraint === 'subjects_name_key') {
            return res.status(409).json({ msg: "Another subject with this name already exists" });
        }
        res.status(500).send("Server error");
    }
};

// Delete a subject
exports.deleteSubject = async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Check if subject is used in class_schedule_entries before deleting
        const usageCheck = await pool.query("SELECT 1 FROM \"class_schedule_entries\" WHERE subject_id = $1 LIMIT 1", [id]);
        if (usageCheck.rows.length > 0) {
            return res.status(400).json({ msg: "Cannot delete subject: It is currently assigned in the schedule." });
        }

        const deleteOp = await pool.query("DELETE FROM \"subjects\" WHERE id = $1 RETURNING id", [id]);
        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ msg: "Subject not found" });
        }
        res.json({ msg: "Subject deleted successfully" });
    } catch (err) {
        console.error("Error deleting subject:", err.message);
        // Handle potential foreign key constraint errors if not checked above
        res.status(500).send("Server error");
    }
};

