ALTER TABLE madevi_support_posts ADD COLUMN event_order bigint;
WITH legacy AS (
  SELECT id, row_number() OVER (ORDER BY created_at,
    CASE sender WHEN 'user' THEN 0 WHEN 'auto' THEN 1 ELSE 2 END, id) AS position
  FROM madevi_support_posts
)
UPDATE madevi_support_posts p SET event_order=legacy.position FROM legacy WHERE p.id=legacy.id;
CREATE SEQUENCE madevi_support_event_order OWNED BY madevi_support_posts.event_order;
SELECT setval('madevi_support_event_order', coalesce(max(event_order),1), count(*)>0) FROM madevi_support_posts;
ALTER TABLE madevi_support_posts ALTER COLUMN event_order SET DEFAULT nextval('madevi_support_event_order'),
  ALTER COLUMN event_order SET NOT NULL;
DROP INDEX madevi_support_posts_thread;
CREATE UNIQUE INDEX madevi_support_posts_thread ON madevi_support_posts(thread_id,event_order DESC);

CREATE TABLE madevi_message_requests (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL,
  job_id uuid NOT NULL,
  signature text NOT NULL CHECK (length(signature)=64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX madevi_message_requests_created ON madevi_message_requests(created_at,id);
CREATE INDEX madevi_operations_routine ON madevi_operations(requested_at DESC)
  WHERE kind='backup' AND parameters @> '{"routine":true}';
ALTER TABLE madevi_operations ADD COLUMN progress_at timestamptz;
ALTER TABLE madevi_reports ADD COLUMN request_id uuid UNIQUE, ADD COLUMN request_signature text;
