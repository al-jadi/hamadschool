const express = require("express");
const router = express.Router();
const settingController = require("../controllers/settingController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { check } = require("express-validator");

// Middleware applied to all routes in this file
router.use(authMiddleware.verifyToken);

// @route   GET api/settings
// @desc    Get all settings (or specific settings based on role)
// @access  Private (System Admin, Assistant Manager)
router.get("/", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), settingController.getAllSettings);

// @route   GET api/settings/:key
// @desc    Get a specific setting by key
// @access  Private (System Admin, Assistant Manager)
router.get("/:key", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), settingController.getSettingByKey);

// @route   PUT api/settings/:key
// @desc    Update a specific setting
// @access  Private (System Admin, Assistant Manager - with restrictions)
router.put("/:key", roleMiddleware.checkRole(["system_admin", "assistant_manager"]), [
    check("value", "Setting value is required").not().isEmpty()
], settingController.updateSetting);

// Note: Creating/Deleting settings might be restricted to System Admin only via DB migrations or a dedicated route.

module.exports = router;

