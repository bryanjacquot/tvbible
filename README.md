# Google TV Bible Reader (`tvbible`)

A lightweight, zero-scroll, two-column Bible reader designed specifically for **Google TV browsers** (TV Bro, BrowseHere, JioSphere, Chrome on Android TV) and hosted on a **Synology NAS** in Container Manager on port `3003`.

## Features

- **Open-Book Two-Column Spread**: Verses flow cleanly down the left column and continue down the right column with zero vertical scrolling and no bottom status clutter.
- **TV Remote D-Pad Navigation**:
  - `Left` / `Right` arrows flip to the previous or next two-column spread.
  - Reaching the end of a chapter automatically moves to **Chapter + 1, Verse 1**; reaching the end of a book moves to **Chapter 1, Verse 1 of the next book** (and symmetrically in reverse with `Left`).
  - `Up` arrow moves focus to the top selector bar; `Down` arrow (or `Back`/`Esc`) returns to reading.
- **Live-Synced Top Selector Bar**: Displays and updates **Translation**, **Book**, **Chapter**, and **Verse** span on every page turn, backed by fast 2D grid modals (`<dialog>`) for effortless remote selection.
- **`localStorage` Resume**: Automatically saves and restores your exact translation, book, chapter, verse, text scale, and light/dark theme.
- **Translations**:
  - **API.Bible (`https://rest.api.bible/v1`)**: Configure `API_BIBLE_KEY` in `.env` to load your licensed translations (**NIV**, **NKJV**, **NLT**, etc.), proxied securely by the container backend.
  - **Pre-bundled Open-Source Bibles (Offline)**: Includes **BSB** (Berean Standard Bible), **WEB** (World English Bible), **KJV** (King James Version), and **ASV** (American Standard Version) out of the box.

---

## Deploying on Synology NAS (Container Manager)

1. Copy this project folder to `/volume1/docker/tvbible` on your Synology NAS.
2. Copy `.env.example` to `.env` and set your `API_BIBLE_KEY` (and optional `API_BIBLE_IDS` / `NLT_API_KEY`).
3. Open **Synology DSM → Container Manager → Project → Create**:
   - **Project Name**: `tvbible`
   - **Path**: `/volume1/docker/tvbible`
   - Choose **Use existing docker-compose.yml** and build/start the project.
4. On your Google TV browser, open `http://<your-synology-ip>:3003`.

---

## Local Development & Testing

```bash
# Start server on http://localhost:3003
npm start

# Run automated test suite
npm test
```

