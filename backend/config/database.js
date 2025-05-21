const { Pool } = require("pg");
require("dotenv").config();

// Use connection string from environment variable (recommended for Render/Supabase)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set!");
  process.exit(1); // Exit if the connection string is missing
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connections
  },
  family: 4 // Attempt to force IPv4 connection
});

// Test the connection (optional, but good for debugging)
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    // Log detailed error, especially during startup
    console.error("Initial database connection error:", err);
    // Consider exiting if the initial connection fails, depending on requirements
    // process.exit(1);
  } else {
    console.log("Database connected successfully at:", res.rows[0].now);
  }
});

module.exports = pool;

