const pool = require("../config/database");
const { validationResult } = require("express-validator");

// Define settings keys that Assistant Manager can modify
const assistantManagerAllowedSettings = ["school_name", "academic_year"]; // Add other relevant keys

// @desc    Get all settings
// @route   GET /api/settings
// @access  Private (System Admin, Assistant Manager)
exports.getAllSettings = async (req, res) => {
    try {
        // Assistant Manager might only see certain settings, System Admin sees all.
        // For simplicity now, both roles see all settings they have access to via the route.
        // Filtering could be added here if needed.
        const settings = await pool.query("SELECT key, value, description FROM settings ORDER BY key ASC");
        res.json(settings.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Get a specific setting by key
// @route   GET /api/settings/:key
// @access  Private (System Admin, Assistant Manager)
exports.getSettingByKey = async (req, res) => {
    const settingKey = req.params.key;

    try {
        const setting = await pool.query("SELECT key, value, description FROM settings WHERE key = $1", [settingKey]);

        if (setting.rows.length === 0) {
            return res.status(404).json({ msg: "Setting not found" });
        }

        res.json(setting.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

// @desc    Update a specific setting
// @route   PUT /api/settings/:key
// @access  Private (System Admin, Assistant Manager - with restrictions)
exports.updateSetting = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const settingKey = req.params.key;
    const { value } = req.body;
    const requestingUser = req.user;

    try {
        // Check if setting exists
        const setting = await pool.query("SELECT key FROM settings WHERE key = $1", [settingKey]);
        if (setting.rows.length === 0) {
            return res.status(404).json({ msg: "Setting not found" });
        }

        // Role-based restriction for Assistant Manager
        if (requestingUser.role === "assistant_manager" && !assistantManagerAllowedSettings.includes(settingKey)) {
            return res.status(403).json({ msg: `Forbidden: Assistant Managers can only update specific settings (${assistantManagerAllowedSettings.join(", ")}).` });
        }

        // Update setting value
        const updatedSetting = await pool.query(
            "UPDATE settings SET value = $1 WHERE key = $2 RETURNING key, value, description",
            [value, settingKey]
        );

        res.json(updatedSetting.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

