# Requirements Gathering Document
## Student Project Showcase Portal
**Faculty of Computing — Web Application Development Assignment**

---

## 1. Project Overview

### 1.1 Background
The Faculty of Computing requires a robust, secure, and interactive web application that enables students to publicly showcase their academic and personal projects. The platform serves as a critical bridge between student talent and industry recruitment, allowing recruiters to discover, engage with, and follow student developers in an intuitive environment. This platform aims to modernize how student work is presented and evaluated by external parties.

### 1.2 Problem Statement
Currently, the Faculty lacks a centralized, standardized platform for students to present their project work to potential employers and industry partners. Recruiters have no structured, accessible way to discover emerging student talent or express measurable interest in specific projects. Administrators lack the necessary tools to moderate content and maintain the quality of the showcase. Furthermore, students miss out on valuable feedback and networking opportunities because there is no mechanism for them to know when industry professionals are interested in their work.

### 1.3 Objectives
- Provide students with a secure, self-managed portfolio space to publish and update project showcases.
- Allow verified recruiters to seamlessly browse, like, and follow student developers to build talent pipelines.
- Notify students of recruiter engagement in real-time via an event-driven notification architecture.
- Give administrators comprehensive visibility and control over all platform content, users, and system health.
- Deliver a modern, responsive, and performant user experience that reflects the technical standards of the Faculty, using a **calm, Maroon-based color palette**.

---

## 2. Stakeholders & Personas

| Stakeholder Persona | Role Description | Key Needs & Motivations |
|---|---|---|
| **Sarah (Student)** | Content Creator | Needs an easy way to upload project details and images. Motivated by building a strong portfolio to secure internships or job offers. Needs to know when her work is noticed. |
| **Raj (Recruiter)** | Content Consumer | Looking for top talent for his company. Needs to quickly browse projects, bookmark favorites (via 'likes'), and track promising students (via 'follows'). |
| **Dr. Smith (Admin)** | Platform Moderator | Responsible for the reputation of the Faculty. Needs tools to oversee all activity, manage user roles, and quickly remove inappropriate or low-quality projects. |

---

## 3. Use Case Analysis

### 3.1 Global Use Case Diagram

```text
                           +------------------------+
                           |                        |
                           |   Student Project      |
                           |   Showcase Portal      |
                           |                        |
  +-------------+          |   +----------------+   |
  |             |----------|-->| Login / OAuth  |   |
  |   Student   |          |   +----------------+   |
  |             |----------|-->| Manage Projects|   |
  +-------------+          |   | (CRUD)         |   |
         |                 |   +----------------+   |
         |                 |   +----------------+   |
         +-----------------|-->| View Notifs    |   |
                           |   +----------------+   |
                           |                        |
  +-------------+          |   +----------------+   |
  |             |----------|-->| Browse Projects|   |
  |  Recruiter  |          |   +----------------+   |
  |             |----------|-->| Like Project   |   |
  +-------------+          |   +----------------+   |
         |                 |   +----------------+   |
         +-----------------|-->| Follow Student |   |
                           |   +----------------+   |
                           |                        |
  +-------------+          |   +----------------+   |
  |             |----------|-->| Manage Users   |   |
  |    Admin    |          |   +----------------+   |
  |             |----------|-->| Moderate       |   |
  +-------------+          |   | Projects       |   |
                           |   +----------------+   |
                           +------------------------+
```

### 3.2 Detailed User Stories

#### Authentication & Identity (OAuth & Passwordless)
1. **US-AUTH-01:** As a student, I want to sign in using my University Google account so that I don't need to remember a new password.
   * **Activity Flow:** User clicks "Sign in with Google" -> Redirected to Google Consent Screen -> User authenticates -> Redirected back to portal `/auth/callback` -> Backend parses JWT, upserts profile (Name, Avatar), issues platform tokens -> User lands on dashboard.
2. **US-AUTH-02:** As a recruiter, I want to sign up using an email and password so that I can access the platform even if I don't use Google Workspace.
   * **Activity Flow:** User enters email and strong password -> Clicks "Sign Up" -> Backend hashes password (PBKDF2) -> Creates user row -> Issues tokens -> User logged in.
3. **US-AUTH-03:** As a user, I want to log in using a one-time password (OTP) sent to my email so that I can securely log in if I forget my password.
   * **Activity Flow:** User enters email -> Clicks "Send Magic Code" -> Backend generates 6-digit OTP, stores in DB, prints to console (simulated email) -> User enters code -> Backend verifies and issues tokens.
