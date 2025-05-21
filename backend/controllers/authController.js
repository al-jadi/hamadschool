const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const jwtConfig = require("../config/jwt");
const { validationResult } = require("express-validator");

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  console.log("Login attempt received for email:", req.body.email); // Log entry point

  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Login validation errors:", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    console.log(`Attempting to find user with email: ${email}`);
    // Check if user exists
    const userResult = await pool.query("SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = $1", [email]);
    console.log(`User query executed for email: ${email}. Rows found: ${userResult.rows.length}`);

    if (userResult.rows.length === 0) {
      console.warn(`Login failed: User not found for email: ${email}`);
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    const user = userResult.rows[0];
    console.log(`User found: ${user.id}, Role: ${user.role_name}, Active: ${user.is_active}`);

    // Check if user is active
    if (!user.is_active) {
        console.warn(`Login failed: User account inactive for email: ${email}`);
        return res.status(403).json({ msg: "User account is inactive" });
    }

    console.log(`Attempting to compare password for user: ${user.id}`);
    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log(`Password comparison result for user ${user.id}: ${isMatch}`);

    if (!isMatch) {
      console.warn(`Login failed: Invalid password for email: ${email}`);
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    console.log(`Password matched for user: ${user.id}. Preparing JWT payload.`);
    // User matched, create JWT Payload
    const payload = {
      user: {
        id: user.id,
        role: user.role_name, // Include role name in the token payload
        name: user.name
      },
    };

    // Check if JWT_SECRET is defined
    if (!jwtConfig.secret || jwtConfig.secret === 'default_secret_key') {
        console.error("CRITICAL: JWT_SECRET is not set or using default value in environment variables!");
        // Optionally, prevent login if secret is insecure
        // return res.status(500).send("Server configuration error: JWT secret not set.");
    }

    console.log(`Attempting to sign JWT for user: ${user.id}`);
    // Sign token
    jwt.sign(
      payload,
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn },
      (err, token) => {
        // Correctly handle errors within the async callback
        if (err) {
          console.error(`JWT signing error for user ${user.id}:`, err); 
          // Send the 500 response directly from here
          return res.status(500).send("Server error during token generation"); 
        }
        console.log(`JWT signed successfully for user: ${user.id}. Sending token and user details.`);
        // --- CORRECTED RESPONSE: Send both token and user details --- 
        res.json({ 
          token: token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role_name, // Use role_name consistent with payload
            department_id: user.department_id // Include department_id for department heads
          }
        });
      }
    );
  } catch (err) {
    // Log the full error object and stack trace from synchronous parts or awaited promises
    console.error("Error during login process (outside JWT signing callback):", err);
    // Avoid sending response if headers already sent (e.g., by JWT error handler)
    if (!res.headersSent) {
        res.status(500).send("Server error");
    }
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Admin only
exports.registerUser = async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role_id, department_id } = req.body;

    try {
        // Check if user already exists
        const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ msg: "User already exists with this email" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const newUser = await pool.query(
            "INSERT INTO users (name, email, password_hash, role_id, department_id, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role_id, department_id, is_active",
            [name, email, hashedPassword, role_id, department_id || null, true]
        );

        // Get role name for the new user
        const roleResult = await pool.query("SELECT name FROM roles WHERE id = $1", [role_id]);
        const roleName = roleResult.rows[0]?.name || "unknown";

        res.status(201).json({
            msg: "User registered successfully",
            user: {
                id: newUser.rows[0].id,
                name: newUser.rows[0].name,
                email: newUser.rows[0].email,
                role: roleName,
                department_id: newUser.rows[0].department_id,
                is_active: newUser.rows[0].is_active
            }
        });
    } catch (err) {
        console.error("Error registering user:", err);
        res.status(500).send("Server Error");
    }
};

// @desc    Get logged in user details
// @route   GET /api/auth/user
// @access  Private
exports.getLoggedInUser = async (req, res) => {
    try {
        console.log(`Fetching details for logged-in user: ${req.user.id}`);
        // --- CORRECTED QUERY: Fetch role name and department_id --- 
        const userResult = await pool.query(
            "SELECT u.id, u.name, u.email, r.name as role_name, u.department_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1", 
            [req.user.id]
        );
        
        if (userResult.rows.length === 0) {
            console.warn(`Could not find details for logged-in user: ${req.user.id}`);
            return res.status(404).json({ msg: "User not found" });
        }
        
        console.log(`Successfully fetched details for user: ${req.user.id}`);
        // --- CORRECTED RESPONSE: Send role name as role and include department_id --- 
        const userDetails = userResult.rows[0];
        res.json({
            id: userDetails.id,
            name: userDetails.name,
            email: userDetails.email,
            role: userDetails.role_name, // Send role_name as role
            department_id: userDetails.department_id // Include department_id for department heads
        });
    } catch (err) {
        console.error("Error fetching logged-in user details:", err);
        res.status(500).send("Server Error");
    }
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
exports.requestPasswordReset = async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    try {
        // Check if user exists
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            // For security reasons, don't reveal if email exists or not
            return res.json({ msg: "If your email is registered, you will receive a password reset link" });
        }

        const user = userResult.rows[0];

        // Generate reset token
        const resetToken = jwt.sign(
            { user: { id: user.id } },
            jwtConfig.secret,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        // In a real application, you would send an email with the reset link
        // For this implementation, we'll just return the token
        // In production, you should NEVER return the token directly to the client

        // For demo purposes only:
        res.json({ 
            msg: "Password reset link has been sent to your email",
            // The following would be removed in production:
            demo_only_token: resetToken
        });
    } catch (err) {
        console.error("Error requesting password reset:", err);
        res.status(500).send("Server Error");
    }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public (with token)
exports.resetPassword = async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    try {
        // Verify token
        const decoded = jwt.verify(token, jwtConfig.secret);
        const userId = decoded.user.id;

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update user password
        await pool.query(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            [hashedPassword, userId]
        );

        res.json({ msg: "Password has been reset successfully" });
    } catch (err) {
        console.error("Error resetting password:", err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: "Invalid or expired token" });
        }
        res.status(500).send("Server Error");
    }
};
