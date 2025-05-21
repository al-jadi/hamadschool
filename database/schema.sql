-- PostgreSQL Schema for School Management System

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS "bulletin_acknowledgements" CASCADE;
DROP TABLE IF EXISTS "department_bulletins" CASCADE;
DROP TABLE IF EXISTS "department_files" CASCADE;
DROP TABLE IF EXISTS "schedule_swap_requests" CASCADE;
DROP TABLE IF EXISTS "class_schedule_entries" CASCADE;
DROP TABLE IF EXISTS "subjects" CASCADE;
DROP TABLE IF EXISTS "time_slots" CASCADE;
DROP TABLE IF EXISTS "parent_bulletins" CASCADE;
DROP TABLE IF EXISTS "parent_student_link" CASCADE;
DROP TABLE IF EXISTS "settings" CASCADE;
DROP TABLE IF EXISTS "administrative_actions" CASCADE;
DROP TABLE IF EXISTS "behavior_reports" CASCADE;
DROP TABLE IF EXISTS "attendance" CASCADE;
DROP TABLE IF EXISTS "students" CASCADE;
DROP TABLE IF EXISTS "classes" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "departments" CASCADE;
DROP TABLE IF EXISTS "roles" CASCADE;

-- Roles Table: Defines the different user roles in the system
CREATE TABLE "roles" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) UNIQUE NOT NULL -- e.g., 'system_admin', 'assistant_manager', 'admin_supervisor', 'department_head', 'teacher', 'parent'
);

-- Departments Table: Defines academic departments
-- Note: head_user_id constraint added later via ALTER TABLE after users table is created
CREATE TABLE "departments" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) UNIQUE NOT NULL,
    "head_user_id" INT UNIQUE -- Link to the Department Head user (constraint added later)
);

-- Users Table: Stores user account information
CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role_id" INT NOT NULL REFERENCES "roles"("id"),
    "department_id" INT REFERENCES "departments"("id"), -- Link teachers/heads to departments
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN DEFAULT TRUE
);

-- Add constraint to departments table now that users table exists
ALTER TABLE "departments" ADD CONSTRAINT fk_dept_head FOREIGN KEY ("head_user_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- Classes Table: Stores information about school classes
CREATE TABLE "classes" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL, -- e.g., 'الأول أ', 'الثاني ب'
    "department_id" INT REFERENCES "departments"("id") -- Optional: Link class to a department if applicable
);

-- Students Table: Stores student information
CREATE TABLE "students" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "student_id" VARCHAR(20) UNIQUE NOT NULL, -- Academic number
    "class_id" INT REFERENCES "classes"("id"),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Table: Records student attendance
CREATE TABLE "attendance" (
    "id" SERIAL PRIMARY KEY,
    "student_id" INT NOT NULL REFERENCES "students"("id"),
    "date" DATE NOT NULL,
    "period" INT NOT NULL, -- e.g., 1 to 7
    "status" VARCHAR(10) NOT NULL CHECK ("status" IN ('present', 'absent', 'late')), -- حاضر، غائب، متأخر
    "notes" TEXT,
    "recorded_by_user_id" INT NOT NULL REFERENCES "users"("id"),
    "recorded_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "last_edited_by_user_id" INT REFERENCES "users"("id"),
    "last_edited_at" TIMESTAMPTZ,
    UNIQUE ("student_id", "date", "period") -- Ensure one record per student per period per day
);

-- Behavior Reports Table: Records student behavior incidents
CREATE TABLE "behavior_reports" (
    "id" SERIAL PRIMARY KEY,
    "student_id" INT NOT NULL REFERENCES "students"("id"),
    "report_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "description" TEXT NOT NULL,
    "reported_by_user_id" INT NOT NULL REFERENCES "users"("id"), -- Teacher reporting
    "reported_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "supervisor_comment" TEXT, -- Comment from Admin Supervisor
    "supervisor_user_id" INT REFERENCES "users"("id"),
    "supervisor_comment_at" TIMESTAMPTZ,
    "assistant_manager_approved_for_parent_view" BOOLEAN DEFAULT FALSE,
    "assistant_manager_user_id" INT REFERENCES "users"("id"),
    "assistant_manager_approved_at" TIMESTAMPTZ
);

-- Administrative Actions Table: Records actions taken against students
CREATE TABLE "administrative_actions" (
    "id" SERIAL PRIMARY KEY,
    "student_id" INT NOT NULL REFERENCES "students"("id"),
    "action_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "description" TEXT NOT NULL,
    "taken_by_user_id" INT NOT NULL REFERENCES "users"("id"), -- User who took the action (e.g., Assistant Manager)
    "taken_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "assistant_manager_approved_for_parent_view" BOOLEAN DEFAULT FALSE,
    "assistant_manager_user_id" INT REFERENCES "users"("id"),
    "assistant_manager_approved_at" TIMESTAMPTZ
);

-- Parent-Student Link Table: Links parents to their children
CREATE TABLE "parent_student_link" (
    "id" SERIAL PRIMARY KEY,
    "parent_user_id" INT NOT NULL REFERENCES "users"("id"),
    "student_id" INT NOT NULL REFERENCES "students"("id"),
    UNIQUE ("parent_user_id", "student_id") -- Prevent duplicate links
);

-- Settings Table: Stores system-wide settings (simplified key-value)
CREATE TABLE "settings" (
    "id" SERIAL PRIMARY KEY,
    "setting_key" VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'school_name', 'academic_year', 'allow_teacher_edit'
    "setting_value" TEXT,
    "description" TEXT, -- Optional description of the setting
    "category" VARCHAR(50) -- e.g., 'general', 'school_management', 'security'
);

