// إعداد توجيه الصفحات للتطبيق
import { createRouter, createWebHistory } from 'vue-router'

// استيراد الصفحات
const Login = () => import('./pages/Login.vue')
const Register = () => import('./pages/Register.vue')
const ForgotPassword = () => import('./pages/ForgotPassword.vue')
const Dashboard = () => import('./pages/Dashboard.vue')
const UserManagement = () => import('./pages/UserManagement.vue')
const ClassManagement = () => import('./pages/ClassManagement.vue')
const StudentManagement = () => import('./pages/StudentManagement.vue')
const Attendance = () => import('./pages/Attendance.vue')
const BehaviorReports = () => import('./pages/BehaviorReports.vue')
const AdministrativeActions = () => import('./pages/AdministrativeActions.vue')
const ExitPermissions = () => import('./pages/ExitPermissions.vue')
const Reports = () => import('./pages/Reports.vue')
const Settings = () => import('./pages/Settings.vue')
const ParentDashboard = () => import('./pages/ParentDashboard.vue')
const NotFound = () => import('./pages/NotFound.vue')

// تعريف المسارات
const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { requiresAuth: false }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: ForgotPassword,
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/users',
    name: 'UserManagement',
    component: UserManagement,
    meta: { requiresAuth: true, roles: ['admin'] }
  },
  {
    path: '/classes',
    name: 'ClassManagement',
    component: ClassManagement,
    meta: { requiresAuth: true, roles: ['admin', 'administrative_supervisor', 'assistant_manager'] }
  },
  {
    path: '/students',
    name: 'StudentManagement',
    component: StudentManagement,
    meta: { requiresAuth: true, roles: ['admin', 'administrative_supervisor', 'assistant_manager', 'department_head'] }
  },
  {
    path: '/attendance',
    name: 'Attendance',
    component: Attendance,
    meta: { requiresAuth: true, roles: ['admin', 'administrative_supervisor', 'teacher'] }
  },
  {
    path: '/behavior-reports',
    name: 'BehaviorReports',
    component: BehaviorReports,
    meta: { requiresAuth: true, roles: ['admin', 'administrative_supervisor', 'assistant_manager', 'teacher'] }
  },
  {
    path: '/administrative-actions',
    name: 'AdministrativeActions',
    component: AdministrativeActions,
    meta: { requiresAuth: true, roles: ['admin', 'administrative_supervisor', 'assistant_manager'] }
  },
  {
    path: '/exit-permissions',
    name: 'ExitPermissions',
    component: ExitPermissions,
    meta: { requiresAuth: true, roles: ['admin', 'administrative_supervisor'] }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: Reports,
    meta: { requiresAuth: true, roles: ['admin', 'administrative_supervisor', 'assistant_manager', 'department_head'] }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: { requiresAuth: true, roles: ['admin'] }
  },
  {
    path: '/parent-dashboard',
    name: 'ParentDashboard',
    component: ParentDashboard,
    meta: { requiresAuth: true, roles: ['parent'] }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound
  }
]

// إنشاء الموجه
const router = createRouter({
  history: createWebHistory(),
  routes
})

// حارس التوجيه للتحقق من المصادقة والأدوار
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  
  if (requiresAuth && !token) {
    next('/login')
  } else if (to.meta.roles && !to.meta.roles.includes(user.role)) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
