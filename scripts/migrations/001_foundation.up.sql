CREATE TABLE IF NOT EXISTS madevi_content (
  id uuid PRIMARY KEY,
  space text NOT NULL CHECK (space IN ('explore','tutorial','school','shop','tools','services','line')),
  content_type text NOT NULL CHECK (content_type ~ '^[a-z][a-z0-9_-]{1,49}$'),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  workflow_status text NOT NULL DEFAULT 'draft' CHECK (workflow_status IN ('draft','in_review','approved','published','archived')),
  author_id text NOT NULL REFERENCES "user"(id),
  latest_revision integer NOT NULL DEFAULT 0,
  published_revision integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space, slug),
  CHECK (published_revision IS NULL OR (published_revision > 0 AND published_revision <= latest_revision))
);
CREATE TABLE IF NOT EXISTS madevi_content_revisions (
  content_id uuid NOT NULL REFERENCES madevi_content(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, revision)
);
CREATE TABLE IF NOT EXISTS madevi_content_relations (
  source_id uuid NOT NULL REFERENCES madevi_content(id) ON DELETE RESTRICT,
  target_id uuid NOT NULL REFERENCES madevi_content(id) ON DELETE RESTRICT,
  relation_type text NOT NULL CHECK (relation_type ~ '^[a-z][a-z0-9_-]{1,49}$'),
  PRIMARY KEY (source_id, target_id, relation_type),
  CHECK (source_id <> target_id)
);
CREATE TABLE IF NOT EXISTS madevi_moderation_events (
  id bigserial PRIMARY KEY, content_id uuid NOT NULL REFERENCES madevi_content(id) ON DELETE RESTRICT,
  actor_id text NOT NULL REFERENCES "user"(id), from_status text NOT NULL, to_status text NOT NULL,
  note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS madevi_content_public_idx ON madevi_content(space, content_type, updated_at DESC) WHERE published_revision IS NOT NULL;
CREATE INDEX IF NOT EXISTS madevi_revision_search_idx ON madevi_content_revisions USING gin(to_tsvector('simple', title));
CREATE TABLE IF NOT EXISTS madevi_rate_limits (key text PRIMARY KEY, window_start timestamptz NOT NULL, hits integer NOT NULL CHECK(hits >= 0));
CREATE INDEX IF NOT EXISTS madevi_rate_limits_window_idx ON madevi_rate_limits(window_start);
CREATE TABLE IF NOT EXISTS madevi_security_events (
  id bigserial PRIMARY KEY, event text NOT NULL, outcome text NOT NULL, action text, status integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS madevi_security_events_created_idx ON madevi_security_events(created_at);
CREATE TABLE IF NOT EXISTS madevi_media_variants (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  variant text NOT NULL CHECK (variant IN ('small','medium','large')),
  mime_type text NOT NULL DEFAULT 'image/webp', data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, variant)
);
CREATE UNIQUE INDEX IF NOT EXISTS madevi_single_admin_idx ON "user" ((1)) WHERE "madeviRole" = 'admin';
CREATE OR REPLACE FUNCTION madevi_audit_role_change() RETURNS trigger AS $$
BEGIN
  IF NEW."madeviRole" IS DISTINCT FROM OLD."madeviRole" THEN
    INSERT INTO madevi_audit(actor_id,action,target_id) VALUES (COALESCE(NULLIF(current_setting('madevi.actor_id', true),''),'system'), 'role.change:' || COALESCE(OLD."madeviRole",'none') || '->' || COALESCE(NEW."madeviRole",'none'), NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS madevi_role_change_trigger ON "user";
CREATE TRIGGER madevi_role_change_trigger AFTER UPDATE OF "madeviRole" ON "user" FOR EACH ROW EXECUTE FUNCTION madevi_audit_role_change();

