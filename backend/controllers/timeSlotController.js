// controllers/timeSlotController.js
const pool = require("../config/database");

// Create a new time slot
exports.createTimeSlot = async (req, res) => {
    const { day_of_week, period_number, start_time, end_time } = req.body;

    // Basic validation
    if (day_of_week === undefined || period_number === undefined || !start_time || !end_time) {
        return res.status(400).json({ msg: "Missing required fields: day_of_week, period_number, start_time, end_time" });
    }
    if (day_of_week < 0 || day_of_week > 6) {
        return res.status(400).json({ msg: "Invalid day_of_week (must be 0-6)" });
    }
    if (period_number < 1) { // Assuming period starts from 1
        return res.status(400).json({ msg: "Invalid period_number (must be >= 1)" });
    }

    try {
        const newTimeSlot = await pool.query(
            "INSERT INTO \"time_slots\" (day_of_week, period_number, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *",
            [day_of_week, period_number, start_time, end_time]
        );
        res.status(201).json(newTimeSlot.rows[0]);
    } catch (err) {
        console.error("Error creating time slot:", err.message);
        // Check for unique constraint violation (day_of_week, period_number)
        if (err.code === '23505' && err.constraint === 'time_slots_day_of_week_period_number_key') {
            return res.status(409).json({ msg: `Time slot for day ${day_of_week}, period ${period_number} already exists` });
        }
        res.status(500).send("Server error");
    }
};

// Get all time slots
exports.getAllTimeSlots = async (req, res) => {
    try {
        const timeSlots = await pool.query("SELECT * FROM \"time_slots\" ORDER BY day_of_week, period_number");
        res.json(timeSlots.rows);
    } catch (err) {
        console.error("Error fetching time slots:", err.message);
        res.status(500).send("Server error");
    }
};

// Get time slot by ID
exports.getTimeSlotById = async (req, res) => {
    const { id } = req.params;
    try {
        const timeSlot = await pool.query("SELECT * FROM \"time_slots\" WHERE id = $1", [id]);
        if (timeSlot.rows.length === 0) {
            return res.status(404).json({ msg: "Time slot not found" });
        }
        res.json(timeSlot.rows[0]);
    } catch (err) {
        console.error("Error fetching time slot:", err.message);
        res.status(500).send("Server error");
    }
};

// Update a time slot
exports.updateTimeSlot = async (req, res) => {
    const { id } = req.params;
    const { day_of_week, period_number, start_time, end_time } = req.body;

    // Basic validation
    if (day_of_week === undefined || period_number === undefined || !start_time || !end_time) {
        return res.status(400).json({ msg: "Missing required fields: day_of_week, period_number, start_time, end_time" });
    }
     if (day_of_week < 0 || day_of_week > 6) {
        return res.status(400).json({ msg: "Invalid day_of_week (must be 0-6)" });
    }
    if (period_number < 1) {
        return res.status(400).json({ msg: "Invalid period_number (must be >= 1)" });
    }

    try {
        const updatedTimeSlot = await pool.query(
            "UPDATE \"time_slots\" SET day_of_week = $1, period_number = $2, start_time = $3, end_time = $4 WHERE id = $5 RETURNING *",
            [day_of_week, period_number, start_time, end_time, id]
        );

        if (updatedTimeSlot.rows.length === 0) {
            return res.status(404).json({ msg: "Time slot not found" });
        }
        res.json(updatedTimeSlot.rows[0]);
    } catch (err) {
        console.error("Error updating time slot:", err.message);
         // Check for unique constraint violation (day_of_week, period_number)
        if (err.code === '23505' && err.constraint === 'time_slots_day_of_week_period_number_key') {
            return res.status(409).json({ msg: `Another time slot for day ${day_of_week}, period ${period_number} already exists` });
        }
        res.status(500).send("Server error");
    }
};

// Delete a time slot
exports.deleteTimeSlot = async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Check if time slot is used in class_schedule_entries before deleting
        const usageCheck = await pool.query("SELECT 1 FROM \"class_schedule_entries\" WHERE time_slot_id = $1 LIMIT 1", [id]);
        if (usageCheck.rows.length > 0) {
            return res.status(400).json({ msg: "Cannot delete time slot: It is currently used in the schedule." });
        }

        const deleteOp = await pool.query("DELETE FROM \"time_slots\" WHERE id = $1 RETURNING id", [id]);
        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ msg: "Time slot not found" });
        }
        res.json({ msg: "Time slot deleted successfully" });
    } catch (err) {
        console.error("Error deleting time slot:", err.message);
        // Handle potential foreign key constraint errors if not checked above
        res.status(500).send("Server error");
    }
};

