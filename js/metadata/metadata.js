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

function renderMetaPanel(file, byteArray) {
    const container = document.getElementById("metaPanelContent");

    if (!file) {
        container.innerHTML = '<div class="meta-empty">No file loaded.</div>';
        return;
    }

    const detectedType = detectFileType(byteArray);
    const lastModified = new Date(file.lastModified);
    //const firstBytesHex = byteArray.slice(0, 8)
    //   .map(b => b.toString(16).padStart(2, "0"))
    //  .join(" ");

    const hex2 = b => b.toString(16).padStart(2, "0");
    const firstBytesHex = Array.from(byteArray.subarray(0, 8), hex2).join(" ");

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
    </div>
  `;
}

