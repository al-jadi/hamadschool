const pool = require('../config/db'); // Assuming db config is here

exports.checkDepartmentUpdatePermission = async (req, res, next) => {
    const departmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins and Assistant Managers can update any department
    if (userRole === 'system_admin' || userRole === 'assistant_manager') {
        return next();
    }

    // Department Heads can only update their own department
    if (userRole === 'department_head') {
        try {
            const { rows } = await pool.query(
                'SELECT head_id FROM departments WHERE id = $1',
                [departmentId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ msg: 'Department not found' });
            }

            const departmentHeadId = rows[0].head_id;

            if (departmentHeadId === userId) {
                // User is the head of this department
                return next();
            } else {
                // User is a department head, but not for this department
                console.log(`Forbidden: Department Head ${userId} attempted to update department ${departmentId} (Head is ${departmentHeadId})`);
                return res.status(403).json({ msg: 'Forbidden: You can only update your own department' });
            }
        } catch (err) {
            console.error('Error checking department ownership:', err.message);
            return res.status(500).send('Server error during permission check');
        }
    }

    // Other roles are forbidden
    console.log(`Forbidden: User role '${userRole}' attempted to update department ${departmentId}`);
    return res.status(403).json({ msg: 'Forbidden: You do not have permission to update this department' });
};

