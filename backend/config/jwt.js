require("dotenv").config();

module.exports = {
  secret: process.env.JWT_SECRET || "default_secret_key", // Use environment variable or a default (not recommended for production)
  expiresIn: process.env.JWT_EXPIRES_IN || "1h", // Use environment variable or default
};

