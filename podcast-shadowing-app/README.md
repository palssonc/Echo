# Echo — Podcast Shadowing

Echo is a static, installable web app for discovering podcast feeds and saving moments for language shadowing. Subscriptions, listening positions, clips, notes, favorites, and microphone recordings are stored in this browser's IndexedDB. Episode downloads use the browser's private file storage when available, with IndexedDB as a fallback. Open **Downloads** in the bottom navigation to check progress, cancel a download, play a saved episode, or remove it. The player labels downloaded playback separately from streaming.

While playing an episode, jump back 5 seconds to prepare for a phrase. Tap **Start clip** at the first word, then **End clip** at the last. Clips save with their exact selected length and stop automatically at 45 seconds. Seeking or changing playback speed while marking a clip cancels it.

## Run locally

Open this folder in a static web server. For example, from this directory run `python -m http.server 8000`, then open `http://localhost:8000`. The app needs HTTPS or localhost for PWA installation and microphone recording. Podcast discovery, RSS feeds, and audio playback need an internet connection.

## Publish on GitHub Pages

The repository-level workflow at `../.github/workflows/deploy-podcast-pages.yml` publishes this folder to GitHub Pages on pushes to `main` or `master`. The live site is [Echo on GitHub Pages](https://palssonc.github.io/Echo/). The repository's Pages source is GitHub Actions.

## Browser limits

Podcast audio is hosted by many independent publishers. The player attempts CORS-enabled playback so it can keep a short rolling audio buffer for one-tap clips. If a host blocks browser audio access, Echo falls back to normal playback and reports that clipping is unavailable for that episode. Downloads also require the podcast host to allow browser CORS requests; the app reports when a host blocks a download. Clips from an episode already saved in Downloads use the local file and can work even when the host blocks browser capture of its stream. Feed import tries the feed directly, then a public CORS relay; that relay is an external service. Installability, background audio, and microphone behavior vary by browser and device.

## Local data

Echo does not create an account or send clip, recording, or downloaded episode data to a server. Clearing this browser's site data removes the local library and offline downloads. Saved episode audio can use substantial device storage.
