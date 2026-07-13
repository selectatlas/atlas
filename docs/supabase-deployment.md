# Supabase deployment and recovery

The files in `supabase/migrations/` are the canonical database source of truth, including the required Storage buckets and ownership policies. `supabase/schema.sql` is retained only as a historical reference and must not be applied to a new environment.

## Clean local verification

Docker Desktop must be running.

```bash
supabase start
supabase db reset
supabase test db
```

`supabase db reset` creates a clean local database and applies every migration in filename order. `supabase test db` then runs the pgTAP policy tests in `supabase/tests/`.

## Production deployment

Do not apply migrations until a current hosted backup is visible in the Supabase dashboard.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db diff --linked
supabase db push --dry-run
supabase db push
```

Review both diff commands before the final push. Never put the database password, access token, service-role key, or project reference into git.

### Existing projects created from `schema.sql`

The `000` migration represents objects that already exist in an older manually-created project. After confirming those core tables exist, mark only that baseline as applied so the additive compatibility migration can run:

```bash
supabase migration repair --linked --status applied 000
supabase db push --dry-run
```

If migrations 001–003 were also applied manually, compare their columns/tables first and repair their history individually before pushing. Do not use `--include-all` against an initialized database: it would try to recreate existing tables. Migration `004_messaging_security.sql` is deliberately additive and delivers the messaging fixes to an existing project.

## Rollback and recovery

Supabase migrations are forward-only. For a failed application deploy, roll the application back in Vercel first. For a destructive or incompatible database change:

1. Stop writes by enabling maintenance mode or rolling back the application.
2. Preserve logs and note the exact migration and time.
3. Restore the latest known-good backup into a separate project first.
4. Validate row counts and the hirer/talent smoke tests in the restored project.
5. Point a staging deployment at the restored project and verify it.
6. Promote or restore only after the verification succeeds.

Never test a restore by overwriting the only production project.
