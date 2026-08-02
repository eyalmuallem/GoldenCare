# GoldenCare Architecture

## Frontend
- React 19
- Vite 8
- React Router with `HashRouter` for GitHub Pages compatibility
- Firebase modular Web SDK

## Authorization
- `users/{uid}` is the authenticated user's security profile.
- `organizations/{orgId}/staff/{uid}` is the organization staff directory.
- Admin access is enforced in Firestore Security Rules, not only hidden in the UI.
- Coaches can read assigned groups and their enrollment/attendance data, but cannot read charges.

## Billing integrity
- Enrollment stores the agreed base price, discount and final monthly price.
- A charge document stores a snapshot of the amount for a specific month.
- Charge IDs are deterministic: `{YYYY-MM}_{enrollmentId}`.
- Re-running monthly generation does not create duplicates.
- Enrollment status changes are stored as effective-month history entries.

## Attendance
- Session IDs are deterministic: `{groupId}_{YYYY-MM-DD}`.
- Attendance is stored as a child-ID keyed map in each session.
- Coaches may create and update sessions only for groups assigned to their UID.
