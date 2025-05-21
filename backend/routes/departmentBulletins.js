// routes/departmentBulletins.js
const express = require("express");
const router = express.Router();
const departmentBulletinController = require("../controllers/departmentBulletinController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Middleware to ensure user is authenticated for all bulletin routes
router.use(authMiddleware);

// Create a new bulletin (Department Head only)
router.post(
    "/",
    roleMiddleware(["department_head"]),
    departmentBulletinController.createDepartmentBulletin
);

// Get all bulletins (Filtered by role: Admins see all, Head/Teacher see their dept, Teacher sees published only)
router.get(
    "/",
    roleMiddleware(["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher"]),
    departmentBulletinController.getAllDepartmentBulletins
);

// Get a single bulletin by ID (Admins see all, Head/Teacher see their dept, Teacher sees published only)
router.get(
    "/:id",
    roleMiddleware(["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher"]),
    departmentBulletinController.getDepartmentBulletinById
);

// Update a bulletin (Creator Dept Head or Admins)
router.put(
    "/:id",
    roleMiddleware(["system_admin", "assistant_manager", "department_head"]),
    departmentBulletinController.updateDepartmentBulletin
);

// Delete a bulletin (Creator Dept Head or Admins)
router.delete(
    "/:id",
    roleMiddleware(["system_admin", "assistant_manager", "department_head"]),
    departmentBulletinController.deleteDepartmentBulletin
);

// Acknowledge a bulletin (Teacher only for their department's published bulletins)
router.post(
    "/:id/acknowledge",
    roleMiddleware(["teacher"]),
    departmentBulletinController.acknowledgeBulletin
);

// Get acknowledgements for a bulletin (Dept Head of that dept or Admins)
router.get(
    "/:id/acknowledgements",
    roleMiddleware(["system_admin", "assistant_manager", "admin_supervisor", "department_head"]),
    departmentBulletinController.getBulletinAcknowledgements
);

module.exports = router;

