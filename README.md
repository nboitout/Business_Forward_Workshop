# Business Forward · AI workshop

A static, interactive workshop presentation, ready for GitHub and Vercel.

## First two lessons

- `/` or `/trace/`: Anatomy of a prompt — an animated real agent execution trace.
- `/caching/`: Agent bill & cache — animated token accounting, cache behavior, and guided step mode.

Original interactive content and datasets copied from the local Longevity Clinic website. Branding, local Source Sans 3 fonts, and cream/olive/yellow palette reused from the Business Forward questionnaire in Social Inno - Raiffeisen. The original source projects are unchanged. English and French content are retained from the source pages. Pricing examples remain illustrative source content, not a current price quote.

## Preview

Run `python -m http.server 8787 --directory public`, then visit http://localhost:8787.

## Edit

Page text and chapter content live in `public/specs/trace.json` and `public/specs/caching.json`. Navigation lives in `public/specs/site.json`. Theme overrides live in `public/workshop.css`; canvas colors live in the two chart modules. Run `python tools/build.py` after edits to regenerate the pages and asset hashes. No build step is needed on Vercel because generated pages are included.

## GitHub and Vercel

Create a GitHub repository with this folder's contents, then import that repository into Vercel. Select the Other framework preset. The included `vercel.json` sets `public` as the output directory, with no build command. Only the public folder is deployed. No environment variables or database are required.

## Workshop controls

Use the two lesson tabs to move between pages. Play/pause, stop, chapter buttons, and timeline scrubbing are inherited from the original. The caching lesson also retains its guided steps. Use the fullscreen button for presenting. Animations begin only when requested; narrow screens stack the content vertically.

## Adding lessons

The shared engine is designed for additional chapter-based visualizations. Add a spec, page generation entry, and navigation item for each new lesson; custom visualization types belong under `public/engine/charts`.
