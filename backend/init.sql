-- Drop all tables in reverse dependency order (clean slate)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS student_follows CASCADE;
DROP TABLE IF EXISTS project_likes CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS otps CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE roles (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE permissions (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- ============================================================
-- ROLE PERMISSIONS (many-to-many)
-- ============================================================
CREATE TABLE role_permissions (
    role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id           SERIAL PRIMARY KEY,
    email        VARCHAR(255) UNIQUE NOT NULL,
    name         VARCHAR(255)        DEFAULT NULL,
    avatar_url   VARCHAR(500)        DEFAULT NULL,
    google_id    VARCHAR(100) UNIQUE DEFAULT NULL,  -- NULL for password/OTP-only accounts
    password_hash VARCHAR(255)       DEFAULT NULL,  -- NULL for Google-only accounts
    role_id      INT REFERENCES roles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OTPs  (passwordless magic links)
-- ============================================================
CREATE TABLE otps (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    code       VARCHAR(6)   NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used       BOOLEAN      DEFAULT FALSE,
    created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- REFRESH TOKENS  (supports DB-backed revocation)
-- ============================================================
CREATE TABLE refresh_tokens (
    id         SERIAL PRIMARY KEY,
    token      VARCHAR(500) UNIQUE NOT NULL,
    user_id    INT REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    description   TEXT         NOT NULL,
    thumbnail_url VARCHAR(500) DEFAULT NULL,
    visibility    VARCHAR(20)  DEFAULT 'private'  -- 'public' | 'private' | 'removed'
                               CHECK (visibility IN ('public', 'private', 'removed')),
    created_by    INT REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECT LIKES  (toggle; UNIQUE prevents double-likes)
-- ============================================================
CREATE TABLE project_likes (
    id         SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    liked_by   INT REFERENCES users(id)    ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, liked_by)
);

-- ============================================================
-- STUDENT FOLLOWS  (toggle; UNIQUE prevents double-follows)
-- ============================================================
CREATE TABLE student_follows (
    id          SERIAL PRIMARY KEY,
    follower_id INT REFERENCES users(id) ON DELETE CASCADE,
    student_id  INT REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (follower_id, student_id)
);

-- ============================================================
-- NOTIFICATIONS  (event-driven; only inserted via EventEmitter handlers)
-- ============================================================
CREATE TABLE notifications (
    id           SERIAL PRIMARY KEY,
    recipient_id INT REFERENCES users(id) ON DELETE CASCADE,
    type         VARCHAR(50) NOT NULL,   -- 'project_liked' | 'student_followed' | 'project_created'
    actor_id     INT REFERENCES users(id) ON DELETE SET NULL,
    payload      JSONB        DEFAULT '{}',
    read         BOOLEAN      DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES (Performance Optimization)
-- ============================================================
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_project_likes_project_id ON project_likes(project_id);
CREATE INDEX idx_project_likes_liked_by ON project_likes(liked_by);
CREATE INDEX idx_student_follows_student_id ON student_follows(student_id);
CREATE INDEX idx_student_follows_follower_id ON student_follows(follower_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);

-- ============================================================
-- SEED: Roles
-- ============================================================
INSERT INTO roles (id, name) VALUES
    (1, 'admin'),
    (2, 'recruiter'),
    (3, 'student')
ON CONFLICT DO NOTHING;
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- ============================================================
-- SEED: Permissions
-- ============================================================
INSERT INTO permissions (id, name) VALUES
    (1, 'projects:read'),
    (2, 'projects:create'),
    (3, 'projects:write'),
    (4, 'projects:like'),
    (5, 'users:follow'),
    (6, 'users:manage'),
    (7, 'projects:manage')
ON CONFLICT DO NOTHING;
SELECT setval('permissions_id_seq', (SELECT MAX(id) FROM permissions));

-- ============================================================
-- SEED: Role → Permission mappings
-- ============================================================

-- Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
    (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7)
ON CONFLICT DO NOTHING;

-- Recruiter: browse, like, follow
INSERT INTO role_permissions (role_id, permission_id) VALUES
    (2,1),(2,4),(2,5)
ON CONFLICT DO NOTHING;

-- Student: browse, create, edit/delete own, like
INSERT INTO role_permissions (role_id, permission_id) VALUES
    (3,1),(3,2),(3,3),(3,4)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: Default dev accounts  (password = "password123")
-- PBKDF2 salt:hash
-- ============================================================
INSERT INTO users (email, name, password_hash, role_id) VALUES
    ('admin@school.com',     'Admin User',     '4ee5a882a176cb403986adbc3296c050:f65fd9978052b74a349456f507d7f134b87b8cf6c83953fd4a1d585c0503a73925b50bde3f32036e2324c770644546aa197e8f34b52374af99b8730212033939', 1),
    ('recruiter@school.com', 'Demo Recruiter', '4ee5a882a176cb403986adbc3296c050:f65fd9978052b74a349456f507d7f134b87b8cf6c83953fd4a1d585c0503a73925b50bde3f32036e2324c770644546aa197e8f34b52374af99b8730212033939', 2),
    ('student@school.com',   'Demo Student',   '4ee5a882a176cb403986adbc3296c050:f65fd9978052b74a349456f507d7f134b87b8cf6c83953fd4a1d585c0503a73925b50bde3f32036e2324c770644546aa197e8f34b52374af99b8730212033939', 3)
ON CONFLICT (email) DO NOTHING;
