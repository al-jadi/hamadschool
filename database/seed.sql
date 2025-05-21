-- Seed data for school_db

-- Insert Test Users with Hashed Passwords
-- Passwords: admin123, assistant123, supervisor123, teacher123, parent123
-- Hashed using bcrypt with cost 10
INSERT INTO users (name, password_hash, email, role_id) VALUES
('System Admin', '$2a$10$a9JAhhW7fAyH47eqrPXnuuEGdcmVNmqy2RPSbxaqZuHjfTwpwHpxW', 'admin@example.com', (SELECT id FROM roles WHERE name = 'system_admin')),
('Assistant Manager', '$2a$10$63MVb7pxIMqQbLK2RO.HxuknmQKT/uQrP6cLcI7lFPzxHC.doqkPu', 'assistant@example.com', (SELECT id FROM roles WHERE name = 'assistant_manager')),
('Admin Supervisor', '$2a$10$m3qZ4kYcvAqtIWk6Sdwxw.VxqfZrJ8euGLtcCEIPf4ZiEROZOWO1K', 'supervisor@example.com', (SELECT id FROM roles WHERE name = 'admin_supervisor')),
('Teacher One', '$2a$10$5Qb2.0Q03aogqApfs2FjsugUzaUGqf3rpTz6ayMAf6pdv4nYgp306', 'teacher@example.com', (SELECT id FROM roles WHERE name = 'teacher')),
('Parent One', '$2a$10$qlhjpIz6zeoGsQ2cMM1rdebN6We4XoZT1Z4uQ70SibxAq0FuMg9LC', 'parent@example.com', (SELECT id FROM roles WHERE name = 'parent'));

-- Insert Test Students
-- Added unique student_id
INSERT INTO students (name, student_id, class_id) VALUES
('Student Alpha', 'S001', (SELECT id FROM classes WHERE name = 'Class 1A')),
('Student Beta', 'S002', (SELECT id FROM classes WHERE name = 'Class 1A')),
('Student Gamma', 'S003', (SELECT id FROM classes WHERE name = 'Class 2B'));

-- Link Parent1 to Student Alpha
-- Using parent_user_id and referencing users by email and students by student_id
INSERT INTO parent_student_link (parent_user_id, student_id) VALUES
((SELECT id FROM users WHERE email = 'parent@example.com'), (SELECT id FROM students WHERE student_id = 'S001'));

-- Optional: Insert some sample attendance, behavior reports etc. if needed for initial testing
-- INSERT INTO attendance (student_id, date, status, period, recorded_by_user_id) VALUES ...
-- INSERT INTO behavior_reports (student_id, report_date, description, reported_by_user_id, status) VALUES ...
