# Media & Subtitles Finder (Firefox Extension)

This Firefox extension shows all **MPD, M3U8 (manifests)** and **subtitle files (VTT, SRT, TTML, DFXP, etc.)** detected in the **network traffic of the current tab**.

Useful for finding media URLs from streaming websites.

---

## ✅ Features
- Monitors network requests in the current tab
- Detects:
  - `.mpd`, `.m3u8`
  - `.vtt`, `.srt`, `.ttml`, `.dfxp`, etc.
  - Or matching `Content-Type` header
- Shows list in popup with:
  - URL
  - Content-Type
  - Method, Status, Time
- Open or Copy URL with one click

---

## 📦 Installation (Temporary/Development)
1. Open `about:debugging` in Firefox
2. Click **"This Firefox"**
3. Click **"Load Temporary Add-on..."**
4. Select `manifest.json`
