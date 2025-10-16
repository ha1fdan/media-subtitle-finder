// popup.js
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const filterDomainEl = document.getElementById("filterDomain");
const includeSegmentsEl = document.getElementById("includeSegments");
const includeSubtitlesEl = document.getElementById("includeSubtitles");
const domainBadge = document.getElementById("domain");
const copyAllBtn = document.getElementById("copyAll");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

let activeTab = null;
let activeDomain = "";

function sameDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname === activeDomain;
    } catch { return false; }
}

function renderList(items) {
    listEl.innerHTML = "";
    const filtered = items.slice().reverse().filter(it => {
        if (filterDomainEl.checked) return sameDomain(it.url);
        return true;
    });

    if (filtered.length === 0) {
        emptyEl.style.display = "block";
        return;
    }
    emptyEl.style.display = "none";

    for (const it of filtered) {
        const el = document.createElement("div");
        el.className = "item";

        const info = document.createElement("div");
        info.style.flex = "1";

        const url = document.createElement("div");
        url.className = "url";
        url.textContent = it.url;

        const meta = document.createElement("div");
        meta.className = "meta";
        const d = new Date(it.time);
        meta.textContent = `${it.type || "req"} • ${it.contentType || "unknown"} • ${it.method} • ${it.status} • ${d.toLocaleTimeString()}`;

        info.appendChild(url);
        info.appendChild(meta);

        const ctr = document.createElement("div");
        ctr.className = "controls";

        const openBtn = document.createElement("button");
        openBtn.textContent = "Open";
        openBtn.onclick = () => browser.tabs.create({ url: it.url });

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copy";
        copyBtn.onclick = async() => {
            await navigator.clipboard.writeText(it.url);
            copyBtn.textContent = "Copied";
            setTimeout(() => copyBtn.textContent = "Copy", 1000);
        };

        ctr.appendChild(openBtn);
        ctr.appendChild(copyBtn);

        el.appendChild(info);
        el.appendChild(ctr);
        listEl.appendChild(el);
    }
}

async function fetchListAndRender() {
    if (!activeTab) return;
    // store includeSegments preference to background
    await browser.runtime.sendMessage({
        type: "setPrefs",
        includeSegments: includeSegmentsEl.checked,
        includeSubtitles: includeSubtitlesEl.checked
    });

    const resp = await browser.runtime.sendMessage({ type: "getList", tabId: activeTab.id });
    renderList((resp && resp.list) || []);
}

async function initTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) {
        renderList([]);
        return;
    }
    activeTab = tabs[0];
    try {
        activeDomain = new URL(activeTab.url).hostname;
    } catch { activeDomain = ""; }
    domainBadge.textContent = activeDomain || "(unknown)";
    // load stored pref for segments
    const prefs = await browser.storage.local.get({
        includeSegments: true,
        includeSubtitles: true
    });
    includeSegmentsEl.checked = !!prefs.includeSegments;
    includeSubtitlesEl.checked = !!prefs.includeSubtitles;
    await fetchListAndRender();
}

filterDomainEl.addEventListener("change", fetchListAndRender);
includeSegmentsEl.addEventListener("change", fetchListAndRender);
includeSubtitlesEl.addEventListener("change", fetchListAndRender);


copyAllBtn.addEventListener("click", async() => {
    const resp = await browser.runtime.sendMessage({ type: "getList", tabId: activeTab.id });
    const all = ((resp && resp.list) || []).filter(it => !filterDomainEl.checked || sameDomain(it.url));
    const text = all.map(it => it.url).join("\n");
    await navigator.clipboard.writeText(text);
    copyAllBtn.textContent = "Copied";
    setTimeout(() => copyAllBtn.textContent = "Copy all", 1000);
});

exportBtn.addEventListener("click", async() => {
    const resp = await browser.runtime.sendMessage({ type: "getList", tabId: activeTab.id });
    const all = ((resp && resp.list) || []).filter(it => !filterDomainEl.checked || sameDomain(it.url));
    const text = all.map(it => it.url).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const filename = `media_subtitles_${(activeDomain || 'tab')}.txt`;
    try {
        await browser.downloads.download({ url, filename, saveAs: true });
    } finally {
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
});

clearBtn.addEventListener("click", async() => {
    await browser.runtime.sendMessage({ type: "clearList", tabId: activeTab.id });
    await fetchListAndRender();
});

// live updates
browser.runtime.onMessage.addListener(async(msg) => {
    if (msg && msg.type === "update") {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0] && tabs[0].id === msg.tabId) fetchListAndRender();
    }
});

initTab();