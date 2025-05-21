const express = require("express");
const router = express.Router();
const behaviorController = require("../controllers/behaviorController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { check, query } = require("express-validator");

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);

// @route   POST api/behavior
// @desc    Create a new behavior report
// @access  Private (Teacher only)
router.post("/", roleMiddleware.checkRole(["teacher"]), [
    check("student_id", "Student ID is required").isInt(),
    check("description", "Description is required").not().isEmpty(),
    check("report_date", "Report date must be valid").optional().isISO8601().toDate()
], behaviorController.createBehaviorReport);

// @route   GET api/behavior
// @desc    Get behavior reports (filtered)
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher, Parent)
router.get("/", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "teacher", "parent"]), [
    query("student_id", "Student ID must be an integer").optional().isInt(),
    query("class_id", "Class ID must be an integer").optional().isInt(),
    query("start_date", "Start date must be in YYYY-MM-DD format").optional().isDate(),
    query("end_date", "End date must be in YYYY-MM-DD format").optional().isDate()
], behaviorController.getBehaviorReports);

// @route   GET api/behavior/:id
// @desc    Get a specific behavior report by ID
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher, Parent - with checks)
router.get("/:id", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "teacher", "parent"]), behaviorController.getBehaviorReportById);

// @route   PUT api/behavior/:id/supervisor-comment
// @desc    Add/Update supervisor comment on a behavior report
// @access  Private (Admin Supervisor only)
router.put("/:id/supervisor-comment", roleMiddleware.checkRole(["admin_supervisor"]), [
    check("supervisor_comment", "Supervisor comment is required").not().isEmpty()
], behaviorController.addSupervisorComment);

// @route   PUT api/behavior/:id/approve-parent-view
// @desc    Approve/Disapprove a behavior report for parent view
// @access  Private (Assistant Manager only)
router.put("/:id/approve-parent-view", roleMiddleware.checkRole(["assistant_manager"]), [
    check("approve", "Approval status (true/false) is required").isBoolean()
], behaviorController.approveForParentView);

// Note: Teachers cannot edit reports after creation.
// Deleting reports might require System Admin role, if needed.

module.exports = router;

