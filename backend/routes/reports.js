// وحدة التقارير
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role-check');

// تقرير إحصائيات النظام
router.get('/system-stats', auth, roleCheck(['admin', 'administrative_supervisor', 'assistant_manager']), async (req, res) => {
  try {
    // إحصائيات المستخدمين
    const [userStats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'admin')) as admin_count,
        (SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'administrative_supervisor')) as supervisor_count,
        (SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'assistant_manager')) as manager_count,
        (SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'department_head')) as department_head_count,
        (SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'teacher')) as teacher_count,
        (SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'parent')) as parent_count,
        (SELECT COUNT(*) FROM users) as total_users
    `);
    
    // إحصائيات الصفوف والطلاب
    const [classStats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM classes WHERE stage_id = 1) as primary_classes,
        (SELECT COUNT(*) FROM classes WHERE stage_id = 2) as middle_classes,
        (SELECT COUNT(*) FROM classes WHERE stage_id = 3) as secondary_classes,
        (SELECT COUNT(*) FROM classes) as total_classes,
        (SELECT COUNT(*) FROM students) as total_students
    `);
    
    // إحصائيات الحضور اليومي للأسبوع الحالي
    const [attendanceStats] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM daily_attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY status
    `);
    
    // إحصائيات تقارير السلوك
    const [behaviorStats] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM behavior_reports
      GROUP BY status
    `);
    
    // إحصائيات الإجراءات الإدارية
    const [actionStats] = await pool.query(`
      SELECT 
        action_type_id,
        (SELECT name FROM administrative_action_types WHERE id = action_type_id) as action_type,
        COUNT(*) as count
      FROM administrative_actions
      GROUP BY action_type_id
    `);
    
    // إحصائيات أذونات الخروج
    const [permissionStats] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM exit_permissions
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY status
    `);
    
    res.json({
      user_stats: userStats[0],
      class_stats: classStats[0],
      attendance_stats: attendanceStats,
      behavior_stats: behaviorStats,
      action_stats: actionStats,
      permission_stats: permissionStats
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// تقرير الحضور والغياب الشهري
router.get('/monthly-attendance', auth, roleCheck(['admin', 'administrative_supervisor', 'assistant_manager', 'department_head']), async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: 'يجب تحديد الشهر والسنة' });
    }
    
    // التحقق من صحة الشهر والسنة
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (monthNum < 1 || monthNum > 12 || isNaN(yearNum)) {
      return res.status(400).json({ message: 'الشهر أو السنة غير صالحين' });
    }
    
    // حساب تاريخ البداية والنهاية للشهر
    const startDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-01`;
    const endDate = monthNum === 12 
      ? `${yearNum + 1}-01-01` 
      : `${yearNum}-${(monthNum + 1).toString().padStart(2, '0')}-01`;
    
    // الحصول على إحصائيات الحضور لكل صف
    const [classAttendance] = await pool.query(`
      SELECT 
        c.id as class_id,
        c.name as class_name,
        es.name as stage_name,
        COUNT(DISTINCT s.id) as total_students,
        SUM(CASE WHEN da.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN da.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN da.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN da.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
        COUNT(da.id) as total_records
      FROM classes c
      JOIN educational_stages es ON c.stage_id = es.id
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN daily_attendance da ON da.student_id = s.id AND da.date >= ? AND da.date < ?
      GROUP BY c.id, c.name, es.name
      ORDER BY es.id, c.name
    `, [startDate, endDate]);
    
    // الحصول على إحصائيات الحضور لكل يوم في الشهر
    const [dailyAttendance] = await pool.query(`
      SELECT 
        da.date,
        COUNT(DISTINCT da.student_id) as total_students,
        SUM(CASE WHEN da.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN da.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN da.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN da.status = 'excused' THEN 1 ELSE 0 END) as excused_count
      FROM daily_attendance da
      WHERE da.date >= ? AND da.date < ?
      GROUP BY da.date
      ORDER BY da.date
    `, [startDate, endDate]);
    
    res.json({
      month: monthNum,
      year: yearNum,
      date_range: { start_date: startDate, end_date: endDate },
      class_attendance: classAttendance,
      daily_attendance: dailyAttendance
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// تقرير تقارير السلوك
router.get('/behavior-reports', auth, roleCheck(['admin', 'administrative_supervisor', 'assistant_manager']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'يجب تحديد تاريخ البداية وتاريخ النهاية' });
    }
    
    // الحصول على إحصائيات تقارير السلوك حسب نوع الحادثة
    const [incidentStats] = await pool.query(`
      SELECT 
        bit.id as incident_type_id,
        bit.name as incident_type,
        bit.severity_level,
        COUNT(br.id) as report_count
      FROM behavior_incident_types bit
      LEFT JOIN behavior_reports br ON br.incident_type_id = bit.id AND br.incident_date >= ? AND br.incident_date <= ?
      GROUP BY bit.id, bit.name, bit.severity_level
      ORDER BY bit.severity_level DESC
    `, [start_date, end_date]);
    
    // الحصول على إحصائيات تقارير السلوك حسب الصف
    const [classStats] = await pool.query(`
      SELECT 
        c.id as class_id,
        c.name as class_name,
        es.name as stage_name,
        COUNT(br.id) as report_count
      FROM classes c
      JOIN educational_stages es ON c.stage_id = es.id
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN behavior_reports br ON br.student_id = s.id AND br.incident_date >= ? AND br.incident_date <= ?
      GROUP BY c.id, c.name, es.name
      ORDER BY es.id, c.name
    `, [start_date, end_date]);
    
    // الحصول على إحصائيات تقارير السلوك حسب الحالة
    const [statusStats] = await pool.query(`
      SELECT 
        status,
        COUNT(id) as count
      FROM behavior_reports
      WHERE incident_date >= ? AND incident_date <= ?
      GROUP BY status
    `, [start_date, end_date]);
    
    // الحصول على الطلاب الأكثر تكراراً في تقارير السلوك
    const [topStudents] = await pool.query(`
      SELECT 
        s.id as student_id,
        s.student_number,
        s.full_name as student_name,
        c.name as class_name,
        COUNT(br.id) as report_count
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN behavior_reports br ON br.student_id = s.id AND br.incident_date >= ? AND br.incident_date <= ?
      GROUP BY s.id, s.student_number, s.full_name, c.name
      ORDER BY report_count DESC
      LIMIT 10
    `, [start_date, end_date]);
    
    res.json({
      date_range: { start_date, end_date },
      incident_stats: incidentStats,
      class_stats: classStats,
      status_stats: statusStats,
      top_students: topStudents
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// تقرير الإجراءات الإدارية
router.get('/administrative-actions', auth, roleCheck(['admin', 'administrative_supervisor', 'assistant_manager']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'يجب تحديد تاريخ البداية وتاريخ النهاية' });
    }
    
    // الحصول على إحصائيات الإجراءات الإدارية حسب النوع
    const [typeStats] = await pool.query(`
      SELECT 
        aat.id as action_type_id,
        aat.name as action_type,
        COUNT(aa.id) as action_count
      FROM administrative_action_types aat
      LEFT JOIN administrative_actions aa ON aa.action_type_id = aat.id AND aa.start_date >= ? AND aa.start_date <= ?
      GROUP BY aat.id, aat.name
      ORDER BY aat.id
    `, [start_date, end_date]);
    
    // الحصول على إحصائيات الإجراءات الإدارية حسب الصف
    const [classStats] = await pool.query(`
      SELECT 
        c.id as class_id,
        c.name as class_name,
        es.name as stage_name,
        COUNT(aa.id) as action_count
      FROM classes c
      JOIN educational_stages es ON c.stage_id = es.id
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN administrative_actions aa ON aa.student_id = s.id AND aa.start_date >= ? AND aa.start_date <= ?
      GROUP BY c.id, c.name, es.name
      ORDER BY es.id, c.name
    `, [start_date, end_date]);
    
    // الحصول على إحصائيات الإجراءات الإدارية حسب الحالة
    const [statusStats] = await pool.query(`
      SELECT 
        status,
        COUNT(id) as count
      FROM administrative_actions
      WHERE start_date >= ? AND start_date <= ?
      GROUP BY status
    `, [start_date, end_date]);
    
    res.json({
      date_range: { start_date, end_date },
      type_stats: typeStats,
      class_stats: classStats,
      status_stats: statusStats
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

// تقرير أذونات الخروج
router.get('/exit-permissions', auth, roleCheck(['admin', 'administrative_supervisor']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'يجب تحديد تاريخ البداية وتاريخ النهاية' });
    }
    
    // الحصول على إحصائيات أذونات الخروج حسب الصف
    const [classStats] = await pool.query(`
      SELECT 
        c.id as class_id,
        c.name as class_name,
        es.name as stage_name,
        COUNT(ep.id) as permission_count
      FROM classes c
      JOIN educational_stages es ON c.stage_id = es.id
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN exit_permissions ep ON ep.student_id = s.id AND ep.date >= ? AND ep.date <= ?
      GROUP BY c.id, c.name, es.name
      ORDER BY es.id, c.name
    `, [start_date, end_date]);
    
    // الحصول على إحصائيات أذونات الخروج حسب الحالة
    const [statusStats] = await pool.query(`
      SELECT 
        status,
        COUNT(id) as count
      FROM exit_permissions
      WHERE date >= ? AND date <= ?
      GROUP BY status
    `, [start_date, end_date]);
    
    // الحصول على إحصائيات أذونات الخروج حسب اليوم
    const [dailyStats] = await pool.query(`
      SELECT 
        date,
        COUNT(id) as permission_count
      FROM exit_permissions
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date
    `, [start_date, end_date]);
    
    res.json({
      date_range: { start_date, end_date },
      class_stats: classStats,
      status_stats: statusStats,
      daily_stats: dailyStats
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في الخادم');
  }
});

module.exports = router;
