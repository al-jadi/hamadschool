const bcrypt = require("bcryptjs");

const passwords = {
    "admin123": "",
    "assistant123": "",
    "supervisor123": "",
    "teacher123": "",
    "parent123": ""
};

const saltRounds = 10;

async function hashPasswords() {
    console.log("Generating password hashes...");
    for (const password in passwords) {
        try {
            const hash = await bcrypt.hash(password, saltRounds);
            passwords[password] = hash;
            console.log(`Password: ${password}, Hash: ${hash}`);
        } catch (error) {
            console.error(`Error hashing password ${password}:`, error);
        }
    }
    console.log("\nUpdate the seed.sql file with these hashes.");
}

hashPasswords();

