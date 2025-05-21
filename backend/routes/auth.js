const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { check } = require("express-validator"); // For input validation
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// @route   POST api/auth/register
// @desc    Register a new user
// @access  Admin only
router.post("/register", [
  authMiddleware.verifyToken,
  roleMiddleware.checkRole(['system_admin', 'assistant_manager']),
  check("name", "Name is required").not().isEmpty(),
  check("email", "Please include a valid email").isEmail(),
  check("password", "Please enter a password with 6 or more characters").isLength({ min: 6 }),
  check("role_id", "Role is required").isInt()
], authController.registerUser);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", [
  check("email", "Please include a valid email").isEmail(),
  check("password", "Password is required").exists(),
], authController.loginUser);

// @route   GET api/auth/user
// @desc    Get logged in user details (using token)
// @access  Private
router.get('/user', authMiddleware.verifyToken, authController.getLoggedInUser);

// @route   POST api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', [
  check("email", "Please include a valid email").isEmail(),
], authController.requestPasswordReset);

// @route   POST api/auth/reset-password
// @desc    Reset password with token
// @access  Public (with token)
router.post('/reset-password', [
  check("token", "Token is required").not().isEmpty(),
  check("password", "Please enter a password with 6 or more characters").isLength({ min: 6 }),
], authController.resetPassword);

module.exports = router;

