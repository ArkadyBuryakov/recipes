# 0009. Source sidebar

**Status:** Accepted

## Context

Most recipe sites block iframes. You want YouTube, TikTok, Instagram and Facebook videos embedded with a link to the original, other sites as links, photos as a preview, and plain text for sources without a URL.

## Decision

| `source.kind` | Rendering |
| --- | --- |
| `youtube` | Embedded player (`youtube-nocookie.com`) **+** a link that opens YouTube in a new tab (description/comments) |
| `social`: TikTok video, Instagram reel/post, Facebook video/reel | Embedded player (`tiktok.com/player/v1/<id>`, `instagram.com/reel/<code>/embed/`, `facebook.com/plugins/video.php?href=…`), shown vertically (Facebook: reels only), **+** an "Open on …" link |
| `web`, other `social` | Link, opens in a new tab. No iframe attempt. Short share links (`vm.tiktok.com`, `fb.watch`, `facebook.com/share/r|v/…`) are resolved on save (see below); if that fails they stay links. |
| `photo` | Thumbnail. Tap opens a full-screen, zoomable preview. |
| `text` | Plain text (e.g. "Бабушка Палана") |
| no source | Section hidden |

- **Laptop:** a resizable right-hand sidebar next to the recipe, toggleable. Its state is remembered locally.
- **Phone:** a bottom sheet opened from a "Source" button. Collapsing it while a video plays keeps the video in a **floating mini player** (the player stays mounted, so playback isn't interrupted).
- No timestamp sync between steps and video.
- `kind` is auto-detected from the URL on write (YouTube, Instagram/TikTok → `social`, otherwise `web`) unless set explicitly.
- Short share links hide the video id behind a redirect. On every recipe write, `RecipeService` follows the redirect once (`server/recipes/short-links.ts`, 5 s timeout, no user-agent spoofing) and stores the canonical video URL without tracking params. On failure the original URL is kept.
- The embed URL is derived from `source.url` by `videoEmbed()` (`shared/recipe.ts`), nothing extra is stored. If the post has been deleted or made private, the provider's own "unavailable" page shows in the frame, and the link is still there.
- TikTok shows its own cookie prompt inside the player on first play. It's the provider's frame, so the site can't answer it.
