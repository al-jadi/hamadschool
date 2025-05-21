const express = require("express");
const router = express.Router();
const administrativeActionController = require("../controllers/administrativeActionController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { check, query } = require("express-validator");

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);

// @route   POST api/actions
// @desc    Create a new administrative action record
// @access  Private (System Admin, Assistant Manager)
router.post("/", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), [
    check("student_id", "Student ID is required").isInt(),
    check("description", "Action description is required").not().isEmpty(),
    check("action_date", "Action date must be valid").optional().isISO8601().toDate()
], administrativeActionController.createAdministrativeAction);

// @route   GET api/actions
// @desc    Get administrative actions (filtered)
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Parent)
router.get("/", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "parent"]), [
    query("student_id", "Student ID must be an integer").optional().isInt(),
    query("class_id", "Class ID must be an integer").optional().isInt(),
    query("start_date", "Start date must be in YYYY-MM-DD format").optional().isDate(),
    query("end_date", "End date must be in YYYY-MM-DD format").optional().isDate()
], administrativeActionController.getAdministrativeActions);

// @route   GET api/actions/:id
// @desc    Get a specific administrative action by ID
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Parent - with checks)
router.get("/:id", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "parent"]), administrativeActionController.getAdministrativeActionById);

// @route   PUT api/actions/:id/approve-parent-view
// @desc    Approve/Disapprove an administrative action for parent view
// @access  Private (Assistant Manager only)
router.put("/:id/approve-parent-view", roleMiddleware.checkRole(["assistant_manager"]), [
    check("approve", "Approval status (true/false) is required").isBoolean()
], administrativeActionController.approveForParentView);

// Note: Editing/Deleting actions might require System Admin role, if needed.

module.exports = router;

