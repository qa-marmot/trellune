# Local D1 data

`migrations/0001_initial.sql` is the authoritative schema. `seed.sql` contains only synthetic local-development data. Wrangler's local D1 files must remain untracked.

Apply migrations before the seed. Never run this seed against a remote or production database.
