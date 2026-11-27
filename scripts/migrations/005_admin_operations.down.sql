DROP TABLE madevi_monitor_incidents, madevi_monitor_buckets;
DROP TABLE madevi_support_posts, madevi_support_threads, madevi_support_availability;
ALTER TABLE madevi_library DROP COLUMN byte_size;
ALTER TABLE madevi_library DROP CONSTRAINT madevi_library_mime_type_check;
ALTER TABLE madevi_library ADD CONSTRAINT madevi_library_mime_type_check CHECK(mime_type='image/webp');
DROP TABLE madevi_site_history, madevi_operations_health;
DROP INDEX madevi_operations_queue, madevi_operations_recent, madevi_operations_backups;
ALTER TABLE madevi_operations DROP CONSTRAINT madevi_operations_kind_check, DROP CONSTRAINT madevi_operations_status_check;
ALTER TABLE madevi_operations DROP COLUMN requested_at, DROP COLUMN requested_by, DROP COLUMN parameters, DROP COLUMN retry_of, DROP COLUMN phase;
ALTER TABLE madevi_operations ALTER COLUMN started_at SET DEFAULT now(), ALTER COLUMN started_at SET NOT NULL;
ALTER TABLE madevi_operations ADD CONSTRAINT madevi_operations_kind_check CHECK(kind IN ('backup','restore')),
  ADD CONSTRAINT madevi_operations_status_check CHECK(status IN ('running','completed','failed'));
