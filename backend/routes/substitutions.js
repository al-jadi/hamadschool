// routes/substitutions.js
const express = require("express");
const router = express.Router();
const substitutionController = require("../controllers/substitutionController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Define roles allowed to manage substitutions (record, view, cancel)
const canManageSubstitutions = ["system_admin", "assistant_manager", "department_head"];

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);
router.use(roleMiddleware.checkRole(canManageSubstitutions)); // Ensure only authorized roles access these routes

// @route   POST api/substitutions
// @desc    Record a new temporary substitution
// @access  Private (Department Head, Admin, Assistant Manager)
router.post("/", substitutionController.createSubstitution);

// @route   GET api/substitutions
// @desc    Get all temporary substitutions (filtered for Dept Heads)
// @access  Private (Department Head, Admin, Assistant Manager)
router.get("/", substitutionController.getAllSubstitutions);

// @route   GET api/substitutions/:id
// @desc    Get a specific temporary substitution by ID
// @access  Private (Department Head, Admin, Assistant Manager)
router.get("/:id", substitutionController.getSubstitutionById);

// @route   PUT api/substitutions/:id/cancel
// @desc    Cancel a temporary substitution (update status)
// @access  Private (Department Head, Admin, Assistant Manager)
router.put("/:id/cancel", substitutionController.cancelSubstitution);

// TODO: Add route for deleting a substitution record if needed?
// router.delete("/:id", substitutionController.deleteSubstitution);

module.exports = router;

