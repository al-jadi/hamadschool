const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { check } = require("express-validator");

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);

// Define roles allowed to view users (now includes Department Head)
const canViewUsers = ["system_admin", "assistant_manager", "admin_supervisor", "department_head"];
// Define roles allowed to update users (now includes Department Head, controller handles specifics)
const canUpdateUser = ["system_admin", "department_head"];
// Define roles allowed to create users (System Admin only for now)
const canCreateUser = ["system_admin"];
// Define roles allowed to delete users (System Admin only for now)
const canDeleteUser = ["system_admin"];

// @route   GET api/users
// @desc    Get all users (filtered for Dept Heads)
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Department Head)
router.get("/", roleMiddleware.checkRole(canViewUsers), userController.getAllUsers);

// @route   GET api/users/:id
// @desc    Get user by ID (filtered for Dept Heads)
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Department Head)
router.get("/:id", roleMiddleware.checkRole(canViewUsers), userController.getUserById);

// @route   POST api/users
// @desc    Create a new user
// @access  Private (System Admin only)
router.post("/", roleMiddleware.checkRole(canCreateUser), [
    // Add validation checks similar to registration
    check("name", "Name is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check("password", "Please enter a password with 6 or more characters").isLength({ min: 6 }),
    check("role_id", "Role ID is required and must be an integer").isInt(),
    check("department_id", "Department ID must be an integer").optional({ nullable: true }).isInt() // Validate optional department_id
], userController.createUser);

// @route   PUT api/users/:id
// @desc    Update user information (Admin can update any, Head can update own dept members)
// @access  Private (System Admin, Department Head)
router.put("/:id", roleMiddleware.checkRole(canUpdateUser), [
    // Add validation checks for updates (optional fields)
    check("name", "Name cannot be empty").optional().not().isEmpty(),
    check("email", "Please include a valid email").optional().isEmail(),
    check("role_id", "Role ID must be an integer").optional().isInt(),
    check("is_active", "is_active must be a boolean").optional().isBoolean(),
    check("department_id", "Department ID must be an integer").optional({ nullable: true }).isInt() // Validate optional department_id
], userController.updateUser);

// @route   DELETE api/users/:id
// @desc    Delete a user (or mark as inactive)
// @access  Private (System Admin only)
router.delete("/:id", roleMiddleware.checkRole(canDeleteUser), userController.deleteUser);

module.exports = router;

