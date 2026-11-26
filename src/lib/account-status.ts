// All callers alias the PostgreSQL user row as u.
export const accountRestricted = "coalesce((u.suspended OR u.restriction IN ('blocked','banned') OR (u.restriction='suspended' AND u.restricted_until>now())),false)";
export const accountStatus = `CASE
  WHEN u.restriction='banned' THEN 'banned'
  WHEN u.suspended OR u.restriction='blocked' THEN 'blocked'
  WHEN u.restriction='suspended' AND u.restricted_until>now() THEN 'suspended'
  WHEN NOT u."emailVerified" THEN 'unverified'
  ELSE 'active' END`;
