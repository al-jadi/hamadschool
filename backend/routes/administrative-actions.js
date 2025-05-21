// وحدة الإجراءات الإدارية
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role-check');

// الحصول على جميع الإجراءات الإدارية
router.get('/', auth, async (req, res) => {
  try {
    const [actions] = await pool.query(`
      SELECT aa.id, aa.student_id, s.full_name as student_name, c.name as class_name,
             aat.name as action_type, aa.start_date, aa.end_date, aa.status,
             aa.created_at, u.full_name as created_by_name
      FROM administrative_actions aa
      JOIN students s ON aa.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN administrative_action_types aat ON aa.action_type_id = aat.id
      JOIN users u ON aa.created_by = u.id
      ORDER BY aa.created_at DESC
    `);
    
    res.json(actions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// الحصول على إجراء إداري محدد
router.get('/:id', auth, async (req, res) => {
  try {
    const [actions] = await pool.query(`
      SELECT aa.id, aa.student_id, s.full_name as student_name, s.student_number,
             c.id as class_id, c.name as class_name,
             aa.action_type_id, aat.name as action_type,
             aa.behavior_report_id, aa.description, aa.start_date, aa.end_date,
             aa.parent_notified, aa.parent_name, aa.parent_phone,
             aa.status, aa.notes, aa.created_at, aa.updated_at,
             u.id as created_by_id, u.full_name as created_by_name
      FROM administrative_actions aa
      JOIN students s ON aa.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN administrative_action_types aat ON aa.action_type_id = aat.id
      JOIN users u ON aa.created_by = u.id
      WHERE aa.id = ?
    `, [req.params.id]);
    
    if (actions.length === 0) {
      return res.status(404).json({ message: 'الإجراء الإداري غير موجود' });
    }
    
    // الحصول على تعهد الطالب إذا كان موجوداً
    const [pledges] = await pool.query(`
      SELECT id, violation, pledge_text, consequences, parent_present, parent_name, notes
      FROM student_pledges
      WHERE administrative_action_id = ?
    `, [req.params.id]);
    
    const action = actions[0];
    if (pledges.length > 0) {
      action.pledge = pledges[0];
    }
    
    res.json(action);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// إنشاء إجراء إداري جديد
router.post('/', auth, roleCheck(['admin', 'administrative_supervisor', 'assistant_manager']), [
  body('student_id').isNumeric().withMessage('معرف الطالب يجب أن يكون رقماً'),
  body('action_type_id').isNumeric().withMessage('معرف نوع الإجراء يجب أن يكون رقماً'),
  body('description').notEmpty().withMessage('وصف الإجراء مطلوب'),
  body('start_date').isDate().withMessage('تاريخ البداية يجب أن يكون بتنسيق صحيح (YYYY-MM-DD)')
], async (req, res) => {
  // التحقق من صحة المدخلات
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    student_id, action_type_id, behavior_report_id, description,
    start_date, end_date, parent_notified, parent_name, parent_phone,
    status, notes
  } = req.body;

  try {
    // التحقق من وجود الطالب
    const [students] = await pool.query('SELECT * FROM students WHERE id = ?', [student_id]);
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'الطالب غير موجود' });
    }
    
    // التحقق من وجود نوع الإجراء
    const [actionTypes] = await pool.query('SELECT * FROM administrative_action_types WHERE id = ?', [action_type_id]);
    
    if (actionTypes.length === 0) {
      return res.status(404).json({ message: 'نوع الإجراء غير موجود' });
    }
    
    // التحقق من وجود تقرير السلوك إذا تم تحديده
    if (behavior_report_id) {
      const [reports] = await pool.query('SELECT * FROM behavior_reports WHERE id = ?', [behavior_report_id]);
      
      if (reports.length === 0) {
        return res.status(404).json({ message: 'تقرير السلوك غير موجود' });
      }
    }
    
    // إنشاء الإجراء الإداري
    const [result] = await pool.query(
      `INSERT INTO administrative_actions (
        student_id, action_type_id, behavior_report_id, description,
        start_date, end_date, parent_notified, parent_name, parent_phone,
        status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id, action_type_id, behavior_report_id || null, description,
        start_date, end_date || null, parent_notified || false, parent_name || null, parent_phone || null,
        status || 'pending', notes || null, req.user.id
      ]
    );
    
    res.status(201).json({
      message: 'تم إنشاء الإجراء الإداري بنجاح',
      action_id: result.insertId
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// تحديث حالة إجراء إداري
router.put('/:id/status', auth, roleCheck(['admin', 'administrative_supervisor', 'assistant_manager']), [
  body('status').isIn(['pending', 'active', 'completed', 'cancelled']).withMessage('الحالة يجب أن تكون إحدى القيم: معلق، نشط، مكتمل، ملغي')
], async (req, res) => {
  // التحقق من صحة المدخلات
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status, notes } = req.body;

  try {
    // التحقق من وجود الإجراء
    const [actions] = await pool.query('SELECT * FROM administrative_actions WHERE id = ?', [req.params.id]);
    
    if (actions.length === 0) {
      return res.status(404).json({ message: 'الإجراء الإداري غير موجود' });
    }
    
    // تحديث حالة الإجراء
    await pool.query(
      'UPDATE administrative_actions SET status = ?, notes = CONCAT(IFNULL(notes, ""), ?) WHERE id = ?',
      [status, notes ? `\n${new Date().toISOString().split('T')[0]} - ${notes}` : '', req.params.id]
    );
    
    res.json({ message: 'تم تحديث حالة الإجراء الإداري بنجاح' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// إنشاء تعهد طالب
router.post('/:id/pledge', auth, roleCheck(['admin', 'administrative_supervisor', 'assistant_manager']), [
  body('violation').notEmpty().withMessage('المخالفة مطلوبة'),
  body('pledge_text').notEmpty().withMessage('نص التعهد مطلوب'),
  body('consequences').notEmpty().withMessage('العواقب المترتبة على مخالفة التعهد مطلوبة')
], async (req, res) => {
  // التحقق من صحة المدخلات
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { violation, pledge_text, consequences, parent_present, parent_name, notes } = req.body;

  try {
    // التحقق من وجود الإجراء
    const [actions] = await pool.query('SELECT * FROM administrative_actions WHERE id = ?', [req.params.id]);
    
    if (actions.length === 0) {
      return res.status(404).json({ message: 'الإجراء الإداري غير موجود' });
    }
    
    // التحقق من نوع الإجراء (يجب أن يكون تعهد طالب)
    const [actionTypes] = await pool.query(`
      SELECT aat.name
      FROM administrative_actions aa
      JOIN administrative_action_types aat ON aa.action_type_id = aat.id
      WHERE aa.id = ?
    `, [req.params.id]);
    
    if (actionTypes[0].name !== 'تعهد طالب') {
      return res.status(400).json({ message: 'لا يمكن إضافة تعهد لهذا النوع من الإجراءات' });
    }
    
    // التحقق من وجود تعهد سابق
    const [existingPledges] = await pool.query('SELECT * FROM student_pledges WHERE administrative_action_id = ?', [req.params.id]);
    
    if (existingPledges.length > 0) {
      return res.status(400).json({ message: 'يوجد تعهد مرتبط بهذا الإجراء بالفعل' });
    }
    
    // إنشاء التعهد
    const [result] = await pool.query(
      'INSERT INTO student_pledges (administrative_action_id, violation, pledge_text, consequences, parent_present, parent_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, violation, pledge_text, consequences, parent_present || false, parent_name || null, notes || null]
    );
    
    // تحديث حالة الإجراء إلى نشط
    await pool.query('UPDATE administrative_actions SET status = ? WHERE id = ?', ['active', req.params.id]);
    
    res.status(201).json({
      message: 'تم إنشاء تعهد الطالب بنجاح',
      pledge_id: result.insertId
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// الحصول على أنواع الإجراءات الإدارية
router.get('/action-types/all', auth, async (req, res) => {
  try {
    const [actionTypes] = await pool.query('SELECT * FROM administrative_action_types ORDER BY id');
    
    res.json(actionTypes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// الحصول على الإجراءات الإدارية لطالب محدد
router.get('/student/:student_id', auth, async (req, res) => {
  try {
    const { student_id } = req.params;
    
    // التحقق من وجود الطالب
    const [students] = await pool.query('SELECT * FROM students WHERE id = ?', [student_id]);
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'الطالب غير موجود' });
    }
    
    const [actions] = await pool.query(`
      SELECT aa.id, aat.name as action_type, aa.description,
             aa.start_date, aa.end_date, aa.status, aa.created_at,
             u.full_name as created_by_name
      FROM administrative_actions aa
      JOIN administrative_action_types aat ON aa.action_type_id = aat.id
      JOIN users u ON aa.created_by = u.id
      WHERE aa.student_id = ?
      ORDER BY aa.created_at DESC
    `, [student_id]);
    
    res.json(actions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

module.exports = router;
