ALTER TABLE "session" ADD COLUMN "madeviActiveAt" timestamptz;

CREATE TABLE madevi_email_change_proof (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES "session"(id) ON DELETE CASCADE,
  target text NOT NULL CHECK (length(target) BETWEEN 3 AND 254),
  expires_at timestamptz NOT NULL
);
CREATE INDEX madevi_email_change_proof_session ON madevi_email_change_proof(session_id);

CREATE FUNCTION madevi_revoke_changed_identity() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  principal text;
  event text;
BEGIN
  IF TG_TABLE_NAME = 'user' THEN
    principal := NEW.id;
    event := 'account.email.changed';
  ELSE
    principal := NEW."userId";
    event := 'account.password.changed';
  END IF;
  DELETE FROM public."session" WHERE "userId"=principal;
  INSERT INTO public.madevi_audit(actor_id,action,target_id) VALUES(principal,event,principal);
  RETURN NEW;
END;
$$;

CREATE TRIGGER madevi_email_change AFTER UPDATE OF email ON "user"
FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email) EXECUTE FUNCTION madevi_revoke_changed_identity();
CREATE TRIGGER madevi_password_change AFTER UPDATE OF password ON "account"
FOR EACH ROW WHEN (NEW."providerId" = 'credential' AND OLD.password IS DISTINCT FROM NEW.password)
EXECUTE FUNCTION madevi_revoke_changed_identity();

ALTER TABLE madevi_operations ALTER COLUMN status SET DEFAULT 'queued', ALTER COLUMN phase SET DEFAULT 'queued';

CREATE FUNCTION madevi_protect_account_role() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."madeviRole" = 'user' AND NOT NEW."isDemo" THEN RETURN NEW; END IF;
  ELSE
    IF NEW."madeviRole" IS NOT DISTINCT FROM OLD."madeviRole"
       AND NEW."isDemo" IS NOT DISTINCT FROM OLD."isDemo" THEN RETURN NEW; END IF;
  END IF;
  IF current_user <> (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public."user"'::regclass) THEN
    RAISE EXCEPTION 'account role can only be assigned by the schema owner' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER madevi_account_role_guard BEFORE INSERT OR UPDATE OF "madeviRole","isDemo" ON "user"
FOR EACH ROW EXECUTE FUNCTION madevi_protect_account_role();

ALTER TABLE madevi_library ADD COLUMN publication_reviewed_at timestamptz,
  ADD COLUMN publication_reviewed_by text REFERENCES "user"(id),
  ADD CONSTRAINT madevi_library_publication_review CHECK (
    (publication_reviewed_at IS NULL) = (publication_reviewed_by IS NULL)
  );
