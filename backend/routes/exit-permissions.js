// وحدة أذونات الخروج
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role-check');

// الحصول على جميع أذونات الخروج
router.get('/', auth, async (req, res) => {
  try {
    const [permissions] = await pool.query(`
      SELECT ep.id, ep.student_id, s.full_name as student_name, c.name as class_name,
             ep.date, ep.exit_time, ep.expected_return_time, ep.actual_return_time,
             ep.reason, ep.status, ep.created_at,
             u.full_name as created_by_name
      FROM exit_permissions ep
      JOIN students s ON ep.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN users u ON ep.created_by = u.id
      ORDER BY ep.date DESC, ep.exit_time DESC
    `);
    
    res.json(permissions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// الحصول على أذونات الخروج النشطة
router.get('/active', auth, async (req, res) => {
  try {
    const [permissions] = await pool.query(`
      SELECT ep.id, ep.student_id, s.full_name as student_name, c.name as class_name,
             ep.date, ep.exit_time, ep.expected_return_time, ep.actual_return_time,
             ep.reason, ep.status, ep.created_at,
             u.full_name as created_by_name
      FROM exit_permissions ep
      JOIN students s ON ep.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN users u ON ep.created_by = u.id
      WHERE ep.status = 'active'
      ORDER BY ep.date DESC, ep.exit_time DESC
    `);
    
    res.json(permissions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// الحصول على إذن خروج محدد
router.get('/:id', auth, async (req, res) => {
  try {
    const [permissions] = await pool.query(`
      SELECT ep.id, ep.student_id, s.full_name as student_name, s.student_number,
             c.id as class_id, c.name as class_name,
             ep.date, ep.exit_time, ep.expected_return_time, ep.actual_return_time,
             ep.reason, ep.status, ep.notes, ep.created_at, ep.updated_at,
             u.id as created_by_id, u.full_name as created_by_name
      FROM exit_permissions ep
      JOIN students s ON ep.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN users u ON ep.created_by = u.id
      WHERE ep.id = ?
    `, [req.params.id]);
    
    if (permissions.length === 0) {
      return res.status(404).json({ message: 'إذن الخروج غير موجود' });
    }
    
    res.json(permissions[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// إنشاء إذن خروج جديد
router.post('/', auth, roleCheck(['admin', 'administrative_supervisor']), [
  body('student_id').isNumeric().withMessage('معرف الطالب يجب أن يكون رقماً'),
  body('date').isDate().withMessage('التاريخ يجب أن يكون بتنسيق صحيح (YYYY-MM-DD)'),
  body('exit_time').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('وقت الخروج يجب أن يكون بتنسيق صحيح (HH:MM)'),
  body('reason').notEmpty().withMessage('سبب الخروج مطلوب')
], async (req, res) => {
  // التحقق من صحة المدخلات
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { student_id, date, exit_time, expected_return_time, reason, notes } = req.body;

  try {
    // التحقق من وجود الطالب
    const [students] = await pool.query('SELECT * FROM students WHERE id = ?', [student_id]);
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'الطالب غير موجود' });
    }
    
    // التحقق من عدم وجود إذن خروج نشط للطالب في نفس اليوم
    const [activePermissions] = await pool.query(
      'SELECT * FROM exit_permissions WHERE student_id = ? AND date = ? AND status = "active"',
      [student_id, date]
    );
    
    if (activePermissions.length > 0) {
      return res.status(400).json({ message: 'يوجد إذن خروج نشط للطالب في نفس اليوم' });
    }
    
    // إنشاء إذن الخروج
    const [result] = await pool.query(
      'INSERT INTO exit_permissions (student_id, date, exit_time, expected_return_time, reason, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [student_id, date, exit_time, expected_return_time || null, reason, 'active', notes || null, req.user.id]
    );
    
    res.status(201).json({
      message: 'تم إنشاء إذن الخروج بنجاح',
      permission_id: result.insertId
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// تسجيل عودة الطالب
router.put('/:id/return', auth, roleCheck(['admin', 'administrative_supervisor']), [
  body('actual_return_time').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('وقت العودة الفعلي يجب أن يكون بتنسيق صحيح (HH:MM)')
], async (req, res) => {
  // التحقق من صحة المدخلات
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { actual_return_time, notes } = req.body;

  try {
    // التحقق من وجود الإذن
    const [permissions] = await pool.query('SELECT * FROM exit_permissions WHERE id = ?', [req.params.id]);
    
    if (permissions.length === 0) {
      return res.status(404).json({ message: 'إذن الخروج غير موجود' });
    }
    
    // التحقق من حالة الإذن
    if (permissions[0].status !== 'active') {
      return res.status(400).json({ message: 'لا يمكن تسجيل العودة لإذن غير نشط' });
    }
    
    // تحديث الإذن
    await pool.query(
      'UPDATE exit_permissions SET actual_return_time = ?, status = ?, notes = CONCAT(IFNULL(notes, ""), ?) WHERE id = ?',
      [actual_return_time, 'completed', notes ? `\n${notes}` : '', req.params.id]
    );
    
    res.json({ message: 'تم تسجيل عودة الطالب بنجاح' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// إلغاء إذن خروج
router.put('/:id/cancel', auth, roleCheck(['admin', 'administrative_supervisor']), [
  body('reason').notEmpty().withMessage('سبب الإلغاء مطلوب')
], async (req, res) => {
  // التحقق من صحة المدخلات
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { reason } = req.body;

  try {
    // التحقق من وجود الإذن
    const [permissions] = await pool.query('SELECT * FROM exit_permissions WHERE id = ?', [req.params.id]);
    
    if (permissions.length === 0) {
      return res.status(404).json({ message: 'إذن الخروج غير موجود' });
    }
    
    // التحقق من حالة الإذن
    if (permissions[0].status !== 'active') {
      return res.status(400).json({ message: 'لا يمكن إلغاء إذن غير نشط' });
    }
    
    // تحديث الإذن
    await pool.query(
      'UPDATE exit_permissions SET status = ?, notes = CONCAT(IFNULL(notes, ""), ?) WHERE id = ?',
      ['cancelled', `\nسبب الإلغاء: ${reason}`, req.params.id]
    );
    
    res.json({ message: 'تم إلغاء إذن الخروج بنجاح' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// الحصول على أذونات الخروج لطالب محدد
router.get('/student/:student_id', auth, async (req, res) => {
  try {
    const { student_id } = req.params;
    
    // التحقق من وجود الطالب
    const [students] = await pool.query('SELECT * FROM students WHERE id = ?', [student_id]);
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'الطالب غير موجود' });
    }
    
    const [permissions] = await pool.query(`
      SELECT ep.id, ep.date, ep.exit_time, ep.expected_return_time, ep.actual_return_time,
             ep.reason, ep.status, ep.created_at,
             u.full_name as created_by_name
      FROM exit_permissions ep
      JOIN users u ON ep.created_by = u.id
      WHERE ep.student_id = ?
      ORDER BY ep.date DESC, ep.exit_time DESC
    `, [student_id]);
    
    res.json(permissions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// الحصول على أذونات الخروج لصف محدد
router.get('/class/:class_id', auth, async (req, res) => {
  try {
    const { class_id } = req.params;
    const { date } = req.query;
    
    // التحقق من وجود الصف
    const [classes] = await pool.query('SELECT * FROM classes WHERE id = ?', [class_id]);
    
    if (classes.length === 0) {
      return res.status(404).json({ message: 'الصف غير موجود' });
    }
    
    let query = `
      SELECT ep.id, ep.student_id, s.full_name as student_name,
             ep.date, ep.exit_time, ep.expected_return_time, ep.actual_return_time,
             ep.reason, ep.status, ep.created_at,
             u.full_name as created_by_name
      FROM exit_permissions ep
      JOIN students s ON ep.student_id = s.id
      JOIN users u ON ep.created_by = u.id
      WHERE s.class_id = ?
    `;
    
    const queryParams = [class_id];
    
    if (date) {
      query += ' AND ep.date = ?';
      queryParams.push(date);
    }
    
    query += ' ORDER BY ep.date DESC, ep.exit_time DESC';
    
    const [permissions] = await pool.query(query, queryParams);
    
    res.json(permissions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

module.exports = router;
