// Middleware to check user role against allowed roles

exports.checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // Assumes verifyToken middleware has run and attached user to req
    if (!req.user || !req.user.role) {
      // This should ideally not happen if verifyToken runs first
      return res.status(401).json({ msg: "Authorization error: User role not found" });
    }

    const userRole = req.user.role; // e.g., 'system_admin', 'teacher', 'department_head'

    // Create a dynamic list of roles to check against
    let rolesToCheck = [...allowedRoles];

    // *** Modification Start: Grant Department Heads Teacher Permissions ***
    // If 'teacher' is an allowed role for this route, automatically allow 'department_head' as well
    // for teacher-specific functions.
    if (allowedRoles.includes('teacher') && !rolesToCheck.includes('department_head')) {
      rolesToCheck.push('department_head');
    }
    // *** Modification End ***

    if (rolesToCheck.includes(userRole)) {
      // Role is allowed, proceed to the next middleware or route handler
      next();
    } else {
      // Role is not allowed
      console.log(`Forbidden: User role '${userRole}' is not in effective allowed roles [${rolesToCheck.join(", ")}] for ${req.originalUrl}`);
      return res.status(403).json({ msg: "Forbidden: You do not have permission to access this resource" });
    }
  };
};

// Example Usage in a route file:
// const authMiddleware = require('../middleware/authMiddleware');
// const roleMiddleware = require('../middleware/roleMiddleware');
// router.get('/teacher-stuff', authMiddleware.verifyToken, roleMiddleware.checkRole(['teacher']), (req, res) => {
//   // Both teachers and department heads can access this
//   res.json({ msg: 'Welcome Teacher or Department Head!' });
// });
// router.get('/admin-only', authMiddleware.verifyToken, roleMiddleware.checkRole(['system_admin', 'assistant_manager']), (req, res) => {
//   res.json({ msg: 'Welcome Admin or Assistant Manager!' });
// });

