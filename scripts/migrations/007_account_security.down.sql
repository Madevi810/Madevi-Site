ALTER TABLE madevi_library DROP CONSTRAINT madevi_library_publication_review, DROP COLUMN publication_reviewed_at, DROP COLUMN publication_reviewed_by;
DROP TRIGGER madevi_account_role_guard ON "user";
DROP FUNCTION madevi_protect_account_role();
ALTER TABLE madevi_operations ALTER COLUMN status DROP DEFAULT, ALTER COLUMN phase DROP DEFAULT;
DROP TRIGGER madevi_password_change ON "account";
DROP TRIGGER madevi_email_change ON "user";
DROP FUNCTION madevi_revoke_changed_identity();
DROP TABLE madevi_email_change_proof;
ALTER TABLE "session" DROP COLUMN "madeviActiveAt";
