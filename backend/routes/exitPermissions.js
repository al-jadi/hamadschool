const express = require("express");
const router = express.Router();
const exitPermissionController = require("../controllers/exitPermissionController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { check, query } = require("express-validator");

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);

// @route   POST api/exit-permissions
// @desc    Request or record an exit permission
// @access  Private (System Admin, Assistant Manager, Admin Supervisor - Assuming these roles manage permissions)
router.post("/", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor"]), [
    check("student_id", "Student ID is required").isInt(),
    check("permission_date", "Permission date is required").isISO8601().toDate(),
    check("reason", "Reason is required").not().isEmpty(),
    check("status", "Status must be pending, approved, or rejected").optional().isIn(["pending", "approved", "rejected"])
], exitPermissionController.createExitPermission);

// @route   GET api/exit-permissions
// @desc    Get exit permissions (filtered)
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Parent)
router.get("/", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "parent"]), [
    query("student_id", "Student ID must be an integer").optional().isInt(),
    query("class_id", "Class ID must be an integer").optional().isInt(),
    query("start_date", "Start date must be in YYYY-MM-DD format").optional().isDate(),
    query("end_date", "End date must be in YYYY-MM-DD format").optional().isDate(),
    query("status", "Status must be pending, approved, or rejected").optional().isIn(["pending", "approved", "rejected"])
], exitPermissionController.getExitPermissions);

// @route   GET api/exit-permissions/:id
// @desc    Get a specific exit permission by ID
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Parent - with checks)
router.get("/:id", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "parent"]), exitPermissionController.getExitPermissionById);

// @route   PUT api/exit-permissions/:id/status
// @desc    Update the status of an exit permission (approve/reject)
// @access  Private (System Admin, Assistant Manager, Admin Supervisor)
router.put("/:id/status", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor"]), [
    check("status", "Status is required (approved or rejected)").isIn(["approved", "rejected"])
], exitPermissionController.updateExitPermissionStatus);


module.exports = router;

