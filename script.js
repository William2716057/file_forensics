//let currentBytes = [];
let selectedIndex = null;
let currentBytes = new Uint8Array();
//metadata panel can be re-rendered after edits
let currentFile = null;
//now state so it survives re-renders
let highlightPattern = null; // bytes to search for, e.g. [0x6c, 0x61]
let highlightSet = new Set(); // every byte index covered by a match
let patternDrag = false;      // true while dragging after a double-click

let selectionEnd = null;
let dragAnchor = null;

let viewMode = "hex";


//list of magic numbers (change to separate page)
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

    // FIX: file.name and file.type escaped; size uses byteArray.length so it reflects edits
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
//get hexdump
function hexdumpRows(byteArray) {
    const rows = [];

    for (let i = 0; i < byteArray.length; i += 16) {
        const chunk = byteArray.slice(i, i + 16);

        // Convert Uint8Array to a normal Array so map() can produce strings.
        const hexBytes = Array.from(chunk)
            .map(b => b.toString(16).padStart(2, "0"));

        const ascii = Array.from(chunk)
            .map(b => (b >= 32 && b <= 126)
                ? String.fromCharCode(b)
                : "."
            )
            .join("");

        rows.push({
            offset: i.toString(16).padStart(8, "0"),
            hexBytes,
            ascii
        });
    }

    return rows;
}

function formatCell(hexStr) {
    return viewMode === "bin"
        ? parseInt(hexStr, 16).toString(2).padStart(8, "0")
        : hexStr;
}

function setViewMode(mode) {
    viewMode = mode;
    document.getElementById("hexViewBtn").classList.toggle("active", mode === "hex");
    document.getElementById("binViewBtn").classList.toggle("active", mode === "bin");
    document.getElementById("hexTable").classList.toggle("bin", mode === "bin");
    renderTable(); // selection and highlights are re-applied by renderTable
}

function renderTable() {
    updateHighlightSet();
    const rows = hexdumpRows(currentBytes);
    const tbody = document.getElementById("hexBody");
    const table = document.getElementById("hexTable");
    const placeholder = document.getElementById("placeholder");

    tbody.innerHTML = "";

    const frag = document.createDocumentFragment();
    let absoluteIndex = 0;

    rows.forEach((row, rowIdx) => {
        const tr = document.createElement("tr");

        const offsetTd = document.createElement("td");
        offsetTd.className = "offset";
        offsetTd.textContent = row.offset;
        tr.appendChild(offsetTd);

        for (let col = 0; col < 16; col++) {
            const td = document.createElement("td");
            const val = row.hexBytes[col];
            td.className = "hex-byte" + (val === "00" ? " zero" : "");
            td.textContent = val !== undefined ? formatCell(val) : "";
            if (val !== undefined) {
                const idx = absoluteIndex;
                td.dataset.value = val;
                td.dataset.index = idx;
                if (isSelected(idx)) {
                    td.classList.add("selected");
                }
                //survives re-renders
                if (highlightSet.has(idx)) {
                    td.classList.add("match");
                }
                absoluteIndex++;
            }
            tr.appendChild(td);
        }

        const asciiTd = document.createElement("td");
        asciiTd.className = "ascii";
        // One span per character so each can be highlighted individually
        for (let i = 0; i < row.ascii.length; i++) {
            const span = document.createElement("span");
            const idx = rowIdx * 16 + i;
            span.className = "ascii-char";
            span.dataset.index = idx;
            span.dataset.value = row.hexBytes[i]; // same hex value as the matching hex cell
            span.textContent = row.ascii[i];
            if (isSelected(idx)) span.classList.add("selected");
            if (highlightSet.has(idx)) span.classList.add("match"); // survives re-renders
            asciiTd.appendChild(span);
        }
        tr.appendChild(asciiTd);

        frag.appendChild(tr);
    });

    tbody.appendChild(frag);
    table.style.display = currentBytes.length ? "table" : "none";
    placeholder.style.display = currentBytes.length ? "none" : "block";

    updateToolbarState();
}

//find better way to manage larger files 
function isSelected(idx) {
    return selectedIndex !== null && idx >= selectedIndex && idx <= selectionEnd;
}

