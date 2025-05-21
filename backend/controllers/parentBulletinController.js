// controllers/parentBulletinController.js
const pool = require("../config/db");

// Helper function (assuming it's available or defined elsewhere)
function checkUserRole(allowedRoles, userRole) {
    // In a real scenario, use middleware or get userRole from req.user
    return allowedRoles.includes(userRole);
}

// Create a new parent bulletin
exports.createParentBulletin = async (req, res) => {
    const { title, content, type, status, attachment_path, target_class_id } = req.body;
    const userId = req.user.id; // Assuming authMiddleware populates req.user
    const userRole = req.user.role;

    // Permissions: Only certain roles can create parent bulletins
    if (!checkUserRole(["system_admin", "assistant_manager", "admin_supervisor"], userRole)) {
        return res.status(403).json({ message: "غير مصرح لك بإنشاء نشرات أولياء الأمور." });
    }

    try {
        const newBulletin = await pool.query(
            `INSERT INTO "parent_bulletins" (title, content, type, created_by_user_id, status, attachment_path, target_class_id, published_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [title, content, type, userId, status || 'draft', attachment_path, target_class_id || null, (status === 'published' ? new Date() : null)]
        );
        res.status(201).json(newBulletin.rows[0]);
    } catch (error) {
        console.error("Error creating parent bulletin:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء إنشاء النشرة", error: error.message });
    }
};

// Get all parent bulletins (filtered by role/status)
exports.getAllParentBulletins = async (req, res) => {
    const userRole = req.user.role;
    const userId = req.user.id;

    try {
        let query = `
            SELECT pb.*, u.name as created_by_name, c.name as target_class_name
            FROM "parent_bulletins" pb
            JOIN "users" u ON pb.created_by_user_id = u.id
            LEFT JOIN "classes" c ON pb.target_class_id = c.id
        `;
        const queryParams = [];

        // Parents only see published bulletins, potentially filtered by their child's class
        if (userRole === 'parent') {
            query += ` WHERE pb.status = 'published'`;
            // Optional: Further filter by parent's children's classes if needed
            // This requires joining parent_student_link and students tables
            // Example (needs refinement):
            // query += ` AND (pb.target_class_id IS NULL OR pb.target_class_id IN (
            //     SELECT s.class_id FROM students s JOIN parent_student_link psl ON s.id = psl.student_id WHERE psl.parent_user_id = $1
            // ))`;
            // queryParams.push(userId);
        } else if (!checkUserRole(["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher"], userRole)) {
            // Other roles might not have permission to view all
            return res.status(403).json({ message: "غير مصرح لك بعرض نشرات أولياء الأمور." });
        }

        // Add status filter from query string if present (for admins)
        if (req.query.status && checkUserRole(["system_admin", "assistant_manager", "admin_supervisor"], userRole)) {
            query += (queryParams.length > 0 || query.includes('WHERE') ? ' AND' : ' WHERE') + ` pb.status = $${queryParams.length + 1}`;
            queryParams.push(req.query.status);
        }
        // Add type filter
        if (req.query.type) {
             query += (queryParams.length > 0 || query.includes('WHERE') ? ' AND' : ' WHERE') + ` pb.type = $${queryParams.length + 1}`;
             queryParams.push(req.query.type);
        }
        // Add class filter
        if (req.query.classId) {
             query += (queryParams.length > 0 || query.includes('WHERE') ? ' AND' : ' WHERE') + ` pb.target_class_id = $${queryParams.length + 1}`;
             queryParams.push(req.query.classId);
        }

        query += ` ORDER BY pb.created_at DESC`;

        const bulletins = await pool.query(query, queryParams);
        res.json(bulletins.rows);
    } catch (error) {
        console.error("Error getting parent bulletins:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء جلب النشرات", error: error.message });
    }
};

// Get a single parent bulletin by ID
exports.getParentBulletinById = async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    try {
        const bulletinResult = await pool.query(
            `SELECT pb.*, u.name as created_by_name, c.name as target_class_name
             FROM "parent_bulletins" pb
             JOIN "users" u ON pb.created_by_user_id = u.id
             LEFT JOIN "classes" c ON pb.target_class_id = c.id
             WHERE pb.id = $1`, [id]
        );

        if (bulletinResult.rows.length === 0) {
            return res.status(404).json({ message: "النشرة غير موجودة." });
        }

        const bulletin = bulletinResult.rows[0];

        // Permissions: Parents only see published
        if (userRole === 'parent' && bulletin.status !== 'published') {
            // Optional: Check if parent is linked to the target class if applicable
            return res.status(403).json({ message: "غير مصرح لك بعرض هذه النشرة." });
        } else if (!checkUserRole(["system_admin", "assistant_manager", "admin_supervisor", "department_head", "teacher"], userRole)) {
             return res.status(403).json({ message: "غير مصرح لك بعرض هذه النشرة." });
        }

        res.json(bulletin);
    } catch (error) {
        console.error("Error getting parent bulletin by ID:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء جلب النشرة", error: error.message });
    }
};

// Update a parent bulletin
exports.updateParentBulletin = async (req, res) => {
    const { id } = req.params;
    const { title, content, type, status, attachment_path, target_class_id } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Permissions: Only certain roles can update
    if (!checkUserRole(["system_admin", "assistant_manager", "admin_supervisor"], userRole)) {
        return res.status(403).json({ message: "غير مصرح لك بتعديل نشرات أولياء الأمور." });
    }

    try {
        const bulletinResult = await pool.query('SELECT * FROM "parent_bulletins" WHERE id = $1', [id]);
        if (bulletinResult.rows.length === 0) {
            return res.status(404).json({ message: "النشرة غير موجودة." });
        }
        const bulletin = bulletinResult.rows[0];

        // Determine if publishing
        const wasPublished = bulletin.status === 'published';
        const isPublishing = status === 'published' && !wasPublished;
        const publishedAt = isPublishing ? new Date() : bulletin.published_at;
        const approvedById = isPublishing ? userId : bulletin.approved_by_user_id;

        const updatedBulletin = await pool.query(
            `UPDATE "parent_bulletins"
             SET title = $1, content = $2, type = $3, status = $4, attachment_path = $5, target_class_id = $6, published_at = $7, approved_by_user_id = $8
             WHERE id = $9 RETURNING *`,
            [
                title || bulletin.title,
                content || bulletin.content,
                type || bulletin.type,
                status || bulletin.status,
                attachment_path, // Allows setting to null
                target_class_id, // Allows setting to null
                publishedAt,
                approvedById,
                id
            ]
        );

        res.json(updatedBulletin.rows[0]);
    } catch (error) {
        console.error("Error updating parent bulletin:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء تحديث النشرة", error: error.message });
    }
};

// Delete a parent bulletin
exports.deleteParentBulletin = async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;

    // Permissions: Only certain roles can delete
    if (!checkUserRole(["system_admin", "assistant_manager", "admin_supervisor"], userRole)) {
        return res.status(403).json({ message: "غير مصرح لك بحذف نشرات أولياء الأمور." });
    }

    try {
        const deleteResult = await pool.query('DELETE FROM "parent_bulletins" WHERE id = $1 RETURNING id', [id]);

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: "النشرة غير موجودة." });
        }

        res.status(204).send(); // No content on successful deletion
    } catch (error) {
        console.error("Error deleting parent bulletin:", error);
        res.status(500).json({ message: "خطأ في الخادم أثناء حذف النشرة", error: error.message });
    }
};

