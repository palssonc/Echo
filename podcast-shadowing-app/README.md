# Echo — Podcast Shadowing

Echo is a static, installable web app for discovering podcast feeds and saving moments for language shadowing. Subscriptions, listening positions, clips, notes, favorites, and microphone recordings are stored in the browser's IndexedDB on this device.

## Run locally

Open this folder in a static web server. For example, from this directory run `python -m http.server 8000`, then open `http://localhost:8000`. The app needs HTTPS or localhost for PWA installation and microphone recording. Podcast discovery, RSS feeds, and audio playback need an internet connection.

## Publish on GitHub Pages

The repository-level workflow at `../.github/workflows/deploy-podcast-pages.yml` publishes this folder to GitHub Pages on pushes to `main` or `master`. Push this workspace to a GitHub repository, set the repository's Pages source to **GitHub Actions**, and push to the matching branch. GitHub Pages cannot be enabled from this workspace until a GitHub remote/repository is connected.

## Browser limits

Podcast audio is hosted by many independent publishers. The player attempts CORS-enabled playback so it can keep a short rolling audio buffer for one-tap clips. If a host blocks browser audio access, Echo falls back to normal playback and reports that clipping is unavailable for that episode. Feed import tries the feed directly, then a public CORS relay; that relay is an external service. Installability, background audio, and microphone behavior vary by browser and device.

## Local data

Echo does not create an account or send clip and recording data to a server. Clearing this browser's site data removes the local library. Saved audio uses WAV for broad browser support and can use substantial device storage.
