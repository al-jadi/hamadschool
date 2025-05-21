// routes/classSchedules.js
const express = require("express");
const router = express.Router();
const classScheduleController = require("../controllers/classScheduleController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Define roles allowed to manage class schedules
const canManageSchedules = ["system_admin", "assistant_manager"];
const canViewSchedules = ["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher"];
const canRequestSwaps = ["system_admin", "assistant_manager", "department_head"];

// @route   POST api/class-schedules
// @desc    Create a new class schedule entry
// @access  Private (Admin, Assistant Manager)
router.post("/", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageSchedules), 
    classScheduleController.createScheduleEntry
);

// @route   GET api/class-schedules
// @desc    Get all class schedule entries (with optional filters)
// @access  Private (Authenticated users with appropriate roles)
router.get("/", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canViewSchedules),
    classScheduleController.getAllScheduleEntries
);

// @route   GET api/class-schedules/class/:classId
// @desc    Get schedule for a specific class
// @access  Private (Authenticated users with appropriate roles)
router.get("/class/:classId", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canViewSchedules),
    classScheduleController.getScheduleByClass
);

// @route   GET api/class-schedules/teacher/:teacherId
// @desc    Get schedule for a specific teacher
// @access  Private (Authenticated users with appropriate roles)
router.get("/teacher/:teacherId", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canViewSchedules),
    classScheduleController.getScheduleByTeacher
);

// @route   PUT api/class-schedules/:id
// @desc    Update a class schedule entry
// @access  Private (Admin, Assistant Manager)
router.put("/:id", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageSchedules), 
    classScheduleController.updateScheduleEntry
);

// @route   DELETE api/class-schedules/:id
// @desc    Delete a class schedule entry
// @access  Private (Admin, Assistant Manager)
router.delete("/:id", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageSchedules), 
    classScheduleController.deleteScheduleEntry
);

// Schedule Swap Request Routes

// @route   POST api/class-schedules/swap-requests
// @desc    Create a new schedule swap request
// @access  Private (Admin, Assistant Manager, Department Head)
router.post("/swap-requests", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canRequestSwaps), 
    classScheduleController.createSwapRequest
);

// @route   GET api/class-schedules/swap-requests
// @desc    Get all schedule swap requests (with optional filters)
// @access  Private (Admin, Assistant Manager, Department Head)
router.get("/swap-requests", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canRequestSwaps),
    classScheduleController.getAllSwapRequests
);

// @route   GET api/class-schedules/swap-requests/:id
// @desc    Get a specific swap request by ID
// @access  Private (Admin, Assistant Manager, Department Head)
router.get("/swap-requests/:id", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canRequestSwaps),
    classScheduleController.getSwapRequestById
);

// @route   PUT api/class-schedules/swap-requests/:id/approve
// @desc    Approve a swap request (first approval by department head)
// @access  Private (Department Head)
router.put("/swap-requests/:id/approve-first", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(["department_head"]), 
    classScheduleController.approveSwapRequestFirstStep
);

// @route   PUT api/class-schedules/swap-requests/:id/approve-final
// @desc    Final approval of a swap request (by assistant manager or second department head)
// @access  Private (Admin, Assistant Manager, Department Head)
router.put("/swap-requests/:id/approve-final", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canRequestSwaps), 
    classScheduleController.approveSwapRequestFinal
);

// @route   PUT api/class-schedules/swap-requests/:id/reject
// @desc    Reject a swap request
// @access  Private (Admin, Assistant Manager, Department Head)
router.put("/swap-requests/:id/reject", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canRequestSwaps), 
    classScheduleController.rejectSwapRequest
);

module.exports = router;
