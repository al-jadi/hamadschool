// routes/parentBulletins.js
const express = require("express");
const router = express.Router();
const parentBulletinController = require("../controllers/parentBulletinController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Middleware to ensure user is authenticated for all bulletin routes
router.use(authMiddleware);

// Create a new parent bulletin (Admins only)
router.post(
    "/",
    roleMiddleware(["system_admin", "assistant_manager", "admin_supervisor"]),
    parentBulletinController.createParentBulletin
);

// Get all parent bulletins (Admins see all, Parents see published, others might be restricted)
router.get(
    "/",
    roleMiddleware(["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher", "parent"]),
    parentBulletinController.getAllParentBulletins
);

// Get a single parent bulletin by ID (Admins see all, Parents see published)
router.get(
    "/:id",
    roleMiddleware(["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher", "parent"]),
    parentBulletinController.getParentBulletinById
);

// Update a parent bulletin (Admins only)
router.put(
    "/:id",
    roleMiddleware(["system_admin", "assistant_manager", "admin_supervisor"]),
    parentBulletinController.updateParentBulletin
);

// Delete a parent bulletin (Admins only)
router.delete(
    "/:id",
    roleMiddleware(["system_admin", "assistant_manager", "admin_supervisor"]),
    parentBulletinController.deleteParentBulletin
);

module.exports = router;

