// routes/timeSlots.js
const express = require("express");
const router = express.Router();
const timeSlotController = require("../controllers/timeSlotController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Define roles allowed to manage time slots (e.g., admin, assistant manager)
const canManageTimeSlots = ["system_admin", "assistant_manager"];

// @route   POST api/time-slots
// @desc    Create a new time slot
// @access  Private (Admin, Assistant Manager)
router.post("/",
    authMiddleware.verifyToken,
    roleMiddleware.checkRole(canManageTimeSlots),
    timeSlotController.createTimeSlot
);

// @route   GET api/time-slots
// @desc    Get all time slots
// @access  Private (Authenticated users)
router.get("/",
    authMiddleware.verifyToken,
    timeSlotController.getAllTimeSlots
);

// @route   GET api/time-slots/:id
// @desc    Get time slot by ID
// @access  Private (Authenticated users)
router.get("/:id",
    authMiddleware.verifyToken,
    timeSlotController.getTimeSlotById
);

// @route   PUT api/time-slots/:id
// @desc    Update a time slot
// @access  Private (Admin, Assistant Manager)
router.put("/:id",
    authMiddleware.verifyToken,
    roleMiddleware.checkRole(canManageTimeSlots),
    timeSlotController.updateTimeSlot
);

// @route   DELETE api/time-slots/:id
// @desc    Delete a time slot
// @access  Private (Admin, Assistant Manager)
router.delete("/:id",
    authMiddleware.verifyToken,
    roleMiddleware.checkRole(canManageTimeSlots),
    timeSlotController.deleteTimeSlot
);

module.exports = router;