// Pass (null) to clear, or (a, b) in any order to select the range between them
function setSelection(a, b) {
    const start = a === null ? null : Math.min(a, b);
    const end = a === null ? null : Math.max(a, b);
    if (start === selectedIndex && end === selectionEnd) return; // nothing changed

    hexBody.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
    selectedIndex = start;
    selectionEnd = end;
    if (start !== null) {
        for (let i = start; i <= end; i++) {
            hexBody.querySelectorAll(`[data-index="${i}"]`)
                .forEach(el => el.classList.add("selected"));
        }
    }
    updateToolbarState();
}
//buttons
function updateToolbarState() {
    const hasSelection = selectedIndex !== null && selectedIndex < currentBytes.length;
    document.getElementById("deleteByteBtn").disabled = !hasSelection;
    document.getElementById("editByteBtn").disabled = !hasSelection;
    document.getElementById("insertByteBtn").disabled = !hasSelection;
    document.getElementById("saveBtn").disabled = currentBytes.length === 0;
    document.getElementById("saveMode").disabled = currentBytes.length === 0;
    document.getElementById("shiftLeftBtn").disabled = currentBytes.length === 0;
    document.getElementById("shiftRightBtn").disabled = currentBytes.length === 0;
}

//remove or leave byte location
function deleteSelectedByte() {
    if (selectedIndex === null) return;

    // Number of bytes in the selected range.
    const count = selectionEnd - selectedIndex + 1;

    // Create a new Uint8Array smaller by the selected range.
    const newBytes = new Uint8Array(currentBytes.length - count);

    // Copy everything before the selection.
    newBytes.set(currentBytes.subarray(0, selectedIndex), 0);

    // Copy everything after the selection.
    newBytes.set(currentBytes.subarray(selectionEnd + 1), selectedIndex);

    currentBytes = newBytes;
    selectedIndex = null;
    selectionEnd = null;

    renderTable();
    updateMeta();
    //refresh the metadata panel so size/type/first bytes match the edited data
    renderMetaPanel(currentFile, currentBytes);
}
//repeat delete function with insert byte function

function insertByteAtSelection() {
    if (selectedIndex === null) return;

    const input = window.prompt("Enter hex byte value to insert (00-FF):", "00");
    if (input === null) return;

    const cleaned = input.trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{1,2}$/.test(cleaned)) {
        window.alert("Please enter a valid hex byte, e.g. \"1A\" or \"FF\".");
        return;
    }

    // Create a new Uint8Array that is one byte larger.
    const newBytes = new Uint8Array(currentBytes.length + 1);

    // Copy everything before the selected position.
    newBytes.set(currentBytes.subarray(0, selectedIndex), 0);

    // Place the new byte at the selected position.
    newBytes[selectedIndex] = parseInt(cleaned, 16);

    // Copy the selected byte and everything after it, shifted one place right.
    newBytes.set(
        currentBytes.subarray(selectedIndex),
        selectedIndex + 1
    );

    currentBytes = newBytes;

    // Collapse the selection to the newly inserted byte.
    selectionEnd = selectedIndex;
    renderTable();
    updateMeta();
    renderMetaPanel(currentFile, currentBytes);
}



function editSelectedByte() {
    if (selectedIndex === null) return;
    const current = currentBytes[selectedIndex].toString(16).padStart(2, "0");
    const input = window.prompt("Enter new hex byte value (00-FF):", current);
    if (input === null) return;

    const cleaned = input.trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{1,2}$/.test(cleaned)) {
        window.alert("Please enter a valid hex byte, e.g. \"1A\" or \"FF\".");
        return;
    }

    // Fill the whole selected range with the entered value.
    currentBytes.fill(parseInt(cleaned, 16), selectedIndex, selectionEnd + 1);
    renderTable();
    renderMetaPanel(currentFile, currentBytes);
}

function shiftBits(direction) {
    if (currentBytes.length === 0) return;

    const start = selectedIndex !== null ? selectedIndex : 0;
    const end = selectedIndex !== null ? selectionEnd : currentBytes.length - 1;

    if (direction < 0) {
        // Left: walk forward so each byte can still read its unmodified right neighbour
        for (let i = start; i <= end; i++) {
            const next = i < end ? currentBytes[i + 1] : 0;
            currentBytes[i] = ((currentBytes[i] << 1) | (next >> 7)) & 0xFF;
        }
    } else {
        // Right: walk backward so each byte can still read its unmodified left neighbour
        for (let i = end; i >= start; i--) {
            const prev = i > start ? currentBytes[i - 1] : 0;
            currentBytes[i] = ((currentBytes[i] >> 1) | ((prev & 1) << 7)) & 0xFF;
        }
    }

    renderTable();
    renderMetaPanel(currentFile, currentBytes); // detected type and first bytes can change
}

function updateMeta() {
    const metaEl = document.getElementById("meta");
    if (currentBytes.length && currentFileName) {
        metaEl.textContent = `${currentFileName} — ${currentBytes.length.toLocaleString()} bytes`;
    }
}

