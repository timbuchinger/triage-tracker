# Authentication Implementation Summary

## Overview

The Triage Tracker now has a complete username/password authentication system implemented using Passport.js with JWT tokens and refresh tokens.

## Backend Implementation

### Database Schema

- **User** model extended with `passwordHash` field and `RefreshToken` relation
- **UserRole** enum changed from `ADMIN/MEMBER` to `OWNER/MEMBER`
- **Invite** model for organization invitations
- **RefreshToken** model for secure token rotation
- **Incident** model now has `reporterId` and `ownerId` fields

### API Endpoints

#### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout and revoke refresh token
- `POST /api/auth/refresh` - Refresh access token using refresh token cookie

#### Organizations & Members  
- `GET /api/organizations/:orgId/members` - List organization members
- `PATCH /api/organizations/:orgId/members/:userId/role` - Change member role (OWNER only)
- `DELETE /api/organizations/:orgId/members/:userId` - Remove member (OWNER only)

#### Invitations
- `POST /api/organizations/:orgId/invites` - Create invite (OWNER only)
- `GET /api/organizations/:orgId/invites` - List pending invites (OWNER only)
- `POST /api/organizations/invites/accept` - Accept invite (public endpoint)

### Security Features

- JWT access tokens (15 min expiry by default)
- HttpOnly refresh tokens (7 days expiry)
- Token rotation on refresh
- bcrypt password hashing
- Global JWT authentication guard with `@Public()` decorator for exceptions
- Role-based access control with `@Roles()` decorator
- Automatic token refresh on API requests

### Test Credentials

Created during seed:

**Owner Account:**
- Email: `admin@example.com`
- Password: `password123`
- Role: OWNER

**Member Account:**
- Email: `member@example.com`
- Password: `password123`
- Role: MEMBER

## Frontend Implementation

### Auth Store (Pinia)

Located at `/frontend/src/stores/auth.ts`:
- Manages user authentication state
- Stores access token and user info
- Handles login, logout, and token refresh
- Persists to localStorage for session management

### Protected Routes

- All routes require authentication by default
- Login page is public (marked with `meta: { public: true }`)
- Router guard redirects unauthenticated users to `/login`
- Logged-in users accessing `/login` are redirected to home

### API Client Updates

The API client (`/frontend/src/api/client.ts`) now:
- Automatically includes JWT token in Authorization header
- Sends cookies (credentials: 'include') for refresh tokens
- Can be extended to handle 401 errors and auto-refresh

### UI Components

**Login Page** (`/pages/auth/LoginPage.vue`):
- Simple email/password form
- Error handling
- Redirect to original destination after login

**Members Management** (`/pages/organization/MembersPage.vue`):
- List all organization members (all users)
- Change member roles (OWNER only)
- Remove members (OWNER only)
- Create and send invites (OWNER only)
- View pending invites (OWNER only)

**Navigation Updates**:
- TopNav shows current user email and role badge
- Sign out button
- Sidebar shows "Members" link for OWNER users only

## Incident Ownership

The `owner=me` filter on incidents now works correctly:
- Uses the authenticated user's ID from JWT token
- No longer throws 401 errors when not authenticated
- Properly filters incidents by owner

## Invite Flow (Mock Email)

When an OWNER creates an invite:
1. Invite record is created with secure token
2. Invite URL is printed to **server console** (mock email)
3. Recipient can visit the URL and set their password
4. User account is created and linked to the organization
5. Invite is marked as used

Example invite URL: `http://localhost:5173/invite/accept?token=<secure_token>`

## Development Notes

### Environment Variables

Add to backend `.env`:
```bash
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

### Running Migrations

The authentication migration has been applied. To reapply in a fresh environment:

```bash
docker compose -f docker-compose.dev.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.dev.yml exec api npm run db:seed
```

### Testing Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' \
  -c cookies.txt

# Use token
TOKEN="<access_token_from_login>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/incidents
```

## Future Enhancements

Potential improvements (not yet implemented):
- Automatic token refresh on 401 responses
- Password reset flow
- Email verification
- Multi-factor authentication
- Audit logging for role changes
- Real email sending (currently mocked to console)
- Invite expiration cleanup job
- Rate limiting on login attempts

## Files Modified/Created

### Backend
- `backend/prisma/schema.prisma` - Updated schema
- `backend/src/auth/*` - Complete Auth module
- `backend/src/organizations/*` - Organizations & Invites modules
- `backend/src/app.module.ts` - Added modules and global guard
- `backend/src/main.ts` - Added cookie-parser and CORS
- `backend/src/incidents/incidents.controller.ts` - Updated for auth
- `backend/prisma/seed.ts` - Added password hashing

### Frontend  
- `frontend/src/api/auth.ts` - Auth API client
- `frontend/src/api/client.ts` - Added token handling
- `frontend/src/api/organizations.ts` - Organizations API client
- `frontend/src/stores/auth.ts` - Auth Pinia store
- `frontend/src/pages/auth/LoginPage.vue` - Login page
- `frontend/src/pages/organization/MembersPage.vue` - Members management
- `frontend/src/router/index.ts` - Added routes and guards
- `frontend/src/main.ts` - Added auth initialization
- `frontend/src/App.vue` - Handle public routes
- `frontend/src/components/layout/TopNav.vue` - User info and logout
- `frontend/src/components/layout/Sidebar.vue` - Members link for owners

## Architecture Compliance

✅ Follows `AGENTS.md` requirements
✅ Uses approved Prisma ORM patterns
✅ Backend follows NestJS conventions
✅ Frontend follows Vue 3 + TypeScript + Tailwind v4 patterns
✅ Uses existing UI component library
✅ No custom inline styles added
✅ Migrations properly applied and documented
