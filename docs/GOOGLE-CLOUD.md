# Gemini Omni through Google Cloud

Existing gcloud OAuth is used with jerserio-project, global, gemini-omni-1.1-flash-preview. Billing/API enablement, metadata, token counting and real video generation succeeded. Tokens stay in process memory, never printed/saved/sent to visitors. The website serves local media only.

Run node scripts/omni-cloud.js to check the connection. Paid generation requires --generate, an explicit --version and a --max-estimated-usd guard. --duration=8 and --prompt=docs/INTRO-WATCH-V2.txt select the eight-second watch prompt. --image selects image-to-video; --video selects editing. Edit requests omit aspect ratio as required by the API. Only one reference input is allowed. Existing output versions are refused before authentication/generation. No automatic paid retry occurs; the guard is an estimate, not a billing cap.

The active film combines cleaned watch-v3 with outlet-v2, generated from watch-v2's final frame. Watch-v2, outlet-v2 and the focused watch-v3 edit were three successful requests. An initial edit request returned HTTP 400 for aspect ratio; the corrected request completed. Watch-v3 retained tiny invented glyphs, removed locally afterward. The earlier v1 remains rejected/unserved. Status records preserve usage without credentials.

This revision's usage estimates: watch-v2 $1.2192915, outlet-v2 $1.222506, watch-v3 $1.290414, total $3.7322115. Earlier v1 $1.5243075, cumulative $5.256519. Rates used: input $1.50/million, thought/text output $9/million, video output $17.50/million. Credits, tax, currency and invoice amounts remain unverified. Local compression/cleanup/playback make no Cloud requests.

Sources: [Omni model](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-1-flash), [Text video generation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-text), [Image video generation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-an-image), [Interactions reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/interactions-api), [Pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing).

