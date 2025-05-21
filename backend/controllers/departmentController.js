// controllers/departmentController.js
const pool = require("../config/database");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid"); // Assuming uuid is installed

// Base directory for storing department files
const UPLOAD_DIR = path.join(__dirname, "../uploads/departments");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Helper function to get user details (assuming req.user is populated by auth middleware)
const getUserDetails = (req) => {
    return { id: req.user.id, role: req.user.role, departmentId: req.user.departmentId };
};

// --- Department Management ---

exports.createDepartment = async (req, res) => {
    const { name, head_user_id } = req.body;
    if (!name) {
        return res.status(400).json({ msg: "Department name is required" });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create department
            const newDepartment = await client.query(
                "INSERT INTO \"departments\" (name, head_user_id) VALUES ($1, $2) RETURNING *",
                [name, head_user_id || null]
            );

            // If head_user_id is provided, update the user's department_id and role if needed
            if (head_user_id) {
                const userCheck = await client.query(
                    "SELECT role_id FROM \"users\" WHERE id = $1",
                    [head_user_id]
                );
                
                if (userCheck.rows.length > 0) {
                    // Get role_id for 'department_head'
                    const roleCheck = await client.query(
                        "SELECT id FROM \"roles\" WHERE name = 'department_head'"
                    );
                    
                    if (roleCheck.rows.length > 0) {
                        const deptHeadRoleId = roleCheck.rows[0].id;
                        
                        // Update user's department and role
                        await client.query(
                            "UPDATE \"users\" SET department_id = $1, role_id = $2 WHERE id = $3",
                            [newDepartment.rows[0].id, deptHeadRoleId, head_user_id]
                        );
                    }
                }
            }

            await client.query('COMMIT');
            res.status(201).json(newDepartment.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error creating department:", err.message);
            if (err.code === '23505' && err.constraint === 'departments_name_key') {
                return res.status(409).json({ msg: "Department with this name already exists" });
            }
            res.status(500).send("Server error");
        } finally {
            client.release();
        }
    } catch (dbErr) {
        console.error("Database connection error:", dbErr.message);
        res.status(500).send("Database error");
    }
};

exports.getAllDepartments = async (req, res) => {
    try {
        const departments = await pool.query(
            `SELECT d.*, u.name as head_name 
             FROM "departments" d 
             LEFT JOIN "users" u ON d.head_user_id = u.id 
             ORDER BY d.name`
        );
        res.json(departments.rows);
    } catch (err) {
        console.error("Error fetching departments:", err.message);
        res.status(500).send("Server error");
    }
};

exports.getDepartmentById = async (req, res) => {
    const { id } = req.params;
    try {
        const department = await pool.query(
            `SELECT d.*, u.name as head_name, u.email as head_email
             FROM "departments" d 
             LEFT JOIN "users" u ON d.head_user_id = u.id 
             WHERE d.id = $1`,
            [id]
        );
        
        if (department.rows.length === 0) {
            return res.status(404).json({ msg: "Department not found" });
        }
        
        // Get teachers in this department
        const teachers = await pool.query(
            `SELECT u.id, u.name, u.email, r.name as role
             FROM "users" u
             JOIN "roles" r ON u.role_id = r.id
             WHERE u.department_id = $1
             ORDER BY u.name`,
            [id]
        );
        
        // Get subjects in this department
        const subjects = await pool.query(
            `SELECT id, name
             FROM "subjects"
             WHERE department_id = $1
             ORDER BY name`,
            [id]
        );
        
        const result = {
            ...department.rows[0],
            teachers: teachers.rows,
            subjects: subjects.rows
        };
        
        res.json(result);
    } catch (err) {
        console.error("Error fetching department:", err.message);
        res.status(500).send("Server error");
    }
};

exports.updateDepartment = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ msg: "Department name is required" });
    }

    try {
        const updatedDepartment = await pool.query(
            "UPDATE \"departments\" SET name = $1 WHERE id = $2 RETURNING *",
            [name, id]
        );

        if (updatedDepartment.rows.length === 0) {
            return res.status(404).json({ msg: "Department not found" });
        }
        res.json(updatedDepartment.rows[0]);
    } catch (err) {
        console.error("Error updating department:", err.message);
        if (err.code === '23505' && err.constraint === 'departments_name_key') {
            return res.status(409).json({ msg: "Another department with this name already exists" });
        }
        res.status(500).send("Server error");
    }
};

