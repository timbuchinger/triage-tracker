---
title: "Auth: Passport username/password (owners, members, org-based invites)"
status: draft
labels:
  - enhancement
  - auth
  - backend
  - frontend
  - prisma
---

# Add username/password authentication using Passport (owners, members, org-based invites)

## Summary

Implement a first-class authentication flow using Passport with username/password (no sign-up UI for now). All users must belong to an organization. Within each organization, users have roles (Owner, Member). Owners can invite new users (for now: mock email by printing invite link to the server console). Owners can manage members (change roles, remove users) from a members management UI.

## Goals

- Implement login with username/password using `passport-local` in the Nest backend.
- Enforce that every user belongs to exactly one organization.
- Support Owner and Member roles; Owners have elevated privileges.
- Provide an Owner-only invite flow: create invite token + send email (mock to console).
- Provide a members management UI for Owners to change roles and remove users.
- No sign-up screen — invites create or allow users to accept membership.

## User flows

- **Login**
  - `/login` — User enters email and password. On success, they receive access token + refresh token (see security notes).
  - If not assigned to an organization, block access.

- **Invite (Owner)**
  - Owner navigates to `Organization → Members → Invite` and submits invitee email (+ optional initial role).
  - System creates an `Invite` with secure token and expiry (e.g., 7 days) and "sends" an email containing the accept link (mock: printed to server console).
  - Invitee hits the accept link, provides a password, and a `User` is created tied to the organization.

- **Members management (Owner)**
  - Owners can list members, change roles (Owner/Member), and remove users.
  - Prevent removing the last Owner (require at least one Owner).
  - Role changes should be recorded in an audit log or timeline event.

## Backend: Proposed API endpoints

- `POST /auth/login` — Body: `{ email, password }` — uses `passport-local` → returns access token + sets refresh cookie (or returns tokens).
- `POST /auth/logout` — revokes refresh token and clears cookies.
- `POST /auth/refresh` — uses HttpOnly refresh cookie; returns new access token (rotate refresh tokens).

- `POST /orgs/:orgId/invites` — Owner-only. Body: `{ email, role? }` — create Invite, send email (mock console).
- `POST /invites/accept` — Body: `{ token, password }` — verifies token, creates `User` linked to org, consumes token.

- `GET /orgs/:orgId/members` — list members.
- `PATCH /orgs/:orgId/members/:userId/role` — Owner-only: change role.
- `DELETE /orgs/:orgId/members/:userId` — Owner-only: remove member.

## Database (Prisma) changes (proposed)

- Add enum `Role { OWNER MEMBER }`.
- `Organization` model with `users` and `invites` relations.
- `User` with `email`, `passwordHash`, `role`, and required `organizationId`.
- `Invite` with `token`, `email`, `role`, `expiresAt`, `used`.
- `RefreshToken` model (or use Redis) to support token rotation and revocation.

Example models (conceptual):

```
enum Role { OWNER MEMBER }

model Organization {
  id        String   @id @default(cuid())
  name      String
  users     User[]
  invites   Invite[]
}

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  passwordHash   String
  role           Role
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}

model Invite {
  id             String   @id @default(cuid())
  email          String
  token          String   @unique
  role           Role     @default(MEMBER)
  organizationId String
  expiresAt      DateTime
  used           Boolean  @default(false)
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  revoked   Boolean  @default(false)
  expiresAt DateTime
}
```

Notes: require non-null `User.organizationId` to satisfy the "all users must belong to an organization" requirement.

## Frontend screens & flows (Vue)

- `/login` — email + password.
- `Org → Members` — list members, role badges, actions (change role, remove); Owners-only.
- `Org → Invite` modal/page — email + role; after send, invite link is printed to server console.
- Use Pinia for auth state; `axios` interceptor for access token; router guards for protected routes.

## Implementation details (Nest + Passport)

- Use `@nestjs/passport`, `passport-local` for initial login and `passport-jwt` for protected APIs.
- `LocalStrategy` validates with `AuthService` (Prisma user lookup + bcrypt compare).
- `JwtStrategy` validates access tokens. Use Guards and custom `RolesGuard` to restrict Owner endpoints.
- Invite token generation: use secure random bytes (32+) base64url; set expiry; one-time use.

## Acceptance criteria

- Login implemented and authenticates existing users.
- No signup UI; invite-based creation only.
- All users in DB have non-null `organizationId`.
- Owners can create invites; invite token printed to console.
- Invite accept flow creates user and links them to org.
- Owners can view members, change roles, remove users.
- Cannot remove last Owner.

## Testing suggestions

- Unit tests: `AuthService` (login, refresh), LocalStrategy.
- Integration: invite creation → accept → user creation.
- E2E: Owner-only endpoints and UI flows.

## Security checklist

- HTTPS required.
- HttpOnly, Secure, SameSite for refresh cookies.
- Short-lived access tokens; rotate refresh tokens.
- Rate-limit `/auth/login` and `/orgs/:orgId/invites`.
- Hash passwords with bcrypt/argon2.

## Migration & docs

- Add Prisma migration and follow repo's migration steps (see `AGENTS.md`).
- Document mocked email behavior in developer README.

## Open questions

- How to treat existing users without an org?
- Should Owners be allowed to invite other Owners?
- Future: support multi-org users?

---

If you'd like, I can also open this as a real GitHub issue (requires repo issue permissions), or I can draft the Prisma migration and Nest `AuthModule` skeleton next.
