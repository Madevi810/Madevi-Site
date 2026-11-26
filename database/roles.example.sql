-- psql template for a dedicated Madevi database. Provision two LOGIN roles in
-- the provider dashboard first; passwords are supplied outside this file.
-- Run as the database owner with authority to set the migration role.
-- Required psql variables: migrator and runtime (role names).
\set ON_ERROR_STOP on
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO :"migrator";
GRANT USAGE ON SCHEMA public TO :"runtime";
REVOKE CREATE ON SCHEMA public FROM :"runtime";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"runtime";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"runtime";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"runtime";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"runtime";
SELECT to_regclass('public.madevi_schema_migrations') IS NOT NULL AS migration_table_exists \gset
\if :migration_table_exists
REVOKE INSERT, UPDATE, DELETE ON public.madevi_schema_migrations FROM :"runtime";
\endif
