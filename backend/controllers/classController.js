const pool = require("../config/database");
const { validationResult } = require("express-validator");

// @desc    Get all classes
// @route   GET /api/classes
// @access  Private (All authenticated users)
exports.getAllClasses = async (req, res) => {
    try {
        const classes = await pool.query("SELECT * FROM classes ORDER BY name ASC");
        res.json(classes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get class by ID
// @route   GET /api/classes/:id
// @access  Private (All authenticated users)
exports.getClassById = async (req, res) => {
    const classId = parseInt(req.params.id);
    if (isNaN(classId)) {
        return res.status(400).json({ msg: "Invalid class ID" });
    }

    try {
        const classResult = await pool.query("SELECT * FROM classes WHERE id = $1", [classId]);

        if (classResult.rows.length === 0) {
            return res.status(404).json({ msg: "Class not found" });
        }

        res.json(classResult.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Create a new class
// @route   POST /api/classes
// @access  Private (System Admin, Assistant Manager)
exports.createClass = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;

    try {
        // Check if class name already exists
        let existingClass = await pool.query("SELECT id FROM classes WHERE name = $1", [name]);
        if (existingClass.rows.length > 0) {
            return res.status(400).json({ msg: "Class with this name already exists" });
        }

        // Insert class
        const newClass = await pool.query(
            "INSERT INTO classes (name) VALUES ($1) RETURNING id, name",
            [name]
        );

        res.status(201).json(newClass.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Update class information
// @route   PUT /api/classes/:id
// @access  Private (System Admin, Assistant Manager)
exports.updateClass = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const classId = parseInt(req.params.id);
    if (isNaN(classId)) {
        return res.status(400).json({ msg: "Invalid class ID" });
    }

    const { name } = req.body;

    try {
        // Check if class exists
        let classResult = await pool.query("SELECT * FROM classes WHERE id = $1", [classId]);
        if (classResult.rows.length === 0) {
            return res.status(404).json({ msg: "Class not found" });
        }

        // Check if new name conflicts with another class
        if (name && name !== classResult.rows[0].name) {
            let existingName = await pool.query("SELECT id FROM classes WHERE name = $1 AND id != $2", [name, classId]);
            if (existingName.rows.length > 0) {
                return res.status(400).json({ msg: "Another class with this name already exists" });
            }
        }

        // Build update query
        const fieldsToUpdate = {};
        if (name !== undefined) fieldsToUpdate.name = name;

        const fieldNames = Object.keys(fieldsToUpdate);
        if (fieldNames.length === 0) {
            return res.status(400).json({ msg: "No valid fields provided for update" });
        }

        const setClauses = fieldNames.map((fieldName, index) => `"${fieldName}" = $${index + 1}`).join(", ");
        const values = fieldNames.map(fieldName => fieldsToUpdate[fieldName]);

        const updateQuery = `UPDATE classes SET ${setClauses} WHERE id = $${fieldNames.length + 1} RETURNING id, name`;
        values.push(classId);

        const updatedClass = await pool.query(updateQuery, values);

        res.json(updatedClass.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Delete a class
// @route   DELETE /api/classes/:id
// @access  Private (System Admin, Assistant Manager)
exports.deleteClass = async (req, res) => {
    const classId = parseInt(req.params.id);
    if (isNaN(classId)) {
        return res.status(400).json({ msg: "Invalid class ID" });
    }

    try {
        // Check if class exists
        let classResult = await pool.query("SELECT id FROM classes WHERE id = $1", [classId]);
        if (classResult.rows.length === 0) {
            return res.status(404).json({ msg: "Class not found" });
        }

        // Check if any students are assigned to this class
        const studentsInClass = await pool.query("SELECT id FROM students WHERE class_id = $1", [classId]);
        if (studentsInClass.rows.length > 0) {
            return res.status(400).json({ msg: "Cannot delete class: Students are currently assigned to it. Please reassign students first." });
        }

        // Delete class
        await pool.query("DELETE FROM classes WHERE id = $1", [classId]);

        res.json({ msg: "Class deleted successfully" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

