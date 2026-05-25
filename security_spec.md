# Security Specification for CariMurah.ai

## Data Invariants
1. A user can only read/write their own profile (`/users/{userId}`).
2. A user can only read/write their own history (`/users/{userId}/history/{historyId}`).
3. Users cannot modify their `uid` or `email` once set (immutable).
4. History items are immutable once created (or at least cannot be partially updated in a way that falsifies records).

## The Dirty Dozen Payloads
1. Attempt to write to another user's profile.
2. Attempt to read history of another user.
3. Attempt to set `b2bFocus` to an invalid enum value (e.g., "fastest").
4. Attempt to write a profile without a `uid`.
5. Attempt to update a history item's `totalSaved` to a massive negative number.
6. Attempt to inject a 2MB string into `displayName`.
7. Attempt to create a history item with a future date.
8. Attempt to delete another user's history.
9. Attempt to read all users (blanket read).
10. Attempt to update `email` field after initial setup.
11. Attempt to create a profile where `uid` doesn't match `request.auth.uid`.
12. Attempt to write to a non-existent collection `/internal_settings`.

## Test Runner (Conceptual)
All the above should return `PERMISSION_DENIED`.