exports.assignDepartmentHead = async (req, res) => {
    const { id } = req.params;
    const { head_user_id } = req.body;

    if (!head_user_id) {
        return res.status(400).json({ msg: "Department head user ID is required" });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if user exists
            const userCheck = await client.query(
                "SELECT id, role_id FROM \"users\" WHERE id = $1",
                [head_user_id]
            );
            
            if (userCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ msg: "User not found" });
            }
            
            // Check if department exists
            const deptCheck = await client.query(
                "SELECT id, head_user_id FROM \"departments\" WHERE id = $1",
                [id]
            );
            
            if (deptCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ msg: "Department not found" });
            }
            
            // Get role_id for 'department_head'
            const roleCheck = await client.query(
                "SELECT id FROM \"roles\" WHERE name = 'department_head'"
            );
            
            if (roleCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(500).json({ msg: "Department head role not found in system" });
            }
            
            const deptHeadRoleId = roleCheck.rows[0].id;
            
            // If there's a current head, update their role to 'teacher' if they're a department_head
            if (deptCheck.rows[0].head_user_id) {
                const currentHeadCheck = await client.query(
                    "SELECT role_id FROM \"users\" WHERE id = $1",
                    [deptCheck.rows[0].head_user_id]
                );
                
                if (currentHeadCheck.rows.length > 0 && currentHeadCheck.rows[0].role_id === deptHeadRoleId) {
                    const teacherRoleCheck = await client.query(
                        "SELECT id FROM \"roles\" WHERE name = 'teacher'"
                    );
                    
                    if (teacherRoleCheck.rows.length > 0) {
                        await client.query(
                            "UPDATE \"users\" SET role_id = $1 WHERE id = $2",
                            [teacherRoleCheck.rows[0].id, deptCheck.rows[0].head_user_id]
                        );
                    }
                }
            }
            
            // Update department with new head
            const updatedDepartment = await client.query(
                "UPDATE \"departments\" SET head_user_id = $1 WHERE id = $2 RETURNING *",
                [head_user_id, id]
            );
            
            // Update user's role to department_head and set department_id
            await client.query(
                "UPDATE \"users\" SET role_id = $1, department_id = $2 WHERE id = $3",
                [deptHeadRoleId, id, head_user_id]
            );

            await client.query('COMMIT');
            res.json(updatedDepartment.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error assigning department head:", err.message);
            res.status(500).send("Server error");
        } finally {
            client.release();
        }
    } catch (dbErr) {
        console.error("Database connection error:", dbErr.message);
        res.status(500).send("Database error");
    }
};

exports.deleteDepartment = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Check for dependencies (subjects, users, etc.)
            const subjectsCheck = await client.query(
                "SELECT 1 FROM \"subjects\" WHERE department_id = $1 LIMIT 1",
                [id]
            );
            
            if (subjectsCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ msg: "Cannot delete department: It has subjects assigned to it." });
            }
            
            const usersCheck = await client.query(
                "SELECT 1 FROM \"users\" WHERE department_id = $1 LIMIT 1",
                [id]
            );
            
            if (usersCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ msg: "Cannot delete department: It has users assigned to it." });
            }
            
            // Delete department files (from database and filesystem)
            const files = await client.query(
                "SELECT file_path FROM \"department_files\" WHERE department_id = $1",
                [id]
            );
            
            for (const file of files.rows) {
                try {
                    fs.unlinkSync(file.file_path);
                } catch (err) {
                    console.error(`Error deleting file ${file.file_path}:`, err.message);
                    // Continue with deletion even if file removal fails
                }
            }
            
            await client.query(
                "DELETE FROM \"department_files\" WHERE department_id = $1",
                [id]
            );
            
            // Delete department bulletins
            await client.query(
                "DELETE FROM \"bulletin_acknowledgements\" WHERE bulletin_id IN (SELECT id FROM \"department_bulletins\" WHERE department_id = $1)",
                [id]
            );
            
            await client.query(
                "DELETE FROM \"department_bulletins\" WHERE department_id = $1",
                [id]
            );
            
            // Delete the department
            const deleteOp = await client.query(
                "DELETE FROM \"departments\" WHERE id = $1 RETURNING id",
                [id]
            );
            
            if (deleteOp.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ msg: "Department not found" });
            }
            
            await client.query('COMMIT');
            res.json({ msg: "Department deleted successfully" });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error deleting department:", err.message);
            res.status(500).send("Server error");
        } finally {
            client.release();
        }
    } catch (dbErr) {
        console.error("Database connection error:", dbErr.message);
        res.status(500).send("Database error");
    }
};

// --- Department Files Management ---