// Find every occurrence of highlightPattern and store the byte indices they cover
function updateHighlightSet() {
    highlightSet = new Set();
    if (!highlightPattern || highlightPattern.length === 0) return;
    const n = highlightPattern.length;
    for (let i = 0; i + n <= currentBytes.length; i++) {
        let ok = true;
        for (let j = 0; j < n; j++) {
            if (currentBytes[i + j] !== highlightPattern[j]) { ok = false; break; }
        }
        if (ok) for (let j = 0; j < n; j++) highlightSet.add(i + j);
    }
}

// Update the .match class on existing cells without re-rendering
function applyHighlight() {
    hexBody.querySelectorAll("[data-index]").forEach(el => {
        el.classList.toggle("match", highlightSet.has(Number(el.dataset.index)));
    });
}

// Use the bytes between a and b (any order) as the pattern
function setPatternFromRange(a, b) {
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    highlightPattern = Array.from(currentBytes.subarray(start, end + 1));
    updateHighlightSet();
    applyHighlight();
}

function downloadBlob(data, filename, mime) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Same layout as the on-screen dump: offset, 16 hex bytes, ASCII
function hexDumpText() {
    return hexdumpRows(currentBytes).map(row => {
        const hex = row.hexBytes.join(" ").padEnd(16 * 3 - 1, " "); // pad the last short row so ASCII lines up
        return `${row.offset}  ${hex}  ${row.ascii}`;
    }).join("\n") + "\n";
}

function saveFile() {
    if (currentBytes.length === 0) return;
    const mode = document.getElementById("saveMode").value;

    if (mode === "reversed") {
        // slice() copies first so the bytes on screen aren't reversed too
        downloadBlob(currentBytes.slice().reverse(), "reversed_" + currentFileName, "application/octet-stream");
    } else {
        downloadBlob(hexDumpText(), currentFileName + ".hex.txt", "text/plain");
    }
}


const fileInput = document.getElementById("fileInput");
const metaEl = document.getElementById("meta");
let currentFileName = "";

fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    metaEl.textContent = `Reading "${file.name}" — ${file.size.toLocaleString()} bytes`;

    const reader = new FileReader();

    reader.onload = (e) => {
        currentBytes = new Uint8Array(e.target.result);
        currentFileName = file.name;
        currentFile = file; //remember the file for later metadata re-renders
        selectedIndex = null;
        selectionEnd = null;
        highlightPattern = null; //clear highlight from the previous file
        renderTable();
        renderMetaPanel(file, currentBytes);
        metaEl.textContent = `${file.name} — ${currentBytes.length.toLocaleString()} bytes`;
    };

    reader.onerror = () => {
        metaEl.textContent = "Error reading file.";
        console.error("Failed to read file:", reader.error);
    };

    reader.readAsArrayBuffer(file);
});

//event delegation, one mousedown, mouseover and dblclick listener on tbody
const hexBody = document.getElementById("hexBody");

hexBody.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest("[data-index]");
    if (!el) return;
    dragAnchor = Number(el.dataset.index);
    setSelection(dragAnchor, dragAnchor);

    // The second press of a double-click starts a pattern drag
    if (e.detail === 2) {
        patternDrag = true;
        setPatternFromRange(dragAnchor, dragAnchor);
    }
});

hexBody.addEventListener("mouseover", (e) => {
    if (dragAnchor === null) return;
    const el = e.target.closest("[data-index]");
    if (!el) return;
    const idx = Number(el.dataset.index);
    setSelection(dragAnchor, idx);
    if (patternDrag) setPatternFromRange(dragAnchor, idx);
});

// On document so releasing the mouse outside the table still ends the drag
document.addEventListener("mouseup", () => {
    dragAnchor = null;
    patternDrag = false;
});

// Escape clears the selection (replaces click-to-deselect)
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        setSelection(null);
        highlightPattern = null;
        updateHighlightSet();
        applyHighlight();
    }
});

//listeners 
document.getElementById("deleteByteBtn").addEventListener("click", deleteSelectedByte);
document.getElementById("editByteBtn").addEventListener("click", editSelectedByte);
document.getElementById("insertByteBtn").addEventListener("click", insertByteAtSelection);
document.getElementById("saveBtn").addEventListener("click", saveFile);
document.getElementById("hexViewBtn").addEventListener("click", () => setViewMode("hex"));
document.getElementById("binViewBtn").addEventListener("click", () => setViewMode("bin"));
document.getElementById("shiftLeftBtn").addEventListener("click", () => shiftBits(-1));
document.getElementById("shiftRightBtn").addEventListener("click", () => shiftBits(1));