const jwt = require("jsonwebtoken");
const jwtConfig = require("../config/jwt");

// Middleware to verify JWT token
exports.verifyToken = (req, res, next) => {
  // Get token from header
  const token = req.header("x-auth-token");

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Add user from payload to request object
    req.user = decoded.user;
    next(); // Call the next middleware or route handler
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ msg: "Token is not valid" });
  }
};

