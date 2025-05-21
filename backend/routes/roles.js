const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const authMiddleware = require("../middleware/authMiddleware");

// Middleware to ensure user is authenticated for all role routes
router.use(authMiddleware.verifyToken);

// @route   GET api/roles
// @desc    Get all roles
// @access  Private (Authenticated users)
router.get("/", roleController.getAllRoles);

module.exports = router;

