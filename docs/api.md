# Student Project Showcase Portal — API Documentation

Base URL: `http://localhost:5000`  
All protected endpoints require: `Authorization: Bearer <access_token>`

---

## Authentication

### Password Login
```
POST /api/auth/login
Body: { "email": "student@school.com", "password": "password123" }
Response: { access_token, refresh_token, id_token, token_type, expires_in }
```

### Password Signup
```
POST /api/auth/signup
Body: { "email": "user@example.com", "password": "secret", "role_id": 3 }
Role IDs: 1=admin, 2=recruiter, 3=student
Response: { access_token, refresh_token, id_token, ... }
```

### Magic OTP (Passwordless)
```
POST /api/auth/otp/send
Body: { "email": "user@example.com" }
Response: { "message": "OTP sent (check backend console)" }

POST /api/auth/otp/verify
Body: { "email": "user@example.com", "code": "123456" }
Response: { access_token, refresh_token, id_token, ... }
```

### Google OAuth
```
GET /api/auth/google
→ Redirects to Google consent screen
→ On success, redirects to: http://localhost:5173/auth/callback?access_token=...&refresh_token=...&id_token=...
```

### Token Refresh
```
POST /api/auth/refresh
Body: { "refresh_token": "<token>" }
Response: { access_token, refresh_token, id_token, ... }
Note: Old refresh token is immediately revoked (rotation).
```

### Logout / Revoke
```
POST /api/auth/revoke
Body: { "token": "<refresh_token>" }
Response: { "message": "Token successfully revoked" }
```

### Current User Profile
```
GET /api/auth/me                    [authenticated]
Response: { id, email, name, avatar_url, role, permissions[] }
```

### OIDC Discovery
```
GET /api/auth/.well-known/openid-configuration
GET /api/auth/jwks.json
```

---

## Projects

All project routes require authentication.

### List All Public Projects
```
GET /api/projects                   [projects:read]
Response: [{ id, title, description, thumbnail_url, visibility, created_at,
             author_id, author_name, author_email, author_avatar, like_count }]
```

### Get Single Project
```
GET /api/projects/:id               [projects:read]
Response: { id, title, description, thumbnail_url, ..., like_count }
```

### Create Project
```
POST /api/projects                  [projects:create — student]
Body: { "title": "My Project", "description": "Description here" }
Response: { id, title, description, created_by, created_at, ... }
Side effect: Emits ProjectCreated event → notification created
```

### Update Project
```
PUT /api/projects/:id               [projects:write — must be owner]
Body: { "title": "Updated Title", "description": "Updated desc" }
Response: updated project object
```

### Delete Project
```
DELETE /api/projects/:id            [projects:write — must be owner]
Response: { "message": "Project deleted successfully" }
```

### Upload Thumbnail
```
POST /api/projects/:id/thumbnail    [projects:write — must be owner]
Content-Type: multipart/form-data
Field: thumbnail (image file, max 5MB, jpeg/png/webp/gif)
Response: { message, project: { ..., thumbnail_url: "/uploads/filename.jpg" } }
```

### Like / Unlike Project (Toggle)
```
POST /api/projects/:id/like         [projects:like]
Response: { liked: true|false, like_count: N }
Side effect: On like, emits ProjectLiked event → notification sent to project owner
```

---

## Users

### View User Profile
```
GET /api/users/:id/profile          [authenticated]
Response: { user: { id, name, email, avatar_url, role }, projects[], follower_count }
```

### Follow / Unfollow Student (Toggle)
```
POST /api/users/:id/follow          [users:follow — recruiter]
Response: { following: true|false, message }
Side effect: On follow, emits StudentFollowed event → notification sent to student
```

---

## Notifications

### Get My Notifications
```
GET /api/users/notifications        [authenticated]
Response: [{ id, type, payload, read, created_at, actor_name, actor_email, actor_avatar }]

Notification types:
  project_liked    → payload: { projectId, projectTitle, likerName }
  student_followed → payload: { followerName }
  project_created  → payload: { projectId, projectTitle }
```

### Mark One as Read
```
PATCH /api/users/notifications/:id/read   [authenticated]
Response: notification object with read=true
```

### Mark All as Read
```
PATCH /api/users/notifications/read-all   [authenticated]
Response: { "message": "All notifications marked as read" }
```

---

## Admin

All admin routes require `admin` role or specific permissions.

### System Stats
```
GET /api/admin/stats                [role: admin]
Response: { systemHealth, serverUptime, counts: { users, projects, likes, follows, notifications } }
```

### List All Users
```
GET /api/admin/users                [users:manage]
Response: [{ id, email, name, avatar_url, google_id, role_id, role, created_at }]
```

### Change User Role
```
PUT /api/admin/users/:id/role       [users:manage]
Body: { "role_id": 2 }
Response: { message, user: { id, email, role_id } }
Note: Permission changes take effect on the user's next API request (no token reissue needed).
```

### List All Projects (incl. removed)
```
GET /api/admin/projects             [projects:manage]
Response: [{ ...project, author_name, author_email, like_count }]
```

### Set Project Visibility
```
PATCH /api/admin/projects/:id/visibility   [projects:manage]
Body: { "visibility": "removed" }   or   { "visibility": "public" }
Response: { message, project }
```

### Hard Delete Project
```
DELETE /api/admin/projects/:id      [projects:manage]
Response: { "message": "Project \"Title\" permanently deleted" }
```

---

## Event-Driven Architecture

Events are emitted internally using Node.js `EventEmitter` (no external broker needed).

| Event | Trigger | Notification |
|---|---|---|
| `ProjectCreated` | Student creates a project | Activity log for creator |
| `ProjectLiked` | User likes a project | "John liked your project." → project owner |
| `StudentFollowed` | Recruiter follows a student | "Alex started following you." → student |

All notification rows are written **exclusively** through event handlers in `src/events.js`.

---

## Roles & Permissions

| Role | ID | Permissions |
|---|---|---|
| admin | 1 | All permissions |
| recruiter | 2 | projects:read, projects:like, users:follow |
| student | 3 | projects:read, projects:create, projects:write, projects:like |

## Default Dev Accounts

| Email | Password | Role |
|---|---|---|
| admin@school.com | password123 | admin |
| recruiter@school.com | password123 | recruiter |
| student@school.com | password123 | student |
