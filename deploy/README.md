# Dashboard data correction — 2026-11-10

Deploy backend and frontend together. The effort matrix now represents students without quiz answers with `performance: null` and reports `unassessedCount`; they are excluded from performance averages and quadrants. Genuine 0% remains an assessed result.

All dashboard cards show the full history using the existing entity selectors; no date controls are added. When optional dates are supplied to the API, calendar dates use UTC day boundaries, with the entire end date included. Session usage and chat classifications are scoped by session start; quiz performance and journey are scoped by answer/attempt timestamp. A session is attributed to its start day in full, including sessions ending the following day. Discipline performance uses professor quiz answers, while usage is the usage of students in the linked classes.

`0003_reconcile_usage_totals.sql` updates only `user_analyses.total_usage_time`, deriving it from the recorded closed session durations. Back up the database before migrating. Original sessions, quiz answers, and timestamps are preserved. Long historical sessions remain recorded durations; these represent elapsed session time and must not be interpreted as measured active attention. Run `npm run db:migrate:prod` before starting the new backend. Repeating migration execution is safe through the migration journal.

Login and logout share one atomic session-close-and-accumulate statement. An already closed session contributes no additional time, including simultaneous calls.

## API TLS origin

The frontend uses same-origin `/api`. The standalone API hostname also needs its own Nginx vhost and a certificate covering `api.saellogibot.com`; the root-domain certificate alone does not cover it.

1. Back up the existing Nginx configuration. Bootstrap an HTTP-only `api.saellogibot.com` server with `location ^~ /.well-known/acme-challenge/ { root /var/www/letsencrypt; }` and a backend proxy for other requests. Create `/var/www/letsencrypt`, validate with `nginx -t`, and reload Nginx.
2. Issue its certificate with `certbot certonly --webroot -w /var/www/letsencrypt -d api.saellogibot.com --non-interactive` using the existing ACME account.
3. Install `nginx-api.conf` as the enabled API vhost, run `nginx -t`, and reload. Keep the challenge location for renewal and a Certbot deploy hook that reloads Nginx after successful renewal.
4. Verify public HTTPS health checks on both `https://saellogibot.com/api/health/simple` and `https://api.saellogibot.com/health/simple`.

## Validation

- Backend Jest tests and TypeScript build.
- Frontend unit tests, production build and i18n checks.
- Desktop/mobile browser regressions: administrator without school, actual restored topic labels, full history without hidden date filters, valid zero score, unassessed matrix, and dashboard accessibility in Portuguese, English and Spanish.
- Isolated PostgreSQL restored from the original backup: all four IFPA scopes; summary totals equal daily session sums; out-of-period cards are empty; inclusive end date; reconciliation; concurrent/idempotent session close.
- After production migration, compare totals and session sums and repeat authenticated read-only endpoint checks. Do not create fictitious quiz answers for students without assessments.

The proficiency radar uses the topics from published quizzes and the historical answer topics in the selected course/university (or discipline). The axes remain visible for students without answers. `data: null` means unassessed, while numeric `0` is a real 0% result; only assessed subjects contribute to the average. The score formula is available in the information popover.
