export const memberSessionSeconds = 7 * 24 * 60 * 60;
export const privilegedSessionSeconds = 8 * 60 * 60;
export const emailChangeSeconds = 10 * 60;

// This fragment takes aliases from the calling SQL only. PostgreSQL is the clock
// shared by authorization, revocation and workers.
export const sessionUsable = `s."expiresAt">now()
  AND CASE WHEN u."madeviRole" IN ('admin','author','reviewer','moderator')
    THEN s."createdAt">now()-interval '8 hours' AND coalesce(s."madeviActiveAt",s."createdAt")>now()-interval '30 minutes'
    ELSE s."createdAt">now()-interval '7 days' AND coalesce(s."madeviActiveAt",s."createdAt")>now()-interval '24 hours'
  END`;
