const pool = require("../config/db"); // Assuming db config is in ../config/db

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (Authenticated users)
exports.getAllRoles = async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name FROM roles ORDER BY id");
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching roles:", err.message);
        res.status(500).send("Server error");
    }
};

