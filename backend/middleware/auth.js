// وحدة التحقق من المصادقة
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // الحصول على رمز المصادقة من رأس الطلب
  const token = req.header('x-auth-token');

  // التحقق من وجود الرمز
  if (!token) {
    return res.status(401).json({ message: 'لا يوجد رمز مصادقة، تم رفض الوصول' });
  }

  try {
    // التحقق من صحة الرمز
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // إضافة معلومات المستخدم إلى الطلب
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'الرمز غير صالح' });
  }
};
