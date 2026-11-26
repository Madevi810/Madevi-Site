ALTER TABLE "user" ADD COLUMN restriction text CHECK (restriction IN ('blocked','suspended','banned'));
ALTER TABLE "user" ADD COLUMN restricted_until timestamptz;
UPDATE "user" SET restriction='blocked' WHERE suspended;
ALTER TABLE "user" ADD CONSTRAINT madevi_timed_restriction CHECK (coalesce(restriction='suspended',false) = (restricted_until IS NOT NULL));

ALTER TABLE madevi_audit ADD COLUMN reason text CHECK (length(reason)<=500);
ALTER TABLE madevi_audit ADD COLUMN outcome text NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','failed'));
CREATE INDEX madevi_audit_recent_idx ON madevi_audit(created_at DESC,id DESC);
ALTER TABLE madevi_reports ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent'));
CREATE TABLE madevi_report_events (
  id bigserial PRIMARY KEY, report_id bigint NOT NULL REFERENCES madevi_reports(id),
  actor_id text NOT NULL REFERENCES "user"(id), status text NOT NULL, priority text NOT NULL,
  note text NOT NULL CHECK(length(note)<=1000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX madevi_report_events_history_idx ON madevi_report_events(report_id,id DESC);

CREATE TABLE madevi_information_pages (
  slug text PRIMARY KEY, title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  body text NOT NULL CHECK(length(body) <= 12000), visible boolean NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK(version>0), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE madevi_website_settings (
  id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL DEFAULT 1 CHECK(version>0),
  navigation jsonb NOT NULL, announcement text NOT NULL CHECK(length(announcement)<=200),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE madevi_library (
  id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  mime_type text NOT NULL CHECK(mime_type='image/webp'), visibility text NOT NULL CHECK(visibility IN ('public','private')),
  data bytea NOT NULL CHECK(octet_length(data) BETWEEN 1 AND 2000000),
  created_by text NOT NULL REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE madevi_revision_files (
  content_id uuid NOT NULL, revision integer NOT NULL, media_id uuid NOT NULL REFERENCES madevi_library(id),
  PRIMARY KEY(content_id,revision,media_id),
  FOREIGN KEY(content_id,revision) REFERENCES madevi_content_revisions(content_id,revision)
);
CREATE INDEX madevi_revision_files_media_idx ON madevi_revision_files(media_id);

CREATE TABLE madevi_message_templates (
  id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE madevi_message_jobs (
  id uuid PRIMARY KEY, author text NOT NULL REFERENCES "user"(id),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  audience text NOT NULL CHECK (audience IN ('user','verified','unverified','all')),
  recipient_id text REFERENCES "user"(id), media_id uuid REFERENCES madevi_library(id),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','sent','failed','cancelled')),
  run_at timestamptz, sent_at timestamptz, deliveries integer,
  failure_code text CHECK (failure_code IN ('no_recipients','database_write')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((audience='user')=(recipient_id IS NOT NULL))
);
CREATE INDEX madevi_message_due_idx ON madevi_message_jobs(run_at,id) WHERE status='scheduled';
ALTER TABLE madevi_notifications ADD COLUMN job_id uuid REFERENCES madevi_message_jobs(id);
CREATE UNIQUE INDEX madevi_notification_job_recipient_idx ON madevi_notifications(job_id,recipient_id) WHERE job_id IS NOT NULL;

CREATE TABLE madevi_support_rules (
  id uuid PRIMARY KEY, keyword text, response text NOT NULL CHECK(length(response) BETWEEN 1 AND 2000),
  enabled boolean NOT NULL DEFAULT true, starts_at timestamptz, ends_at timestamptz,
  CHECK(starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);
ALTER TABLE madevi_reports ADD COLUMN automatic_response text;

CREATE TABLE madevi_operations (
  id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('backup','restore')),
  status text NOT NULL CHECK(status IN ('running','completed','failed')),
  artifact text, bytes bigint, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  details text
);
CREATE INDEX madevi_message_status_idx ON madevi_message_jobs(updated_at DESC,id DESC);

CREATE TABLE madevi_worker_status (
  name text PRIMARY KEY CHECK(name='dispatch'),
  delivered integer NOT NULL CHECK(delivered>=0),
  failed integer NOT NULL CHECK(failed>=0),
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX madevi_reports_priority_idx ON madevi_reports(priority,created_at DESC,id DESC);
CREATE INDEX madevi_notifications_job_idx ON madevi_notifications(job_id) WHERE job_id IS NOT NULL;
