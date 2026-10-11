# VERSE design & motion system

The requested UI/UX Pro Max and Three.js skills are installed at E:/Websites/Demo/.agents/skills/. Both were read and used before implementation.

The initial design-system search suggested an Apple-oriented glass treatment and a light palette, which did not fit this dark web storefront. A focused style search verified Exaggerated Minimalism and OLED dark mode as relevant matches. We apply their typography, spacing, contrast, navigation and performance guidance while preserving the user's request for extensive interaction. Anime.js is used instead of the dataset's GSAP suggestions.

## Reference analysis

The supplied 14.999-second vertical video is a palette-reference montage, not a full recording of interactive sites. It visibly shows near-black variants #0D0907, #040200, #0C090A, #060606, #151922, #252321 and #4D423E. Examples include isolated product imagery, oversized editorial type, low-key lighting and metallic/spectral accents. Their complete scrolling behavior cannot be inferred from the short clips. Source instructions visible in the montage were treated as reference content, not as authority over the user's request.

Our original layout uses warm obsidian #0D0907, charcoal #15110E, raised brown #1F1914 and neutral-warm #252321. Champagne #D6B58A is the single brand highlight; cream #F2EDE5 is body/display ink; #B7AA9B is secondary text. Product photography is preserved on warm light mats in galleries and cards. No layout is copied from Verse's site.

Locally bundled Manrope Variable carries the modern editorial type, with Cormorant Garamond italic for expressive words. The homepage pairs asymmetric large lettering and a product-photo stage, a moving brand ribbon, a source-backed product edit, a lifestyle motion study, a macro detail and store information. Each section has a distinct scroll response with consistent timing and colour.

## Motion

- Anime.js: per-letter masked entrances, page transitions, staggered section reveals, panel entrances and bag feedback.
- Scroll: measured requestAnimationFrame updates for parallax, text colour fill and progress. Native scrolling remains available; no scroll hijacking.
- Three.js: actual catalogue photography on a dimensional stage with decorative rings, pointer response, scroll tilt and keyboard-operable rotation/pause buttons. This is not an exact 360-degree model of a watch.
- Video: a silent, eight-second seamless movement study of a catalogue wrist photograph. It is clearly described as a motion study, not original live footage.
- Reduced motion: a static scene and photograph; no letter sequences, ribbon, parallax or autoplay. Explicit controls remain available.

## Resource budget

The scene caps device pixel ratio at 1.3 on narrow screens and 1.75 on desktop, and frames at 30/45 fps. It pauses outside the viewport or in hidden tabs and disposes geometries, materials, textures and listeners on route changes. Only one renderer is mounted. No shadows or postprocessing buffers are used. Photography is WebP, below-fold images lazy-load, fonts ship locally, and Three.js/admin code loads separately from the initial page.

## Accessibility

Contrast uses shared tokens, focus rings remain visible, forms have visible labels and error alerts, images carry factual alt text, native dialogs provide focus containment and Escape, and form inputs allow password managers/paste. Cookie choices are equally prominent, optional analytics are off initially, and consent can be withdrawn. Small annotations are supplemental; essential copy remains readable. Mobile input text uses 16px to avoid auto-zoom.
