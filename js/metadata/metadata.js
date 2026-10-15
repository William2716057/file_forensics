const FILE_SIGNATURES = [ //fix weak detections
    { type: "PNG image", offset: 0, bytes: ["89", "50", "4e", "47", "0d", "0a", "1a", "0a"] },
    { type: "JPEG image", offset: 0, bytes: ["ff", "d8", "ff"] },
    { type: "GIF image (87a/89a)", offset: 0, bytes: ["47", "49", "46", "38"] },
    { type: "PDF document", offset: 0, bytes: ["25", "50", "44", "46"] },
    { type: "ZIP / DOCX / XLSX / PPTX / JAR", offset: 0, bytes: ["50", "4b", "03", "04"] },
    { type: "GZIP archive", offset: 0, bytes: ["1f", "8b"] },
    { type: "7-Zip archive", offset: 0, bytes: ["37", "7a", "bc", "af", "27", "1c"] },
    { type: "RAR archive", offset: 0, bytes: ["52", "61", "72", "21", "1a", "07"] },
    { type: "ELF executable", offset: 0, bytes: ["7f", "45", "4c", "46"] },
    { type: "Windows PE (EXE/DLL)", offset: 0, bytes: ["4d", "5a"] },
    { type: "BMP image", offset: 0, bytes: ["42", "4d"] },
    { type: "WAV audio", offset: 8, bytes: ["57", "41", "56", "45"] },
    { type: "MP3 audio (ID3)", offset: 0, bytes: ["49", "44", "33"] },
    { type: "SQLite database", offset: 0, bytes: ["53", "51", "4c", "69", "74", "65"] },
    { type: "UTF-8 text (BOM)", offset: 0, bytes: ["ef", "bb", "bf"] }
];

// Checks currentBytes against each known signature at expected offset and returns the matched type name, or null if nothing matches.
function detectFileType(byteArray) {
    for (const sig of FILE_SIGNATURES) {
        const start = sig.offset;
        const end = start + sig.bytes.length;
        if (byteArray.length < end) continue;

        const slice = Array.from(byteArray.slice(start, end))
            .map(b => b.toString(16).padStart(2, "0"));
        const isMatch = sig.bytes.every((b, i) => slice[i] === b);
        if (isMatch) return sig.type;
    }
    return null;
}

function formatBytes(size) {
    if (size < 1024) return `${size} B`;
    const units = ["KB", "MB", "GB"];
    let val = size;
    let unitIndex = -1;
    do {
        val /= 1024;
        unitIndex++;
    } while (val >= 1024 && unitIndex < units.length - 1);
    return `${val.toFixed(1)} ${units[unitIndex]}`;
}

//escape text before putting it in innerHTML
const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));


const STRING_MIN_LEN = 10;
const STRING_MAX_RESULTS = 500;
const hex2 = b => b.toString(16).padStart(2, "0");
const isPrintable = b => (b >= 32 && b <= 126) || b === 9;

function extractAsciiStrings(bytes, minLen = STRING_MIN_LEN) {
    const found = [];
    let start = -1;
    for (let i = 0; i <= bytes.length; i++) {
        const ok = i < bytes.length && isPrintable(bytes[i]);
        if (ok) {
            if (start === -1) start = i;
        } else if (start !== -1) {
            if (i - start >= minLen) {
                found.push({
                    offset: start,
                    byteLen: i - start,
                    kind: "ASCII",
                    text: String.fromCharCode(...bytes.subarray(start, Math.min(i, start + 200)))
                });
            }
            start = -1;
        }
    }
    return found;
}

// UTF-16LE runs: printable, 0x00, printable, 0x00 ... (common in Windows binaries)
function extractUtf16Strings(bytes, minLen = STRING_MIN_LEN) {
    const found = [];
    let i = 0;
    while (i + 1 < bytes.length) {
        if (isPrintable(bytes[i]) && bytes[i + 1] === 0) {
            const start = i;
            let chars = "";
            while (i + 1 < bytes.length && isPrintable(bytes[i]) && bytes[i + 1] === 0) {
                if (chars.length < 200) chars += String.fromCharCode(bytes[i]);
                i += 2;
            }
            if ((i - start) / 2 >= minLen) {
                found.push({ offset: start, byteLen: i - start, kind: "UTF-16", text: chars });
            }
        } else {
            i++;
        }
    }
    return found;
}

function analyseBytes(bytes) {
    const counts = new Uint32Array(256);
    for (let i = 0; i < bytes.length; i++) counts[bytes[i]]++;

    const n = bytes.length;
    let entropy = 0, unique = 0, printable = 0, topByte = 0;
    for (let v = 0; v < 256; v++) {
        const c = counts[v];
        if (!c) continue;
        unique++;
        const p = c / n;
        entropy -= p * Math.log2(p);
        if (isPrintable(v)) printable += c;
        if (c > counts[topByte]) topByte = v;
    }
    return {
        entropy,
        unique,
        printablePct: n ? (printable / n) * 100 : 0,
        nullPct: n ? (counts[0] / n) * 100 : 0,
        topByte,
        topCount: counts[topByte]
    };
}

