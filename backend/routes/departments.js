// routes/departments.js
const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const departmentMiddleware = require("../middleware/departmentMiddleware"); // Import the new middleware

// Define roles allowed for general management (create, delete, assign head)
const canManageDepartments = ["system_admin", "assistant_manager"];
// Define roles allowed to view departments
const canViewDepartments = ["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher"];
// Define roles allowed to update a department (with specific checks)
const canUpdateDepartment = ["system_admin", "assistant_manager", "department_head"];

// @route   POST api/departments
// @desc    Create a new department
// @access  Private (Admin, Assistant Manager)
router.post("/", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageDepartments), 
    departmentController.createDepartment
);

// @route   GET api/departments
// @desc    Get all departments
// @access  Private (Authenticated users with appropriate roles)
router.get("/", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canViewDepartments),
    departmentController.getAllDepartments
);

// @route   GET api/departments/:id
// @desc    Get department by ID
// @access  Private (Authenticated users with appropriate roles)
router.get("/:id", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canViewDepartments),
    departmentController.getDepartmentById
);

// @route   PUT api/departments/:id
// @desc    Update a department (Admin/Assistant can update any, Head can update own)
// @access  Private (Admin, Assistant Manager, Department Head)
router.put("/:id", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canUpdateDepartment), // Check if user has one of the allowed roles
    departmentMiddleware.checkDepartmentUpdatePermission, // Add specific check for ownership/role
    departmentController.updateDepartment
);

// @route   PUT api/departments/:id/head
// @desc    Assign department head
// @access  Private (Admin, Assistant Manager)
router.put("/:id/head", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageDepartments), 
    departmentController.assignDepartmentHead
);

// @route   DELETE api/departments/:id
// @desc    Delete a department
// @access  Private (Admin, Assistant Manager)
router.delete("/:id", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canManageDepartments), 
    departmentController.deleteDepartment
);

// Department Files Routes

// @route   POST api/departments/:id/files
// @desc    Upload a file to department
// @access  Private (Department Head, Admin, Assistant Manager)
router.post("/:id/files", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(["system_admin", "assistant_manager", "department_head"]), 
    // TODO: Add middleware to check if department head is uploading to their own department?
    departmentController.uploadDepartmentFile
);

// @route   GET api/departments/:id/files
// @desc    Get all files for a department
// @access  Private (Department members, Admin, Assistant Manager)
router.get("/:id/files", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canViewDepartments),
    // TODO: Add middleware to check if user is member of the department?
    departmentController.getDepartmentFiles
);

// @route   GET api/departments/files/:fileId
// @desc    Get a specific department file
// @access  Private (Department members, Admin, Assistant Manager)
router.get("/files/:fileId", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(canViewDepartments),
    // TODO: Add middleware to check if user is member of the department associated with the file?
    departmentController.getDepartmentFileById
);

// @route   DELETE api/departments/files/:fileId
// @desc    Delete a department file
// @access  Private (Department Head, Admin, Assistant Manager)
router.delete("/files/:fileId", 
    authMiddleware.verifyToken, 
    roleMiddleware.checkRole(["system_admin", "assistant_manager", "department_head"]), 
    // TODO: Add middleware to check if department head owns the department associated with the file?
    departmentController.deleteDepartmentFile
);

module.exports = router;