-- Subjects Table: Defines subjects taught
CREATE TABLE "subjects" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) UNIQUE NOT NULL,
    "department_id" INT REFERENCES "departments"("id") -- Link subject to a department
);

-- Time Slots Table: Defines periods/time slots in a day
CREATE TABLE "time_slots" (
    "id" SERIAL PRIMARY KEY,
    "day_of_week" INT NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
    "period_number" INT NOT NULL, -- e.g., 1, 2, ..., 7
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    UNIQUE ("day_of_week", "period_number")
);

-- Class Schedule Entries Table: Defines the timetable
CREATE TABLE "class_schedule_entries" (
    "id" SERIAL PRIMARY KEY,
    "class_id" INT NOT NULL REFERENCES "classes"("id"),
    "subject_id" INT NOT NULL REFERENCES "subjects"("id"),
    "teacher_user_id" INT NOT NULL REFERENCES "users"("id"),
    "time_slot_id" INT NOT NULL REFERENCES "time_slots"("id"),
    "academic_year" VARCHAR(9) NOT NULL, -- e.g., '2024-2025'
    UNIQUE ("class_id", "time_slot_id", "academic_year") -- One subject per class per time slot per year
);

-- Schedule Swap Requests Table: Tracks requests to swap classes
CREATE TABLE "schedule_swap_requests" (
    "id" SERIAL PRIMARY KEY,
    "requesting_user_id" INT NOT NULL REFERENCES "users"("id"), -- Assistant Manager or Dept Head
    "original_entry_id" INT NOT NULL REFERENCES "class_schedule_entries"("id"),
    "target_entry_id" INT NOT NULL REFERENCES "class_schedule_entries"("id"), -- The entry to swap with
    "request_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "reason" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved_by_head1', 'approved', 'rejected')), -- Approval flow
    "approving_head1_user_id" INT REFERENCES "users"("id"), -- First Dept Head involved (if applicable)
    "approving_head1_at" TIMESTAMPTZ,
    "final_approver_user_id" INT REFERENCES "users"("id"), -- Assistant Manager or second Dept Head
    "final_approved_at" TIMESTAMPTZ,
    "rejection_reason" TEXT
);

-- Department Files Table: Stores metadata for files managed by departments
CREATE TABLE "department_files" (
    "id" SERIAL PRIMARY KEY,
    "department_id" INT NOT NULL REFERENCES "departments"("id"),
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(512) NOT NULL UNIQUE, -- Path on the server where the file is stored
    "description" TEXT,
    "uploaded_by_user_id" INT NOT NULL REFERENCES "users"("id"), -- Dept Head uploading
    "uploaded_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Department Bulletins Table: Internal bulletins for department members
CREATE TABLE "department_bulletins" (
    "id" SERIAL PRIMARY KEY,
    "department_id" INT NOT NULL REFERENCES "departments"("id"),
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "created_by_user_id" INT NOT NULL REFERENCES "users"("id"), -- Dept Head creating
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'pending_approval', 'published', 'archived')),
    "approved_by_user_id" INT REFERENCES "users"("id"), -- Assistant Manager or Dept Head approving
    "published_at" TIMESTAMPTZ,
    "attachment_path" VARCHAR(512) -- Optional path to an attached file
);

-- Bulletin Acknowledgements Table: Tracks teacher acknowledgements
CREATE TABLE "bulletin_acknowledgements" (
    "id" SERIAL PRIMARY KEY,
    "bulletin_id" INT NOT NULL REFERENCES "department_bulletins"("id"),
    "user_id" INT NOT NULL REFERENCES "users"("id"), -- Teacher acknowledging
    "acknowledged_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("bulletin_id", "user_id") -- Ensure one acknowledgement per user per bulletin
);

-- Parent Bulletins Table: General bulletins for parents
CREATE TABLE "parent_bulletins" (
    "id" SERIAL PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL CHECK ("type" IN ('general_announcement', 'class_schedule', 'exam_schedule')), -- Type of bulletin
    "created_by_user_id" INT NOT NULL REFERENCES "users"("id"), -- User creating (e.g., Asst Manager)
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'pending_approval', 'published', 'archived')),
    "approved_by_user_id" INT REFERENCES "users"("id"), -- Asst Manager or higher approving
    "published_at" TIMESTAMPTZ,
    "attachment_path" VARCHAR(512), -- Optional path to an attached file (e.g., schedule PDF)
    "target_class_id" INT REFERENCES "classes"("id") -- Optional: Target specific class for schedules
);

-- Insert initial roles
INSERT INTO "roles" ("name") VALUES
('system_admin'),
('assistant_manager'),
('admin_supervisor'),
('department_head'),
('teacher'),
('parent');

-- Insert initial settings categories (example)
INSERT INTO "settings" ("setting_key", "setting_value", "description", "category") VALUES
('school_name', 'اسم المدرسة الافتراضي', 'اسم المدرسة الرسمي', 'school_management'),
('academic_year', '2024-2025', 'العام الدراسي الحالي', 'school_management'),
('allow_email_notifications', 'true', 'تفعيل إرسال الإشعارات بالبريد', 'general'),
('session_timeout', '3600', 'مدة انتهاء جلسة المستخدم بالثواني', 'security');

-- Note: Further logic for permissions, workflows, file storage, and notifications
-- will be implemented in the backend API code.

