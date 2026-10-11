# VERSE cinematic entrance delivery

## Delivered sequence

The Watch storefront now plays reviewed Gemini Omni Flash footage on first home entry: official symbol and VERSE on black, components assembling from the right, frontal rotation, dial zoom, boutique construction, glass doors opening, and the official symbol with VERSE beneath on the central wall. Anime.js dissolves into the homepage. The full film is 19.5 seconds, silent, 1920×1080. Website playback uses an 18-second local story plus HTML branding and opening identity.

The watch and boutique are original cinematic concepts, not representations of a stocked model or an actual VERSE branch. This is disclosed in the entrance. Commerce/product/business data remain database-backed. No fabricated reviews, awards, inventory or business claims were added.

## Generation and inspection

Authenticated Cloud project: jerserio-project, global Interactions API, actual model gemini-omni-1.1-flash-preview. Two eight-second shots were generated. The outlet used the watch's final frame as an image reference. A focused Omni video edit retained tiny nonsensical dial glyphs; local tracked OpenCV video inpainting removed them beside six. Raw Cloud renders remain preserved. FFmpeg joins/compresses/strips audio; official branding is locally composited to avoid generative spelling errors.

The earlier v1 render remains rejected for invented manufacturer lettering. Watch v2 was superseded after closer inspection. Accepted sources: docs/reference/verse-assembly-omni.watch-v3-clean.mp4 and verse-assembly-omni.outlet-v2.mp4. Contact sheets, full-resolution review frames, prompts, usage and production records are preserved under docs/reference and docs/INTRO-*.txt.

## Playback and accessibility

Desktop uses a compressed 1080p MP4; mobile uses a 720×1280 center crop. Files are local, silent and fast-start; only the selected variant loads. Portrait framing favors the watch and doors, with peripheral components/display cases outside the crop. Timing follows decoded video progress, buffering and pause. The exact logo is a separate HTML layer.

Skip, Escape, pause and footer replay remain available. Focus is contained/restored; underlying content is inert only during the intro. Reduced-motion/data-saving preferences bypass it. Internal navigation, direct links and repeated entry in the tab bypass it. The session preference stores only watch-outlet-v2, disclosed in database privacy/cookie policies version 2026-10-09.3. Failed video uses lazy Three.js assembly; failed WebGL uses a source product photograph. Pause/hidden states suspend playback/rendering; resources are disposed on exit. Homepage WebGL mounts afterward.

## Files and reproduction

- src/intro.js and src/intro.css: controls, timing, transitions and branding.
- scripts/omni-cloud.js: explicit versioned generation, text/image/video input, OAuth in memory, no automatic paid retries.
- scripts/clean-omni-dial.py: local tracked video cleanup; requires OpenCV/NumPy and FFmpeg.
- scripts/prepare-omni-intro.js: reviewed sources to master, desktop/mobile, poster and full branded film; requires FFmpeg and installed Chrome.
- scripts/activate-omni-intro.js: reviewed asset manifest and presentation disclosure.
- public/media/intro/manifest.json: active omni-video, version watch-outlet-v2.
- public/media/intro/verse-full-intro.v2.mp4: completed film for preview/export.
- tests/browser/intro.spec.js: decoded video phases, outlet/reveal, controls, failures/preferences.

Preparation/activation do not call Cloud. Review records must approve sources before production preparation. Review and activation scripts require actual visual inspection, not automatic acceptance.

## Costs and limits

This revision's three successful requests estimate $3.7322115 before credits/currency/tax from reported tokens. Including earlier rejected v1: $5.256519. These are estimates, not invoices; credit balance/grant coverage remain unverified. Visitors make no AI/external service calls and receive no credentials.

The preview model can introduce mechanical/continuity artifacts; this is an artistic sequence, not a manufacturing demonstration. Physical mobile devices, Safari and Firefox were not tested. Existing business verification and MySQL/phpMyAdmin launch requirements remain in the main audit. The lazy Three.js core retains its existing size warning; normal video playback does not load the intro fallback scene.

## Validation

Production build passed. Source/contact-sheet review covered assembly, frontal zoom, shot continuity, architectural build, doors, portrait crop and exact branding. Browser results are recorded below after execution. Automated accessibility checks are not certification.


Final validation: eight Playwright Chrome checks passed (1.3 minutes), including the eight-route desktop/mobile accessibility sweep, full decoded video assembly/outlet/reveal, pause/skip/Escape/replay, tab-session behavior, video/WebGL failures, reduced motion, consent and role flows. Fifteen commerce/API tests passed. No page errors or external runtime requests were observed in the full intro test. Desktop outlet/reveal and mobile reveal screenshots were visually inspected. The initial browser run encountered only connection refusal because the prior preview had stopped; after restarting the production server, the full suite passed.

Final media sizes: desktop story 6,002,183 bytes; portrait story 2,416,650 bytes; full branded export 6,784,110 bytes; poster 27,206 bytes. Preview runs locally at http://127.0.0.1:3000. No public deployment was performed.
