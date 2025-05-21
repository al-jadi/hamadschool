const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { check } = require("express-validator");

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);

// @route   GET api/students
// @desc    Get all students (potentially filtered by role/class)
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher)
router.get("/", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "teacher"]), studentController.getAllStudents);

// @route   GET api/students/my-children
// @desc    Get students linked to the logged-in parent
// @access  Private (Parent only)
router.get("/my-children", roleMiddleware.checkRole(["parent"]), studentController.getMyChildren);

// @route   GET api/students/:id
// @desc    Get student by ID
// @access  Private (System Admin, Assistant Manager, Admin Supervisor, Teacher, Parent - with checks)
router.get("/:id", roleMiddleware.checkRole(["system_admin", "assistant_manager", "admin_supervisor", "teacher", "parent"]), studentController.getStudentById);

// @route   POST api/students
// @desc    Create a new student
// @access  Private (System Admin, Assistant Manager)
router.post("/", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), [
    check("name", "Student name is required").not().isEmpty(),
    check("student_id", "Student academic ID is required").not().isEmpty(),
    check("class_id", "Class ID is required and must be an integer").isInt()
], studentController.createStudent);

// @route   PUT api/students/:id
// @desc    Update student information
// @access  Private (System Admin, Assistant Manager)
router.put("/:id", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), [
    check("name", "Student name cannot be empty").optional().not().isEmpty(),
    check("student_id", "Student academic ID cannot be empty").optional().not().isEmpty(),
    check("class_id", "Class ID must be an integer").optional().isInt()
], studentController.updateStudent);

// @route   DELETE api/students/:id
// @desc    Delete a student
// @access  Private (System Admin only)
router.delete("/:id", roleMiddleware.checkRole(["system_admin"]), studentController.deleteStudent);

// @route   POST api/students/link-parent
// @desc    Link a parent to a student
// @access  Private (System Admin, Assistant Manager)
router.post("/link-parent", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), [
    check("parent_user_id", "Parent User ID is required").isInt(),
    check("student_id", "Student ID is required").isInt()
], studentController.linkParentToStudent);

// @route   DELETE api/students/unlink-parent/:link_id
// @desc    Unlink a parent from a student
// @access  Private (System Admin, Assistant Manager)
router.delete("/unlink-parent/:link_id", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), studentController.unlinkParentFromStudent);


module.exports = router;

