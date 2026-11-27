ALTER TABLE madevi_operations DROP CONSTRAINT madevi_operations_kind_check;
ALTER TABLE madevi_operations DROP CONSTRAINT madevi_operations_status_check;
ALTER TABLE madevi_operations ALTER COLUMN started_at DROP NOT NULL, ALTER COLUMN started_at DROP DEFAULT;
ALTER TABLE madevi_operations ADD COLUMN requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN requested_by text REFERENCES "user"(id), ADD COLUMN parameters jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN retry_of uuid UNIQUE REFERENCES madevi_operations(id), ADD COLUMN phase text,
  ADD CONSTRAINT madevi_operations_kind_check CHECK(kind IN ('backup','restore','verify','target_check','release','host_config')),
  ADD CONSTRAINT madevi_operations_status_check CHECK(status IN ('queued','running','completed','failed'));
UPDATE madevi_operations SET requested_at=started_at WHERE started_at IS NOT NULL;
CREATE INDEX madevi_operations_queue ON madevi_operations(requested_at,id) WHERE status='queued';
CREATE INDEX madevi_operations_recent ON madevi_operations(requested_at DESC,id DESC);
CREATE INDEX madevi_operations_backups ON madevi_operations(requested_at DESC,id) WHERE kind='backup' AND status='completed';
CREATE TABLE madevi_operations_health (
  id integer PRIMARY KEY CHECK(id=1),
  checked_at timestamptz NOT NULL DEFAULT now(),
  capabilities jsonb NOT NULL,
  metrics jsonb NOT NULL
);

CREATE TABLE madevi_site_history (
  resource text NOT NULL CHECK(resource IN ('settings','tentang','privasi','ketentuan','bantuan')),
  version integer NOT NULL CHECK(version>=0), snapshot jsonb NOT NULL,
  actor_id text REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now(),
  restored_from integer, PRIMARY KEY(resource,version)
);
INSERT INTO madevi_site_history(resource,version,snapshot,created_at)
SELECT 'settings',version,jsonb_build_object('navigation',navigation,'announcement',announcement),updated_at FROM madevi_website_settings
UNION ALL
SELECT slug,version,jsonb_build_object('slug',slug,'title',title,'body',body,'visible',visible),updated_at FROM madevi_information_pages;

ALTER TABLE madevi_library DROP CONSTRAINT madevi_library_mime_type_check;
ALTER TABLE madevi_library ADD COLUMN byte_size integer GENERATED ALWAYS AS (octet_length(data)) STORED;
ALTER TABLE madevi_library ADD CONSTRAINT madevi_library_mime_type_check
  CHECK(mime_type IN ('image/webp','application/pdf','text/plain','text/csv'));

CREATE TABLE madevi_support_availability (
  id integer PRIMARY KEY CHECK(id=1), config jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1
);
CREATE TABLE madevi_support_threads (
  id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'waiting_admin' CHECK(status IN ('waiting_admin','waiting_user','resolved')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX madevi_support_owner ON madevi_support_threads(user_id,updated_at DESC,id);
CREATE INDEX madevi_support_queue ON madevi_support_threads(status,updated_at DESC,id);
CREATE TABLE madevi_support_posts (
  id uuid PRIMARY KEY, thread_id uuid NOT NULL REFERENCES madevi_support_threads(id),
  sender text NOT NULL CHECK(sender IN ('user','admin','auto','note','event')),
  actor_id text REFERENCES "user"(id), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX madevi_support_posts_thread ON madevi_support_posts(thread_id,created_at DESC,id DESC);
CREATE UNIQUE INDEX madevi_support_one_automatic ON madevi_support_posts(thread_id) WHERE sender='auto';

CREATE TABLE madevi_monitor_buckets (
  hour timestamptz NOT NULL, route text NOT NULL, result text NOT NULL CHECK(result IN ('ok','client','error')),
  count bigint NOT NULL, total_ms bigint NOT NULL, max_ms int NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(hour,route,result)
);
CREATE TABLE madevi_monitor_incidents (
  id uuid PRIMARY KEY, source text NOT NULL, opened_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  detail text NOT NULL
);
CREATE UNIQUE INDEX madevi_monitor_open ON madevi_monitor_incidents(source) WHERE resolved_at IS NULL;
