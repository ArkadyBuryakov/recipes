# 0010. Kitchen features: wake lock, timers, offline

**Status:** Accepted

## Context

Wanted: screen wake lock, timers from steps (several running at once), push notifications when timers end, large touch targets, and an offline PWA. A web app can't set the OS timer, so timers are in-app (round-2 G2).

## Decision

### Wake lock
- Screen Wake Lock API while a recipe page is open. Re-acquired on `visibilitychange`.

### Timers
- Explicit `{{timer:20m}}` tokens in step text become tappable chips. Nothing is parsed from prose.
- A floating tray shows all running timers (pause, +1 min, cancel). Each timer's end timestamp is kept in localStorage, so it survives reload and screen lock.
- **Push notifications:** when the screen is locked, a page can't run JS, and local scheduled notifications aren't available on the web. So timers use **server-sent Web Push**:
  - The device subscribes with VAPID keys (anonymous, no account needed).
  - Starting a timer sends `POST /api/timers {subscription, endsAt, label}`. The server keeps a small in-process scheduler, backed by a `timers` table so it survives restarts, and sends the push at `endsAt`.
  - Cancel, pause, or extend updates or deletes the row.
  - Rows are deleted after firing. Expired subscriptions are pruned.
  - **iOS needs the PWA installed** to the Home Screen (iOS 16.4+). The UI explains this when permission is requested on iOS Safari.
- **Alert settings** (localStorage): sound on/off (a generated three-tone chime), vibration on/off, and "ring until dismissed" vs a single chime. These apply to the in-page alert. The push notification uses the OS default sound.
  - The service worker always shows the notification, even if the app looks open: iOS can report a locked, frozen app as visible, and it revokes the subscription of a worker that receives a push without showing one. Timer settings has a "Test notification" button (a push 5 s later) to check the whole chain.
  - `VAPID_SUBJECT` must be a real `mailto:` or `https:` address; Apple's push service rejects placeholder subjects.
  - Push is opt-in. While a timer runs with push off, the tray offers to turn it on (dismissible), because a locked phone can't alert any other way. Timers already running when push is enabled get scheduled too.
  - Browsers only allow audio after a user gesture, and iOS suspends the AudioContext when the screen locks. So any tap resumes the audio, it's retried when the page becomes visible, and the chime waits for the resume rather than queueing on a stopped clock. While ringing, iOS's `navigator.audioSession` is set to `playback` so the chime plays through the silent switch; it goes back to `auto` afterwards. iPhone has no vibration API, so that setting is hidden there.

### Touch
- At least 48 px interactive elements in prep and cook mode, and a full-row tap area for checkboxes.

### Offline (PWA)
- Hand-written service worker (`public/sw.js`), registered in production builds only.
- On each visit the worker fetches `/api/offline` and, when its version changed, caches **every published recipe page**
  in both languages (SSR HTML + React Router `.data`), the JS/CSS assets they reference, and cover thumbnails (Cache Storage).
- Pages are network-first (5 s timeout) with cache fallback; assets and images are cache-first. An offline banner is shown.
  Editing requires being online.
- **Installable** (Add to Home Screen): `standalone` manifest with a separate full-bleed maskable icon, an opaque
  180 px `apple-touch-icon` (iOS paints transparency black) and the iOS `apple-mobile-web-app-*` meta tags. The app
  starts at `/`, a server redirect, so offline the worker redirects it to the cached `/ru` or `/en` instead.
  The home page offers "Install on your phone": Chrome's native prompt (`beforeinstallprompt`) or, on iOS Safari,
  which has no install API, the Share → Add to Home Screen steps. Hidden when already running standalone.

## Consequences

- VAPID keys go into env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- A test matrix is needed for iOS Safari, the installed iOS PWA, Android Chrome, and desktop.