4. **US-AUTH-04:** As a user, I want my session to remain active without needing to log in constantly, so that I have a smooth browsing experience.
   * **Activity Flow:** Access token expires (15 min) -> Frontend silently sends refresh token to `/api/auth/refresh` -> Backend verifies token, revokes it, issues new access + refresh token pair -> Request is retried automatically.
5. **US-AUTH-05:** As a user, I want to securely log out so that my session cannot be hijacked on shared computers.
   * **Activity Flow:** User clicks "Logout" -> Frontend sends refresh token to `/api/auth/revoke` -> Backend marks token as revoked -> Frontend clears local storage -> User redirected to login page.

#### Project Management (Student Portfolio)
6. **US-PROJ-01:** As a student, I want to create a new project post with a title and description so that I can showcase my latest work.
   * **Activity Flow:** Student navigates to "New Project" -> Fills in Title and Description -> Clicks submit -> `POST /api/projects` -> DB creates row, emits `ProjectCreated` event -> UI redirects to project detail view.
7. **US-PROJ-02:** As a student, I want to upload a visually appealing thumbnail image for my project so that it stands out in the public feed.
   * **Activity Flow:** Student edits project -> Selects image file (<5MB, PNG/JPG) -> Uploads -> `POST /api/projects/:id/thumbnail` (multipart) -> Multer saves to disk -> DB updates `thumbnail_url` -> UI displays new image.
8. **US-PROJ-03:** As a student, I want to edit my project details if I make a typo so that my portfolio looks professional.
   * **Activity Flow:** Student clicks "Edit" on own project -> Modifies text -> Submits -> `PUT /api/projects/:id` -> Ownership middleware verifies user -> DB updates row -> UI reflects changes.
9. **US-PROJ-04:** As a student, I want to delete a project that I am no longer proud of so that it stops appearing in my portfolio.
   * **Activity Flow:** Student clicks "Delete" -> Confirms prompt -> `DELETE /api/projects/:id` -> Ownership middleware verifies -> DB deletes row -> UI removes project from list.
10. **US-PROJ-05:** As a student, I want to see a list of my own projects on my profile so that I can manage my portfolio easily.
    * **Activity Flow:** Student navigates to "My Profile" -> `GET /api/users/:myId/profile` -> DB fetches user info and filters projects by `created_by = myId` -> UI displays personalized list.

#### Browsing & Engagement (Recruiters & Peers)
11. **US-BWS-01:** As a recruiter, I want to scroll through a feed of all public student projects so that I can discover interesting technical work.
    * **Activity Flow:** Recruiter visits homepage -> `GET /api/projects` -> Backend joins projects with authors and like counts -> UI renders grid of project cards sorted by newest.
12. **US-BWS-02:** As a recruiter, I want to view a project's detailed page so that I can read the full description and see the author's details.
    * **Activity Flow:** Recruiter clicks a project card -> `GET /api/projects/:id` -> Backend fetches specific project -> UI renders full layout.
13. **US-ENG-01:** As a recruiter, I want to "like" a project so that I can signal my appreciation for the student's work.
    * **Activity Flow:** Recruiter clicks heart icon -> `POST /api/projects/:id/like` -> DB inserts into `project_likes` -> Emits `ProjectLiked` event -> UI updates heart to filled state and increments counter.
14. **US-ENG-02:** As a recruiter, I want to "unlike" a project if I accidentally clicked it so that my saved list is accurate.
    * **Activity Flow:** Recruiter clicks filled heart -> `POST /api/projects/:id/like` -> Backend detects existing like -> Deletes row -> UI updates heart to empty state and decrements counter.
15. **US-ENG-03:** As a recruiter, I want to "follow" a student so that I can keep track of developers who catch my eye.
    * **Activity Flow:** Recruiter clicks "Follow" on student profile -> `POST /api/users/:id/follow` -> DB inserts into `student_follows` -> Emits `StudentFollowed` event -> UI changes button to "Following".
16. **US-ENG-04:** As a recruiter, I want to view a student's full public profile so that I can evaluate all their accumulated work at once.
    * **Activity Flow:** Recruiter clicks student name -> `GET /api/users/:id/profile` -> Backend fetches user info, all their projects, and their follower count -> UI renders profile page.
17. **US-ENG-05:** As a student, I want to see how many followers I have on my profile so that I can measure my industry traction.
    * **Activity Flow:** Student views own profile -> Backend runs `COUNT(*)` on `student_follows` -> UI displays "X Followers".

