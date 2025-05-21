// وحدة التحقق من الدور
module.exports = function(roles) {
  return function(req, res, next) {
    // التحقق من وجود معلومات المستخدم
    if (!req.user) {
      return res.status(401).json({ message: 'لا يوجد مستخدم مصادق، تم رفض الوصول' });
    }

    // التحقق من وجود الدور المطلوب
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى هذا المورد' });
    }

    next();
  };
};
