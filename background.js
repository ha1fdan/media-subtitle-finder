// background.js (Manifest V2)
// Keeps a per-tab list of detected media/subtitle resources.
// Supports cross-domain, XHR/fetch, and optional HLS segment detection.

// Memory store: tabId -> [ { url, contentType, method, status, type, time } ]
const found = {};

// Decide if this request looks like a manifest/subtitle or (optional) HLS segment
function isInteresting(url, contentType, includeSegments, includeSubtitles) {
    if (!url) return false;
    const bare = url.split("#")[0].split("?")[0].toLowerCase();

    // Manifests
    if (bare.endsWith(".mpd") || bare.endsWith(".m3u8")) return true;

    // Subtitles
    if (includeSubtitles && (
            bare.endsWith(".vtt") ||
            bare.endsWith(".srt") ||
            bare.endsWith(".ttml") ||
            bare.endsWith(".dfxp")
        )) return true;


    // Optional: segments (TS, CMAF)
    if (includeSegments && (bare.endsWith(".ts") || bare.endsWith(".m4s"))) return true;

    // Fallback on content-type headers
    const ct = (contentType || "").toLowerCase();
    if (ct.includes("application/dash+xml")) return true;
    if (includeSubtitles && (
            ct.includes("vtt") ||
            ct.includes("subtitle") ||
            ct.includes("ttml")
        )) return true;

    if (includeSegments && (ct.includes("video/mp2t"))) return true;

    return false;
}

// Record a found resource for the tab
function record(details) {
    const tabId = details.tabId;
    if (typeof tabId !== "number" || tabId === -1) return; // not a tab-associated request

    // Read content-type from response headers
    const headers = details.responseHeaders || [];
    const ctHeader = headers.find(h => h.name && h.name.toLowerCase() === "content-type");
    const contentType = ctHeader ? ctHeader.value : "";

    // Read extension settings from storage (includeSegments flag)
    browser.storage.local.get({ includeSegments: true, includeSubtitles: true }).then(prefs => {
        const includeSegs = !!prefs.includeSegments;
        const includeSubs = !!prefs.includeSubtitles;
        if (!isInteresting(details.url, contentType, includeSegs, includeSubs)) return;

        if (!found[tabId]) found[tabId] = [];

        const entry = {
            url: details.url,
            contentType,
            method: details.method,
            status: details.statusCode,
            type: details.type,
            time: Date.now()
        };

        // Avoid duplicates in immediate succession
        const arr = found[tabId];
        const last = arr[arr.length - 1];
        if (!last || last.url !== entry.url) {
            arr.push(entry);
            // keep a small rolling history
            if (arr.length > 500) arr.splice(0, arr.length - 500);
        }

        // Notify popup (if open)
        browser.runtime.sendMessage({ type: "update", tabId, entry }).catch(() => {});
    });
}

// Provide data / actions to popup
browser.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || !msg.type) return;

    if (msg.type === "getList") {
        const tabId = msg.tabId;
        const list = (found[tabId] || []);
        return Promise.resolve({ list });
    }

    if (msg.type === "clearList") {
        const tabId = msg.tabId;
        if (found[tabId]) found[tabId] = [];
        return Promise.resolve({ ok: true });
    }

    if (msg.type === "setPrefs") {
        return browser.storage.local.set({
            includeSegments: !!msg.includeSegments,
            includeSubtitles: !!msg.includeSubtitles
        });
    }

});

// Clean up when tabs close
browser.tabs.onRemoved.addListener(tabId => {
    delete found[tabId];
});

// Track requests (response headers so we can check Content-Type)
// Include XHR/fetch/cross-domain etc.
browser.webRequest.onCompleted.addListener(
    record, { urls: ["<all_urls>"], types: ["main_frame", "sub_frame", "xmlhttprequest", "media", "other"] }, ["responseHeaders"]
);