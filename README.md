# Business Forward · AI workshop

A static, interactive workshop presentation, ready for GitHub and Vercel.

## First two lessons

- `/`: Welcome, Day 2 schedule (10 October, 13:30–15:00), presenter LinkedIn, and lesson links.
- `/trace/`: Anatomy of a prompt — an animated real agent execution trace.
- `/caching/`: Agent bill & cache — animated token accounting, cache behavior, and guided step mode.

Original interactive content and datasets copied from the local Longevity Clinic website. Branding, local Source Sans 3 fonts, and cream/olive/yellow palette reused from the Business Forward questionnaire in Social Inno - Raiffeisen. The original source projects are unchanged. English, French, and Romanian content are retained from the source pages. Pricing examples remain illustrative source content, not a current price quote.

## Preview

Run `python -m http.server 8787 --directory public`, then visit http://localhost:8787.

## Edit

Page text and chapter content live in `public/specs/trace.json` and `public/specs/caching.json`. Navigation lives in `public/specs/site.json`. Theme overrides live in `public/workshop.css`; canvas colors live in the two chart modules. Run `python tools/build.py` after edits to regenerate the pages and asset hashes. No build step is needed on Vercel because generated pages are included.

## GitHub and Vercel

The GitHub repository is connected to the `business_forward_workshop` Vercel project. The Other framework preset builds the mentoring browser bundle with `npm run build`, serves `public`, and deploys the two Node API functions. The workshop remains static; only mentoring uses the database and authentication configuration below.

## Workshop controls

Use the two lesson tabs to move between pages. Play/pause, stop, chapter buttons, and timeline scrubbing are inherited from the original. The caching lesson also retains its guided steps. Use the fullscreen button for presenting. Animations begin only when requested; narrow screens stack the content vertically.

## Adding lessons

The shared engine is designed for additional chapter-based visualizations. Add a spec, page generation entry, and navigation item for each new lesson; custom visualization types belong under `public/engine/charts`.

## Workshop slide deck

The materials page at `/workshop/` links to the 16-slide presentation at `/presentation/`.
The viewer uses the original slide artwork and offers thumbnails, keyboard navigation,
swiping, zoom, and a download of the original PowerPoint. Like ROP's slide lightbox,
it rotates landscape slides 90 degrees in full-screen view on portrait phones
(up to 760px wide), then returns to normal when the phone is turned to landscape.
Swipe left/right to browse; rotated slides also support up/down swipes. Zoomed slides
pan instead of navigating. Escape closes full screen and restores focus.

To replace the current image-based deck, update its titles in
`tools/export_workshop_deck.py`, then run
`python tools/export_workshop_deck.py "path/to/deck.pptx"` (requires Pillow).
The exporter follows the PowerPoint's slide order, preserves its overlaid hyperlink,
and writes WebP slides, thumbnails, `slides.json`, and the original PowerPoint.
It rejects unsupported overlaid content so it cannot silently disappear.
Update the slide count and cover link in the HTML if the deck changes.

## Mentoring tracker

`/mentoring/` is public: each company starts with 600 minutes, and a standard meeting records 60 meeting minutes plus 60 follow-up minutes. Companies need no account. Public responses include company names, budgets, session dates/durations and a running timer. Private working notes, account/session data and audit records never appear in public responses. The page is marked `noindex`, which discourages indexing but does not make public data private.

Use **Mentor sign in** for `nicolas@agentic-sdlc.it`. The first visit uses **First visit or forgotten password?**, which requests an email code and lets the mentor choose a password. There is no default password. The account is pre-created in Neon Auth; server authorization checks its fixed user ID and email on every administrative request. Company users cannot register for editing through this app.

Mentor features: log/edit/remove named sessions, adjust budgets, start a persistent server timer and record it using editable meeting and follow-up durations. The 60 + 60 minute setup is a default; actual recorded time determines consumption, including follow-up-only work. Each company card shows a proportional segment for every session, ordered by completed date with planned work last, with date and duration details on hover, keyboard focus or tap. Remaining time stays pale; overruns keep all segments visible and are labelled separately. Public session names are separate from private working notes. Running time is visibly provisional until saved. The one-timer database constraint prevents overlapping timers. Client-generated entry IDs make saves retry-safe. Stale edits are rejected; removed entries are retained as voided records, with an audit trail. All dates use Europe/Bucharest. The public view polls every 20 seconds while visible, and indicates stale connections.

Neon project: `business-forward-mentoring` (`purple-hill-95472493`), AWS Frankfurt, production branch `br-young-surf-bawp7gkw`, database `mentoring`. Schema source: `database/mentoring.sql`, followed by `database/migrations/002_session_segments.sql` and `database/migrations/003_planned_sessions.sql`. Do not rerun these against an initialized database. Changes should use a new reviewed migration. The ten mentor-confirmed first-meeting and Bootcamp entries are documented in `database/imports/2026-10-13-confirmed-sessions.json`; `tools/import-confirmed-mentoring.mjs` imports them transactionally, audits their source, skips existing IDs and refuses to overwrite unrelated entries.

Vercel server variables (never include these in browser bundles):

- `DATABASE_URL`: pooled Neon connection string.
- `NEON_AUTH_BASE_URL`: managed Neon Auth endpoint.
- `MENTOR_USER_ID`: the pre-created mentor's ID.
- `APP_ORIGIN`: `https://businessforwardworkshop.vercel.app` (used to validate state-changing browser requests).

The same-origin auth proxy keeps managed sessions usable in browsers with third-party cookie restrictions and only forwards the login, session, logout and password-reset endpoints. The managed provider handles password hashing, email codes and rate limiting. Initial email delivery uses Neon's shared sender; a custom SMTP provider is recommended for dependable long-term password recovery. No email is sent during deployment.

Local development: `npm ci`, `npm run build`, then `npm run dev` (reads the ignored `.env.local`, serving port 8787). Static-only workshop previews can still use the Python command above. Run `npm test` for accounting, validation and response-redaction checks. Run `node --env-file=.env.local tests/mentoring-integration.mjs` for database-backed API checks; it uses temporary tables that disappear when the test connection closes, leaving production records untouched. Browser checks cover the public dashboard, login/error states, session forms and mobile layout. Live email-code/password onboarding must be completed by the account owner.

Programme update (14 October 2026): each company has 12 hours through 15 November, including 1h completed Business Discovery on 25 September and 1h reserved for a final pitch rehearsal with its date to be confirmed. Apply `tools/import-programme-milestones.mjs` once (retry-safe) after the planned-session migration and application deployment. Planned entries reduce available time but not completed totals; edit the same entry to Completed with its actual date to avoid charging twice. The earlier confirmed-session import remains an historical snapshot; subsequent mentor corrections are retained in the database audit.
