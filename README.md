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

Create a GitHub repository with this folder's contents, then import that repository into Vercel. Select the Other framework preset. The included `vercel.json` sets `public` as the output directory, with no build command. Only the public folder is deployed. No environment variables or database are required.

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
