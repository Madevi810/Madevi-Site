DROP TABLE IF EXISTS madevi_notification_reads;
DROP TABLE IF EXISTS madevi_notifications;
DROP INDEX IF EXISTS madevi_reports_user_time_idx;
ALTER TABLE madevi_reports DROP COLUMN IF EXISTS status;
ALTER TABLE madevi_reports DROP COLUMN IF EXISTS image_webp;
ALTER TABLE madevi_reports DROP COLUMN IF EXISTS reference_url;
DROP TABLE IF EXISTS madevi_social_profiles;
ALTER TABLE madevi_content DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE madevi_content DROP COLUMN IF EXISTS deleted_at;
