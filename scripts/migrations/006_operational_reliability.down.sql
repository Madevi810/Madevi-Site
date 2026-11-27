ALTER TABLE madevi_reports DROP COLUMN request_id, DROP COLUMN request_signature;
ALTER TABLE madevi_operations DROP COLUMN progress_at;
DROP INDEX madevi_operations_routine;
DROP TABLE madevi_message_requests;
DROP INDEX madevi_support_posts_thread;
ALTER TABLE madevi_support_posts DROP COLUMN event_order;
CREATE INDEX madevi_support_posts_thread ON madevi_support_posts(thread_id,created_at DESC,id DESC);
