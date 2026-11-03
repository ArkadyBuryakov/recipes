# 0009. Source sidebar

**Status:** Accepted

## Context

Most recipe sites block iframes. You want YouTube embedded plus a link to it, other sites as links, photos as a preview, and plain text for sources without a URL.

## Decision

| `source.kind` | Rendering |
| --- | --- |
| `youtube` | Embedded player (`youtube-nocookie.com`) **+** a link that opens YouTube in a new tab (description/comments) |
| `web`, `social` | Link, opens in a new tab. No iframe attempt. |
| `photo` | Thumbnail. Tap opens a full-screen, zoomable preview. |
| `text` | Plain text (e.g. "Бабушка Палана") |
| no source | Section hidden |

- **Laptop:** a resizable right-hand sidebar next to the recipe, toggleable. Its state is remembered locally.
- **Phone:** a bottom sheet opened from a "Source" button. Collapsing it while a video plays keeps the video in a **floating mini player** (the player stays mounted, so playback isn't interrupted).
- No timestamp sync between steps and video.
- `kind` is auto-detected from the URL on write (YouTube, Instagram/TikTok → `social`, otherwise `web`) unless set explicitly.
