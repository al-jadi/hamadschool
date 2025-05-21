const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { check, query } = require("express-validator");

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);

// @route   POST api/attendance
// @desc    Record attendance for one or more students
// @access  Private (Teacher, Admin Supervisor, System Admin)
// Note: Teacher should only record, Supervisor/Admin can potentially edit (handled in controller)
router.post("/", roleMiddleware.checkRole(["teacher", "admin_supervisor", "system_admin"]), [
    check("records", "Attendance records array is required").isArray({ min: 1 }),
    check("records.*.student_id", "Student ID is required").isInt(),
    check("records.*.date", "Date is required").isISO8601().toDate(), // YYYY-MM-DD
    check("records.*.period", "Period is required").isInt({ min: 1, max: 7 }), // Assuming 7 periods
    check("records.*.status", "Status is required (present, absent, late)").isIn(["present", "absent", "late"]),
    check("records.*.notes", "Notes must be a string").optional().isString()
], attendanceController.recordAttendance);

// @route   GET api/attendance
// @desc    Get attendance records (filtered)
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher, Parent)
router.get("/", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "teacher", "parent"]), [
    // Add query validation for filtering
    query("student_id", "Student ID must be an integer").optional().isInt(),
    query("class_id", "Class ID must be an integer").optional().isInt(),
    query("date", "Date must be in YYYY-MM-DD format").optional().isDate(),
    query("start_date", "Start date must be in YYYY-MM-DD format").optional().isDate(),
    query("end_date", "End date must be in YYYY-MM-DD format").optional().isDate(),
    query("period", "Period must be an integer").optional().isInt()
], attendanceController.getAttendanceRecords);

// @route   PUT api/attendance/:id
// @desc    Update a specific attendance record
// @access  Private (Admin Supervisor, System Admin)
router.put("/:id", roleMiddleware.checkRole(["admin_supervisor", "system_admin"]), [
    check("status", "Status is required (present, absent, late)").optional().isIn(["present", "absent", "late"]),
    check("notes", "Notes must be a string").optional({ nullable: true }).isString() // Allow null or string
], attendanceController.updateAttendanceRecord);

// Note: Deleting attendance records might not be standard practice. Usually updated.
// If needed, add a DELETE route with appropriate role checks (e.g., System Admin only).

module.exports = router;

