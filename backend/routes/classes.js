const express = require("express");
const router = express.Router();
const classController = require("../controllers/classController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { check } = require("express-validator");

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);

// @route   GET api/classes
// @desc    Get all classes
// @access  Private (All authenticated users)
router.get("/", classController.getAllClasses);

// @route   GET api/classes/:id
// @desc    Get class by ID
// @access  Private (All authenticated users)
router.get("/:id", classController.getClassById);

// @route   POST api/classes
// @desc    Create a new class
// @access  Private (System Admin, Assistant Manager)
router.post("/", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), [
    check("name", "Class name is required").not().isEmpty()
], classController.createClass);

// @route   PUT api/classes/:id
// @desc    Update class information
// @access  Private (System Admin, Assistant Manager)
router.put("/:id", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), [
    check("name", "Class name cannot be empty").optional().not().isEmpty()
], classController.updateClass);

// @route   DELETE api/classes/:id
// @desc    Delete a class
// @access  Private (System Admin, Assistant Manager)
router.delete("/:id", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), classController.deleteClass);

module.exports = router;

