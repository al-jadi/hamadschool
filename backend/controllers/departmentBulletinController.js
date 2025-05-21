// controllers/departmentBulletinController.js
const pool = require("../config/db");

// Helper function to check if user is head of the relevant department
async function isHeadOfDepartment(userId, departmentId) {
    const userResult = await pool.query("SELECT department_id FROM users WHERE id = $1 AND role_id = (SELECT id FROM roles WHERE name = 'department_head')", [userId]);
    return userResult.rows.length > 0 && userResult.rows[0].department_id === departmentId;
}

// Helper function to check if user belongs to the department
async function isUserInDepartment(userId, departmentId) {
    const userResult = await pool.query("SELECT department_id FROM users WHERE id = $1", [userId]);
    return userResult.rows.length > 0 && userResult.rows[0].department_id === departmentId;
}

// Create a new department bulletin
exports.createDepartmentBulletin = async (req, res) => {
    const { title, content, status, attachment_path } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userDepartmentId = req.user.department_id; // Assuming this is populated by auth middleware

    // Only department heads can create bulletins for their department
    if (userRole !== 'department_head') {
        return res.status(403).json({ message: "فقط رؤساء الأقسام يمكنهم إنشاء نشرات القسم." });
    }

    try {
        const newBulletin = await pool.query(
            `INSERT INTO "department_bulletins" (department_id, title, content, created_by_user_id, status, attachment_path, published_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userDepartmentId, title, content, userId, status || 'draft', attachment_path, (status === 'published' ? new Date() : null)]
        );
        res.status(201).json(newBulletin.rows[0]);
    } catch (error) {
        console.error("Error creating department bulletin:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء إنشاء النشرة", error: error.message });
    }
};

// Get all department bulletins (filtered by role/department)
exports.getAllDepartmentBulletins = async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const userDepartmentId = req.user.department_id;

    try {
        let query = `
            SELECT db.*, d.name as department_name, u.name as created_by_name
            FROM "department_bulletins" db
            JOIN "departments" d ON db.department_id = d.id
            JOIN "users" u ON db.created_by_user_id = u.id
        `;
        const queryParams = [];

        // Filter by department for non-admins
        if (userRole === 'department_head' || userRole === 'teacher') {
            if (!userDepartmentId) {
                return res.status(403).json({ message: "المستخدم غير مرتبط بقسم." });
            }
            query += ` WHERE db.department_id = $1`;
            queryParams.push(userDepartmentId);
            // Teachers only see published bulletins
            if (userRole === 'teacher') {
                query += ` AND db.status = 'published'`;
            }
        } else if (!checkUserRole(['system_admin', 'assistant_manager', 'admin_supervisor'])) {
             // Should not happen if roleMiddleware is used, but as a safeguard
             return res.status(403).json({ message: "غير مصرح لك بعرض النشرات." });
        }

        // Add status filter from query string if present
        if (req.query.status) {
            query += (queryParams.length > 0 ? ' AND' : ' WHERE') + ` db.status = $${queryParams.length + 1}`;
            queryParams.push(req.query.status);
        }

        query += ` ORDER BY db.created_at DESC`;

        const bulletins = await pool.query(query, queryParams);
        res.json(bulletins.rows);
    } catch (error) {
        console.error("Error getting department bulletins:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء جلب النشرات", error: error.message });
    }
};

// Get a single department bulletin by ID
exports.getDepartmentBulletinById = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userDepartmentId = req.user.department_id;

    try {
        const bulletinResult = await pool.query(
            `SELECT db.*, d.name as department_name, u.name as created_by_name
             FROM "department_bulletins" db
             JOIN "departments" d ON db.department_id = d.id
             JOIN "users" u ON db.created_by_user_id = u.id
             WHERE db.id = $1`, [id]
        );

        if (bulletinResult.rows.length === 0) {
            return res.status(404).json({ message: "النشرة غير موجودة." });
        }

        const bulletin = bulletinResult.rows[0];

        // Check permissions
        const isAdmin = checkUserRole(['system_admin', 'assistant_manager', 'admin_supervisor']);
        const isInDepartment = await isUserInDepartment(userId, bulletin.department_id);

        if (!isAdmin && !isInDepartment) {
            return res.status(403).json({ message: "غير مصرح لك بعرض هذه النشرة." });
        }
        // Teachers can only view published bulletins
        if (userRole === 'teacher' && bulletin.status !== 'published' && !isAdmin) {
             return res.status(403).json({ message: "غير مصرح لك بعرض هذه النشرة." });
        }

        res.json(bulletin);
    } catch (error) {
        console.error("Error getting department bulletin by ID:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء جلب النشرة", error: error.message });
    }
};

// Update a department bulletin
exports.updateDepartmentBulletin = async (req, res) => {
    const { id } = req.params;
    const { title, content, status, attachment_path } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // First, get the bulletin to check ownership/permissions
        const bulletinResult = await pool.query('SELECT * FROM "department_bulletins" WHERE id = $1', [id]);
        if (bulletinResult.rows.length === 0) {
            return res.status(404).json({ message: "النشرة غير موجودة." });
        }
        const bulletin = bulletinResult.rows[0];

        // Check permissions: Only creator (if dept head) or higher admins can update
        const isCreatorHead = bulletin.created_by_user_id === userId && userRole === 'department_head';
        const isAdmin = checkUserRole(['system_admin', 'assistant_manager']); // Define who can edit others' bulletins

        if (!isCreatorHead && !isAdmin) {
            return res.status(403).json({ message: "غير مصرح لك بتعديل هذه النشرة." });
        }

        // Determine if publishing
        const wasPublished = bulletin.status === 'published';
        const isPublishing = status === 'published' && !wasPublished;
        const publishedAt = isPublishing ? new Date() : bulletin.published_at;
        const approvedById = isPublishing ? userId : bulletin.approved_by_user_id;

        const updatedBulletin = await pool.query(
            `UPDATE "department_bulletins"
             SET title = $1, content = $2, status = $3, attachment_path = $4, published_at = $5, approved_by_user_id = $6
             WHERE id = $7 RETURNING *`,
            [title || bulletin.title, content || bulletin.content, status || bulletin.status, attachment_path, publishedAt, approvedById, id]
        );

        res.json(updatedBulletin.rows[0]);
    } catch (error) {
        console.error("Error updating department bulletin:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء تحديث النشرة", error: error.message });
    }
};

// Delete a department bulletin
exports.deleteDepartmentBulletin = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // First, get the bulletin to check ownership/permissions
        const bulletinResult = await pool.query('SELECT * FROM "department_bulletins" WHERE id = $1', [id]);
        if (bulletinResult.rows.length === 0) {
            // Already deleted or never existed, treat as success
            return res.status(204).send();
        }
        const bulletin = bulletinResult.rows[0];

        // Check permissions: Only creator (if dept head) or higher admins can delete
        const isCreatorHead = bulletin.created_by_user_id === userId && userRole === 'department_head';
        const isAdmin = checkUserRole(['system_admin', 'assistant_manager']);

        if (!isCreatorHead && !isAdmin) {
            return res.status(403).json({ message: "غير مصرح لك بحذف هذه النشرة." });
        }

        // Need to delete acknowledgements first due to foreign key constraint
        await pool.query('DELETE FROM "bulletin_acknowledgements" WHERE bulletin_id = $1', [id]);

        // Now delete the bulletin
        await pool.query('DELETE FROM "department_bulletins" WHERE id = $1', [id]);

        res.status(204).send(); // No content on successful deletion
    } catch (error) {
        console.error("Error deleting department bulletin:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء حذف النشرة", error: error.message });
    }
};

// Acknowledge a department bulletin
exports.acknowledgeBulletin = async (req, res) => {
    const { id } = req.params; // Bulletin ID
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only teachers can acknowledge
    if (userRole !== 'teacher') {
        return res.status(403).json({ message: "فقط المعلمون يمكنهم تأكيد قراءة النشرات." });
    }

    try {
        // Check if bulletin exists and is published
        const bulletinResult = await pool.query('SELECT department_id, status FROM "department_bulletins" WHERE id = $1', [id]);
        if (bulletinResult.rows.length === 0) {
            return res.status(404).json({ message: "النشرة غير موجودة." });
        }
        const bulletin = bulletinResult.rows[0];

        if (bulletin.status !== 'published') {
            return res.status(400).json({ message: "لا يمكن تأكيد قراءة نشرة غير منشورة." });
        }

        // Check if user belongs to the bulletin's department
        if (!await isUserInDepartment(userId, bulletin.department_id)) {
             return res.status(403).json({ message: "لا يمكنك تأكيد قراءة نشرة لقسم آخر." });
        }

        // Check if already acknowledged
        const ackResult = await pool.query('SELECT id FROM "bulletin_acknowledgements" WHERE bulletin_id = $1 AND user_id = $2', [id, userId]);
        if (ackResult.rows.length > 0) {
            return res.status(400).json({ message: "لقد قمت بتأكيد قراءة هذه النشرة بالفعل." });
        }

        // Insert acknowledgement
        await pool.query(
            'INSERT INTO "bulletin_acknowledgements" (bulletin_id, user_id) VALUES ($1, $2)',
            [id, userId]
        );

        res.status(201).json({ message: "تم تأكيد قراءة النشرة بنجاح." });
    } catch (error) {
        console.error("Error acknowledging bulletin:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء تأكيد القراءة", error: error.message });
    }
};

// Get acknowledgements for a bulletin
exports.getBulletinAcknowledgements = async (req, res) => {
    const { id } = req.params; // Bulletin ID
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // Check if bulletin exists
        const bulletinResult = await pool.query('SELECT department_id FROM "department_bulletins" WHERE id = $1', [id]);
        if (bulletinResult.rows.length === 0) {
            return res.status(404).json({ message: "النشرة غير موجودة." });
        }
        const bulletin = bulletinResult.rows[0];

        // Check permissions: Only head of dept or higher admins can view acknowledgements
        const isHead = await isHeadOfDepartment(userId, bulletin.department_id);
        const isAdmin = checkUserRole(['system_admin', 'assistant_manager', 'admin_supervisor']);

        if (!isHead && !isAdmin) {
            return res.status(403).json({ message: "غير مصرح لك بعرض تأكيدات القراءة." });
        }

        // Get acknowledgements with user names
        const acknowledgements = await pool.query(
            `SELECT ba.acknowledged_at, u.id as user_id, u.name as user_name
             FROM "bulletin_acknowledgements" ba
             JOIN "users" u ON ba.user_id = u.id
             WHERE ba.bulletin_id = $1
             ORDER BY ba.acknowledged_at DESC`,
            [id]
        );

        res.json(acknowledgements.rows);
    } catch (error) {
        console.error("Error getting bulletin acknowledgements:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء جلب تأكيدات القراءة", error: error.message });
    }
};

// Helper function (assuming it's available or defined elsewhere)
function checkUserRole(allowedRoles) {
    // This function needs access to the current user's role from the request object (req.user.role)
    // Since this controller doesn't directly have `req`, we'll assume it's passed or available globally,
    // or ideally, this check happens in the middleware before calling the controller.
    // For simplicity here, let's assume it's available via a hypothetical context or passed argument.
    // In a real scenario, use middleware.
    // Example placeholder:
    // return allowedRoles.includes(req.user.role);
    return true; // Placeholder - REMOVE THIS IN ACTUAL IMPLEMENTATION and use middleware
}