#### Event-Driven Notifications (System)
18. **US-NOT-01:** As a student, I want to receive a notification when a recruiter likes my project so that I know my work is generating industry interest.
    * **Activity Flow:** Recruiter likes project -> Event bus triggers -> Inserts row in `notifications` (type=`project_liked`) -> Student checks inbox -> UI shows "Recruiter Name liked your project".
19. **US-NOT-02:** As a student, I want to receive a notification when a recruiter follows me so that I know someone is actively tracking my progress.
    * **Activity Flow:** Recruiter follows student -> Event bus triggers -> Inserts row in `notifications` (type=`student_followed`) -> Student checks inbox -> UI shows "Recruiter Name started following you".
20. **US-NOT-03:** As a user, I want a dedicated notifications page where I can see all my alerts so that I don't miss important activity.
    * **Activity Flow:** User clicks Bell icon -> `GET /api/users/notifications` -> Backend fetches rows where `recipient_id = myId` sorted by date -> UI lists them.
21. **US-NOT-04:** As a user, I want to mark individual notifications as read so that I can track what I have already seen.
    * **Activity Flow:** User clicks a notification -> `PATCH /api/users/notifications/:id/read` -> DB sets `read = TRUE` -> UI dims the notification item.
22. **US-NOT-05:** As a user, I want a "Mark all as read" button so that I can quickly clear my inbox if I have many alerts.
    * **Activity Flow:** User clicks button -> `PATCH /api/users/notifications/read-all` -> DB updates all unread rows for user -> UI clears unread indicators.

#### Administration & Moderation
23. **US-ADM-01:** As an admin, I want to view a list of all registered users so that I can audit who has access to the platform.
    * **Activity Flow:** Admin navigates to Dashboard -> `GET /api/admin/users` -> Backend fetches users + roles -> UI displays data table.
24. **US-ADM-02:** As an admin, I want to change a user's role (e.g., promote a student to a recruiter) so that they have the correct system permissions.
    * **Activity Flow:** Admin selects user -> Chooses new role from dropdown -> `PUT /api/admin/users/:id/role` -> DB updates `role_id` -> User immediately gains/loses permissions on next request.
25. **US-ADM-03:** As an admin, I want to hide inappropriate projects from the public feed or block uploads so that the platform maintains a professional standard.
    * **Activity Flow:** Admin views project list -> Clicks "Hide" -> `PATCH /api/admin/projects/:id/visibility` -> DB sets `visibility = 'removed'` -> Project instantly disappears from `GET /api/projects` public feed. (Ideal: Projects could be private by default and require admin review before going public).


---

## 4. Functional Requirements Specification

### 4.1 Authentication & Identity (OAuth)

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | Users must authenticate using Google OAuth 2.0. | Must Have |
| AUTH-02 | System must capture and store: Name, Email, Profile picture (Avatar URL) from the Google provider. | Must Have |
| AUTH-03 | New users are auto-registered upon successful Google login and assigned the `student` role by default. | Must Have |
| AUTH-04 | System supports password-based login and signup (PBKDF2 hashed) as a fallback mechanism. | Should Have |
| AUTH-05 | System issues RS256-signed JWTs (Access Token, Refresh Token, ID Token). | Must Have |
| AUTH-06 | Token rotation: Refreshing an access token must revoke the old refresh token. | Must Have |

### 4.2 Project Management (Request/Response)

| ID | Requirement | Priority |
|---|---|---|
| PROJ-01 | **POST `/api/projects`**: Students can create a project. | Must Have |
| PROJ-02 | **GET `/api/projects`**: Any authenticated user can view the list of public projects. | Must Have |
| PROJ-03 | **GET `/api/projects/:id`**: Any authenticated user can view specific project details. | Must Have |
| PROJ-04 | **PUT `/api/projects/:id`**: Students can update their own projects. | Must Have |
| PROJ-05 | **DELETE `/api/projects/:id`**: Students can delete their own projects. | Must Have |
| PROJ-06 | **POST `/api/projects/:id/thumbnail`**: Students can upload a project thumbnail image (multipart/form-data). | Must Have |

### 4.3 Recruiter Interactions

