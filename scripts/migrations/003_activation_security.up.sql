CREATE INDEX madevi_google_account_subject_idx ON "account" ("accountId", "userId") WHERE "providerId" = 'google';