function entropyLabel(e) {
    if (e > 7.5) return "very high (compressed or encrypted)";
    if (e > 6) return "high (packed or binary data)";
    if (e > 3.5) return "medium (text or code)";
    return "low (sparse or repetitive)";
}

let hashToken = 0; // discards results from older renders
async function fillSha256(byteArray) {
    const token = ++hashToken;
    const el = document.getElementById("metaSha256");
    if (!el || !window.crypto?.subtle) { if (el) el.textContent = "unavailable (needs localhost or HTTPS)"; return; }
    const buf = await crypto.subtle.digest("SHA-256", byteArray);
    if (token !== hashToken) return;
    el.textContent = Array.from(new Uint8Array(buf), hex2).join("");
}
function renderMetaPanel(file, byteArray) {
    const container = document.getElementById("metaPanelContent");

    if (!file) {
        container.innerHTML = '<div class="meta-empty">No file loaded.</div>';
        return;
    }

    const detectedType = detectFileType(byteArray);
    const lastModified = new Date(file.lastModified);
    const firstBytesHex = Array.from(byteArray.subarray(0, 8), hex2).join(" ");
    const lastBytesHex = Array.from(byteArray.subarray(Math.max(0, byteArray.length - 8)), hex2).join(" ");

    const stats = analyseBytes(byteArray);
    const allStrings = extractAsciiStrings(byteArray)
        .concat(extractUtf16Strings(byteArray))
        .sort((a, b) => a.offset - b.offset);
    const shown = allStrings.slice(0, STRING_MAX_RESULTS);

    const stringRows = shown.map(s =>
        `<div class="str-row" data-offset="${s.offset}" data-len="${s.byteLen}" title="Click to jump to this offset">
           <span class="str-off">${s.offset.toString(16).padStart(8, "0")}</span>
           <span class="str-kind">${s.kind}</span>
           <span class="str-text">${esc(s.text)}</span>
         </div>`).join("");

    container.innerHTML = `
    <div class="meta-section">
      <h3>Basic Info</h3>
      <div class="meta-row"><span class="meta-label">Name</span><span class="meta-value">${esc(file.name)}</span></div>
      <div class="meta-row"><span class="meta-label">Size</span><span class="meta-value">${formatBytes(byteArray.length)} (${byteArray.length.toLocaleString()} B)</span></div>
      <div class="meta-row"><span class="meta-label">MIME type</span><span class="meta-value">${file.type ? esc(file.type) : '<span class="meta-value unknown">unreported</span>'}</span></div>
      <div class="meta-row"><span class="meta-label">Modified</span><span class="meta-value">${lastModified.toLocaleString()}</span></div>
    </div>
    <div class="meta-section">
      <h3>Detected Format</h3>
      <div class="meta-row">
        <span class="meta-label">Signature</span>
        <span class="meta-value ${detectedType ? 'detected' : 'unknown'}">${detectedType ?? "Unknown"}</span>
      </div>
      <div class="meta-row"><span class="meta-label">First bytes</span><span class="meta-value">${firstBytesHex}</span></div>
      <div class="meta-row"><span class="meta-label">Last bytes</span><span class="meta-value">${lastBytesHex}</span></div>
    </div>
    <div class="meta-section">
      <h3>Content Analysis</h3>
      <div class="meta-row"><span class="meta-label">Entropy</span><span class="meta-value">${stats.entropy.toFixed(2)} / 8 &ndash; ${entropyLabel(stats.entropy)}</span></div>
      <div class="meta-row"><span class="meta-label">Printable</span><span class="meta-value">${stats.printablePct.toFixed(1)}%</span></div>
      <div class="meta-row"><span class="meta-label">Null bytes</span><span class="meta-value">${stats.nullPct.toFixed(1)}%</span></div>
      <div class="meta-row"><span class="meta-label">Unique values</span><span class="meta-value">${stats.unique} / 256</span></div>
      <div class="meta-row"><span class="meta-label">Most common</span><span class="meta-value">0x${hex2(stats.topByte)} (${stats.topCount.toLocaleString()}&times;)</span></div>
      <div class="meta-row"><span class="meta-label">SHA-256</span><span class="meta-value" id="metaSha256" style="word-break:break-all">calculating&hellip;</span></div>
    </div>
    <div class="meta-section">
      <h3>Strings (${allStrings.length.toLocaleString()} found, min length ${STRING_MIN_LEN})</h3>
      <div class="str-list">${stringRows || '<div class="meta-empty">None found.</div>'}</div>
      ${allStrings.length > shown.length ? `<div class="meta-empty">Showing first ${shown.length} only.</div>` : ""}
    </div>
  `;

    fillSha256(byteArray);
    updatePreview(byteArray);
    updateExif(byteArray);
}

function jumpTo(offset, length) {
    setSelection(offset, offset + length - 1);
    const row = Math.floor(offset / 16);
    scroller.scrollTop = Math.max(0, row * ROW_H - scroller.clientHeight / 2);
    renderTable(false);
}

document.getElementById("metaPanelContent").addEventListener("click", (e) => {
    const row = e.target.closest(".str-row");
    if (!row) return;
    jumpTo(Number(row.dataset.offset), Number(row.dataset.len));
});

//exif finding functions