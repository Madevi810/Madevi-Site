-- Dedicated Madevi database. Provision distinct LOGIN roles outside this file.
-- Required psql variables: migrator (table owner), runtime (web/message dispatch).
-- Optional distinctly provisioned LOGIN roles: backup, operations, maintenance.
-- Run as the database owner able to administer these roles. Apply again after migrations.
\set ON_ERROR_STOP on
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO :"migrator";
GRANT USAGE ON SCHEMA public TO :"runtime";
REVOKE CREATE ON SCHEMA public FROM :"runtime";
-- Remove default broad grants made by older templates. Future tables need explicit grants.
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public REVOKE ALL ON TABLES FROM :"runtime";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"runtime";
SELECT to_regclass('public.madevi_email_change_proof') IS NOT NULL AS security_tables_exist \gset

\if :security_tables_exist
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"runtime";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"runtime";
GRANT SELECT, INSERT ON "user" TO :"runtime";
GRANT UPDATE (name,email,"emailVerified","updatedAt",image,username,"displayUsername","twoFactorEnabled","birthDate",city,phone,
  suspended,restriction,restricted_until) ON "user" TO :"runtime";
GRANT SELECT, INSERT, UPDATE, DELETE ON "session","verification","twoFactor", "account" TO :"runtime";
GRANT SELECT, INSERT, DELETE ON madevi_email_change_proof TO :"runtime";
GRANT SELECT, INSERT ON madevi_audit,madevi_security_events,madevi_report_events,madevi_site_history,
  madevi_content_revisions,madevi_moderation_events,madevi_revision_files,madevi_support_posts,
  madevi_notification_reads,madevi_notifications,madevi_message_requests TO :"runtime";
GRANT SELECT, INSERT, UPDATE ON madevi_content,madevi_reports,madevi_rate_limits,madevi_support_threads,
  madevi_social_profiles,madevi_information_pages,madevi_website_settings,madevi_message_jobs,
  madevi_support_rules,madevi_support_availability,madevi_monitor_buckets,madevi_worker_status TO :"runtime";
GRANT SELECT, INSERT, UPDATE, DELETE ON madevi_avatars,madevi_media_variants,madevi_message_templates TO :"runtime";
GRANT SELECT, INSERT, DELETE ON madevi_library TO :"runtime";
GRANT UPDATE (publication_reviewed_at,publication_reviewed_by) ON madevi_library TO :"runtime";
GRANT SELECT ON madevi_schema_migrations,madevi_operations,madevi_operations_health,madevi_monitor_incidents TO :"runtime";
GRANT INSERT (id,kind,artifact,requested_by,parameters,retry_of) ON madevi_operations TO :"runtime";
GRANT USAGE ON madevi_audit_id_seq,madevi_security_events_id_seq,madevi_reports_id_seq,madevi_report_events_id_seq,
  madevi_moderation_events_id_seq,madevi_support_event_order TO :"runtime";
\endif

-- pg_dump reads the whole database including private data and sequences.
\if :{?backup}
GRANT USAGE ON SCHEMA public TO :"backup";
REVOKE CREATE ON SCHEMA public FROM :"backup";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public GRANT SELECT ON TABLES TO :"backup";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public GRANT SELECT ON SEQUENCES TO :"backup";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"backup";
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO :"backup";
\endif

\if :security_tables_exist
\if :{?operations}
GRANT USAGE ON SCHEMA public TO :"operations";
GRANT SELECT (id,"madeviRole","twoFactorEnabled","isDemo",suspended,restriction,restricted_until) ON "user" TO :"operations";
GRANT SELECT (id,"userId","expiresAt","createdAt","madeviActiveAt","madeviMfa") ON "session" TO :"operations";
GRANT SELECT,INSERT,UPDATE ON madevi_operations,madevi_operations_health,madevi_monitor_incidents TO :"operations";
GRANT SELECT ON madevi_schema_migrations,madevi_worker_status TO :"operations";
GRANT INSERT ON madevi_audit TO :"operations";
GRANT USAGE ON madevi_audit_id_seq TO :"operations";
\endif
\if :{?maintenance}
GRANT USAGE ON SCHEMA public TO :"maintenance";
GRANT SELECT,DELETE ON madevi_rate_limits,madevi_monitor_buckets TO :"maintenance";
GRANT SELECT (id,kind,status,finished_at,artifact) ON madevi_operations TO :"maintenance";
\endif
\endif