exports.uploadDepartmentFile = async (req, res) => {
    const { id } = req.params;
    const { file_name, description, file_content, file_extension } = req.body;
    const uploadingUser = getUserDetails(req);

    if (!file_name || !file_content) {
        return res.status(400).json({ msg: "File name and content are required" });
    }

    try {
        // Authorization check for department head
        if (uploadingUser.role === 'department_head' && uploadingUser.departmentId !== parseInt(id)) {
            return res.status(403).json({ msg: "Forbidden: You can only upload files to your own department" });
        }

        // Check if department exists
        const deptCheck = await pool.query(
            "SELECT id FROM \"departments\" WHERE id = $1",
            [id]
        );
        
        if (deptCheck.rows.length === 0) {
            return res.status(404).json({ msg: "Department not found" });
        }

        // Create department-specific directory if it doesn't exist
        const deptDir = path.join(UPLOAD_DIR, `dept_${id}`);
        if (!fs.existsSync(deptDir)) {
            fs.mkdirSync(deptDir, { recursive: true });
        }

        // Generate unique filename
        const uniqueId = uuidv4();
        const ext = file_extension || '.txt';
        const filename = `${uniqueId}${ext}`;
        const filePath = path.join(deptDir, filename);
        
        // Write file to disk
        fs.writeFileSync(filePath, Buffer.from(file_content, 'base64'));
        
        // Save file metadata to database
        const newFile = await pool.query(
            `INSERT INTO "department_files" 
             (department_id, file_name, file_path, description, uploaded_by_user_id) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id, file_name, filePath, description, uploadingUser.id]
        );
        
        res.status(201).json(newFile.rows[0]);
    } catch (err) {
        console.error("Error uploading department file:", err.message);
        res.status(500).send("Server error");
    }
};

exports.getDepartmentFiles = async (req, res) => {
    const { id } = req.params;
    const requestingUser = getUserDetails(req);

    try {
        // Check if department exists
        const deptCheck = await pool.query(
            "SELECT id FROM \"departments\" WHERE id = $1",
            [id]
        );
        
        if (deptCheck.rows.length === 0) {
            return res.status(404).json({ msg: "Department not found" });
        }

        // Authorization check for teachers
        if (requestingUser.role === 'teacher' && requestingUser.departmentId !== parseInt(id)) {
            return res.status(403).json({ msg: "Forbidden: You can only view files from your own department" });
        }

        const files = await pool.query(
            `SELECT df.*, u.name as uploaded_by_name 
             FROM "department_files" df
             JOIN "users" u ON df.uploaded_by_user_id = u.id
             WHERE df.department_id = $1
             ORDER BY df.uploaded_at DESC`,
            [id]
        );
        
        res.json(files.rows);
    } catch (err) {
        console.error("Error fetching department files:", err.message);
        res.status(500).send("Server error");
    }
};

exports.getDepartmentFileById = async (req, res) => {
    const { fileId } = req.params;
    const requestingUser = getUserDetails(req);

    try {
        const file = await pool.query(
            `SELECT df.*, d.id as department_id, d.name as department_name, u.name as uploaded_by_name 
             FROM "department_files" df
             JOIN "departments" d ON df.department_id = d.id
             JOIN "users" u ON df.uploaded_by_user_id = u.id
             WHERE df.id = $1`,
            [fileId]
        );
        
        if (file.rows.length === 0) {
            return res.status(404).json({ msg: "File not found" });
        }
        
        // Authorization check for teachers
        if (requestingUser.role === 'teacher' && requestingUser.departmentId !== file.rows[0].department_id) {
            return res.status(403).json({ msg: "Forbidden: You can only view files from your own department" });
        }
        
        // Read file content
        try {
            const fileContent = fs.readFileSync(file.rows[0].file_path, { encoding: 'base64' });
            res.json({
                ...file.rows[0],
                file_content: fileContent
            });
        } catch (readErr) {
            console.error("Error reading file:", readErr.message);
            res.status(404).json({ msg: "File content not found or inaccessible" });
        }
    } catch (err) {
        console.error("Error fetching department file:", err.message);
        res.status(500).send("Server error");
    }
};

exports.deleteDepartmentFile = async (req, res) => {
    const { fileId } = req.params;
    const deletingUser = getUserDetails(req);

    try {
        // Get file details including department
        const fileCheck = await pool.query(
            `SELECT df.*, d.head_user_id 
             FROM "department_files" df
             JOIN "departments" d ON df.department_id = d.id
             WHERE df.id = $1`,
            [fileId]
        );
        
        if (fileCheck.rows.length === 0) {
            return res.status(404).json({ msg: "File not found" });
        }
        
        const file = fileCheck.rows[0];
        
        // Authorization check for department head
        if (deletingUser.role === 'department_head' && 
            (deletingUser.departmentId !== file.department_id || deletingUser.id !== file.head_user_id)) {
            return res.status(403).json({ msg: "Forbidden: You can only delete files from your own department" });
        }
        
        // Delete file from filesystem
        try {
            fs.unlinkSync(file.file_path);
        } catch (unlinkErr) {
            console.error(`Error deleting file ${file.file_path}:`, unlinkErr.message);
            // Continue with database deletion even if file removal fails
        }
        
        // Delete file record from database
        await pool.query(
            "DELETE FROM \"department_files\" WHERE id = $1",
            [fileId]
        );
        
        res.json({ msg: "File deleted successfully" });
    } catch (err) {
        console.error("Error deleting department file:", err.message);
        res.status(500).send("Server error");
    }
};
