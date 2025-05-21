require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path"); // Needed for serving static files if frontend is bundled

console.log("Server script starting...");

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`Attempting to start server on port: ${PORT}`);

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies

// Basic Route
app.get("/", (req, res) => {
  console.log("Received request to / route");
  res.send("School Management System Backend is running!");
});

// --- API Routes ---
console.log("Loading API routes...");

// Authentication
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
console.log("- Auth routes loaded.");

// Users
const userRoutes = require("./routes/users");
app.use("/api/users", userRoutes);
console.log("- User routes loaded.");

// Roles
const roleRoutes = require("./routes/roles"); 
app.use("/api/roles", roleRoutes);
console.log("- Role routes loaded.");

// Departments
const departmentRoutes = require("./routes/departments");
app.use("/api/departments", departmentRoutes);
console.log("- Department routes loaded.");

// Classes
const classRoutes = require("./routes/classes");
app.use("/api/classes", classRoutes);
console.log("- Class routes loaded.");

// Students
const studentRoutes = require("./routes/students");
app.use("/api/students", studentRoutes);
console.log("- Student routes loaded.");

// Subjects
const subjectRoutes = require("./routes/subjects");
app.use("/api/subjects", subjectRoutes);
console.log("- Subject routes loaded.");

// Time Slots
const timeSlotRoutes = require("./routes/timeSlots");
app.use("/api/time-slots", timeSlotRoutes);
console.log("- Time Slot routes loaded.");

// Class Schedules
const classScheduleRoutes = require("./routes/classSchedules");
app.use("/api/schedules", classScheduleRoutes);
console.log("- Class Schedule routes loaded.");

// Temporary Substitutions (New)
const substitutionRoutes = require("./routes/substitutions");
app.use("/api/substitutions", substitutionRoutes);
console.log("- Substitution routes loaded.");

// Attendance
const attendanceRoutes = require("./routes/attendance");
app.use("/api/attendance", attendanceRoutes);
console.log("- Attendance routes loaded.");

// Behavior Reports
const behaviorRoutes = require("./routes/behavior");
app.use("/api/behavior", behaviorRoutes);
console.log("- Behavior routes loaded.");

// Administrative Actions
const administrativeActionRoutes = require("./routes/administrativeActions");
app.use("/api/actions", administrativeActionRoutes);
console.log("- Administrative Action routes loaded.");

// Exit Permissions (Assuming this relates to student exit)
const exitPermissionRoutes = require("./routes/exitPermissions");
app.use("/api/exit-permissions", exitPermissionRoutes);
console.log("- Exit Permission routes loaded.");

// Department Bulletins
const departmentBulletinRoutes = require("./routes/departmentBulletins");
app.use("/api/department-bulletins", departmentBulletinRoutes);
console.log("- Department Bulletin routes loaded.");

// Parent Bulletins
const parentBulletinRoutes = require("./routes/parentBulletins");
app.use("/api/parent-bulletins", parentBulletinRoutes);
console.log("- Parent Bulletin routes loaded.");

// Settings
const settingRoutes = require("./routes/settings");
app.use("/api/settings", settingRoutes);
console.log("- Settings routes loaded.");

console.log("All API routes loaded.");

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  console.error("!!! UNHANDLED ERROR !!!");
  console.error(`Error on ${req.method} ${req.path}`);
  console.error("Error Stack:", err.stack);
  console.error("Error Object:", err);

  // Specific error handling (e.g., validation errors)
  if (err.name === 'ValidationError') { // Example for a validation library
    return res.status(400).json({ message: "Validation Error", errors: err.errors });
  }

  // Default error response
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({ 
    message: err.message || "Internal Server Error",
    // Optionally include stack trace in development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
  });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server successfully started and listening on port ${PORT}`);
}).on('error', (err) => {
  console.error("!!! SERVER STARTUP FAILED !!!", err);
});

console.log("Server script finished initial setup.");