| ID | Requirement | Priority |
|---|---|---|
| REC-01 | Recruiters have permission to browse projects (`projects:read`), like projects (`projects:like`), and follow students (`users:follow`). | Must Have |
| REC-02 | Recruiters **cannot** create, edit, or delete projects. | Must Have |
| REC-03 | Liking a project must behave as a toggle (like/unlike) preventing duplicate entries. | Must Have |
| REC-04 | Following a student must behave as a toggle preventing duplicate follows. | Must Have |

### 4.4 Event-Driven Component & Notifications

| ID | Requirement | Priority |
|---|---|---|
| EVT-01 | When a project is created, the system must generate a `ProjectCreated` event. | Must Have |
| EVT-02 | When a project receives a like, the system must generate a `ProjectLiked` event. | Must Have |
| EVT-03 | When a student is followed, the system must generate a `StudentFollowed` event. | Must Have |
| EVT-04 | Event handlers must be the **sole mechanism** for writing to the `notifications` table. Route controllers must not write notifications directly. | Must Have |
| EVT-05 | Students must be able to view their notifications and mark them as read. | Must Have |

**Event Flow Diagram:**

```text
+-------------------+      emit('ProjectLiked')      +-------------------+
|                   | -----------------------------> |                   |
|  Projects Router  |                                |  Event Emitter    |
|  (POST /:id/like) | <----------------------------- |  (events.js)      |
|                   |       (async return)           |                   |
+-------------------+                                +-------------------+
                                                              |
                                                              | on('ProjectLiked')
                                                              v
                                                     +-------------------+
                                                     |                   |
                                                     |  DB INSERT INTO   |
                                                     |  notifications    |
                                                     |                   |
                                                     +-------------------+
```

### 4.5 Administration Controls

| ID | Requirement | Priority |
|---|---|---|
| ADMIN-01 | Admins can view all registered users and their assigned roles. | Must Have |
| ADMIN-02 | Admins can change a user's role, and changes must take effect immediately without requiring the user to log in again. | Must Have |
| ADMIN-03 | Admins can view all projects, including those marked as removed. | Must Have |
| ADMIN-04 | Admins can soft-remove an inappropriate project by toggling its visibility status. | Must Have |
| ADMIN-05 | Admins can permanently hard-delete a project from the database. | Must Have |

---

## 5. Non-Functional Requirements

### 5.1 Security & Authorization
- **NFR-SEC-01:** Passwords must be hashed using PBKDF2 with unique salts.
- **NFR-SEC-02:** JWT signing must use RS256 asymmetric keys. The private key must persist on the host filesystem and never be committed to version control.
- **NFR-SEC-03:** Authorization checks must occur dynamically against the database on every request to ensure role changes apply instantly.
- **NFR-SEC-04:** API endpoints must be protected against Cross-Origin Resource Sharing (CORS) attacks by restricting access to the frontend origin.

### 5.2 Performance & Reliability
- **NFR-PERF-01:** Image uploads must be restricted to standard web formats (JPEG, PNG, WEBP, GIF) and limited to 5 MB per file to prevent storage exhaustion.
- **NFR-PERF-02:** The system must utilize database connection pooling to handle concurrent API requests efficiently.

### 5.3 Deployment & Infrastructure
- **NFR-INF-01:** The entire application stack (Frontend, Backend, Database) must be containerized using Docker.
- **NFR-INF-02:** The system must be deployable via a single `docker compose up --build -d` command.
- **NFR-INF-03:** Database state and uploaded files must persist across container restarts using Docker Named Volumes.

---

## 6. Database Design

### 6.1 Schema Overview

The database is highly normalized and relies heavily on foreign key constraints for cascading deletes and relational integrity.

| Table Name | Description |
|---|---|
| `roles` | Defines system roles: admin, recruiter, student. |
| `permissions` | Granular action strings (e.g., `projects:create`, `users:manage`). |
| `role_permissions` | Many-to-many mapping of which roles possess which permissions. |
| `users` | Core user identity, storing Google OAuth data and/or password hashes. |
| `projects` | User-generated showcases. Includes a `visibility` ENUM (`public`, `removed`). |
| `project_likes` | Join table tracking likes. Uses a `UNIQUE(project_id, liked_by)` constraint. |
| `student_follows` | Join table tracking follows. Uses a `UNIQUE(follower_id, student_id)` constraint. |
| `notifications` | Audit trail of events. Stores dynamic event data in a `JSONB` payload column. |
| `refresh_tokens` | Tracks active and revoked OIDC refresh tokens. |
| `otps` | Temporary codes for passwordless login mechanisms. |

