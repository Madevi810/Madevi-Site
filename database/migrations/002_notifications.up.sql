CREATE TABLE IF NOT EXISTS madevi_notifications (
  id uuid PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('general','system','social')),
  recipient_id text REFERENCES "user"(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((category = 'general' AND recipient_id IS NULL) OR (category <> 'general' AND recipient_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS madevi_notifications_audience_idx ON madevi_notifications(category, recipient_id, created_at DESC);
CREATE TABLE IF NOT EXISTS madevi_notification_reads (
  notification_id uuid NOT NULL REFERENCES madevi_notifications(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(notification_id,user_id)
);
ALTER TABLE madevi_reports ADD COLUMN IF NOT EXISTS reference_url text;
ALTER TABLE madevi_reports ADD COLUMN IF NOT EXISTS image_webp bytea;
ALTER TABLE madevi_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved','spam'));
CREATE INDEX IF NOT EXISTS madevi_reports_user_time_idx ON madevi_reports(user_id,created_at) WHERE user_id IS NOT NULL;
ALTER TABLE madevi_content ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE madevi_content ADD COLUMN IF NOT EXISTS deleted_by text REFERENCES "user"(id);
CREATE TABLE IF NOT EXISTS madevi_social_profiles (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  bio text NOT NULL DEFAULT '' CHECK(length(bio)<=500),
  city_visibility text NOT NULL DEFAULT 'private' CHECK(city_visibility IN ('private','friends')),
  age_visibility text NOT NULL DEFAULT 'private' CHECK(age_visibility IN ('private','friends')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
