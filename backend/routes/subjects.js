// routes/subjects.js
const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subjectController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Define roles allowed to manage subjects (e.g., admin, assistant manager)
const canManageSubjects = ["system_admin", "assistant_manager"];

// @route   POST api/subjects
// @desc    Create a new subject
// @access  Private (Admin, Assistant Manager)
router.post("/", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageSubjects), 
    subjectController.createSubject
);

// @route   GET api/subjects
// @desc    Get all subjects (potentially filter by department)
// @access  Private (Authenticated users)
router.get("/", 
    authMiddleware.verifyToken, 
    subjectController.getAllSubjects
);

// @route   GET api/subjects/:id
// @desc    Get subject by ID
// @access  Private (Authenticated users)
router.get("/:id", 
    authMiddleware.verifyToken, 
    subjectController.getSubjectById
);

// @route   PUT api/subjects/:id
// @desc    Update a subject
// @access  Private (Admin, Assistant Manager)
router.put("/:id", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageSubjects), 
    subjectController.updateSubject
);

// @route   DELETE api/subjects/:id
// @desc    Delete a subject
// @access  Private (Admin, Assistant Manager)
router.delete("/:id", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageSubjects), 
    subjectController.deleteSubject
);

module.exports = router;