### 6.2 Key Design Decisions
- **Event Storage:** The `notifications` table utilizes a PostgreSQL `JSONB` column for the `payload`. This allows the schema to be extremely flexible, accommodating future event types without requiring database migrations to add new columns.
- **Soft Deletion:** The `projects` table uses a `visibility` constraint rather than immediate deletion when an admin moderates content. This preserves data for auditing purposes.
- **Concurrency Control:** `UNIQUE` compound indexes on likes and follows guarantee that race conditions cannot result in duplicate records, even if a user rapidly clicks a button multiple times.

---

## 7. Role & Permission Model

| Role | Permissions Assigned via DB |
|---|---|
| **Admin** | `projects:read`, `projects:create`, `projects:write`, `projects:like`, `users:follow`, `users:manage`, `projects:manage` |
| **Recruiter** | `projects:read`, `projects:like`, `users:follow` |
| **Student** | `projects:read`, `projects:create`, `projects:write`, `projects:like` |

### 7.1 Permission Model & Authorization Architecture

The platform utilizes a **Dynamic Role-Based Access Control (RBAC)** system. Unlike traditional architectures that bake permissions directly into the JWT (which makes instant revocation impossible without blacklists), this system stores and evaluates permissions dynamically in the database.

#### Where Permissions Live
Permissions live entirely within the PostgreSQL database across a normalized schema:
1. **`roles` table:** Defines the core user archetypes (`admin`, `recruiter`, `student`).
2. **`permissions` table:** Defines granular, system-wide actions (e.g., `projects:read`, `projects:create`, `users:manage`).
3. **`role_permissions` table (Join Table):** Maps which roles are granted which permissions.
4. **`users` table:** Contains a `role_id` foreign key linking the individual user to their role.

#### How It Is Enforced
When a user attempts to access a protected API endpoint, the request passes through the `requirePermission('permission:name')` Express middleware (`backend/src/middleware.js`).

1. The middleware reads the user's `id` from their verified JWT.
2. It executes a real-time SQL `SELECT EXISTS (...)` query joining the `users`, `roles`, `role_permissions`, and `permissions` tables.
3. If the user's current role possesses the required permission, the request proceeds. If not, a `403 Forbidden` is returned.

#### Why This Architecture?
Because permissions are evaluated against the database on every request rather than relying on stale JWT claims:
* **Instant Propagation:** If an Admin promotes a `student` to a `recruiter`, the user instantly gains recruiter permissions on their very next click. They do not need to log out and request a new JWT.
* **Centralized Logic:** Route handlers remain completely unaware of "Roles". They only ask "Does this user have the `projects:write` permission?", making the code highly scalable if new roles are introduced later.

---

## 8. Technology Stack Selection

| Component | Selected Technology | Justification |
|---|---|---|
| **Runtime Environment** | Node.js 22 (Alpine Linux) | Fast, asynchronous event-driven runtime ideal for the requested architecture. Alpine provides a minimal, secure Docker footprint. |
| **Backend Framework** | Express.js | Industry-standard, lightweight, and highly extensible middleware routing framework. |
| **Database** | PostgreSQL 16 | ACID-compliant relational database chosen for strict schema enforcement and advanced `JSONB` capabilities. |
| **Authentication Strategy** | Passport.js + OAuth20 | Reliable middleware for integrating third-party OIDC identity providers like Google. |
| **Cryptography** | `jsonwebtoken` & Node `crypto` | Robust RS256 token signing and PBKDF2 password hashing capabilities. |
| **File Handling** | Multer | Standard Express middleware for securely processing `multipart/form-data` streams for image uploads. |
| **Event Bus** | Node.js `EventEmitter` | Meets the assignment requirements for a pub/sub pattern without introducing external dependencies (like Kafka or Redis). |
| **Infrastructure** | Docker Compose | Ensures parity between development and production environments and simplifies deployment. |

---

## 9. Deliverables Status

| Required Deliverable | Description | Current Status |
|---|---|---|
| **Source Code** | Full backend implementation | ✅ Complete |
| **API Documentation** | Details of all endpoints | ✅ Complete (`docs/api.md`) |
| **Requirement Document** | This specification | ✅ Complete |
| **Docker Deployment** | Containerized architecture | ✅ Complete |
| **Frontend UI** | React/Vue SPA (Maroon theme) | 🔲 Pending |
| **Deployment URL** | Live hosted version | 🔲 Pending |
| **Demo** | Video walkthrough | 🔲 Pending |
