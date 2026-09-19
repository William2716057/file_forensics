//let currentBytes = [];
let selectedIndex = null;
let currentBytes = new Uint8Array();
//metadata panel can be re-rendered after edits
let currentFile = null;
//now state so it survives re-renders
let highlightValue = null;

let selectionEnd = null;
let dragAnchor = null;


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

    //file.name and file.type escaped; size uses byteArray.length so it reflects edits
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

function renderTable() {
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
            td.textContent = val ?? "";
            if (val !== undefined) {
                const idx = absoluteIndex;
                td.dataset.value = val;
                td.dataset.index = idx;
                if (isSelected(idx)) {
                    td.classList.add("selected");
                }
                //survives re-renders
                if (val === highlightValue) {
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
            if (row.hexBytes[i] === highlightValue) span.classList.add("match"); // survives re-renders
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

function updateMeta() {
    const metaEl = document.getElementById("meta");
    if (currentBytes.length && currentFileName) {
        metaEl.textContent = `${currentFileName} — ${currentBytes.length.toLocaleString()} bytes`;
    }
}

function onByteDoubleClick(event) {
    // Works for both hex cells and ASCII spans
    const el = event.target.closest("[data-index]");
    if (!el) return;

    //const idx = Number(el.dataset.index);
    //if (selectedIndex !== idx) selectByte(idx);

    highlightValue = el.dataset.value;

    // Clear previous matches in both columns
    hexBody.querySelectorAll(".match").forEach(e => e.classList.remove("match"));

    // Highlight every hex cell and ASCII character with the same value
    hexBody.querySelectorAll("[data-value]").forEach(e => {
        if (e.dataset.value === highlightValue) {
            e.classList.add("match");
        }
    });
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
        highlightValue = null; //clear highlight from the previous file
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
hexBody.addEventListener("dblclick", onByteDoubleClick);

hexBody.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest("[data-index]");
    if (!el) return;
    dragAnchor = Number(el.dataset.index);
    setSelection(dragAnchor, dragAnchor);
});

hexBody.addEventListener("mouseover", (e) => {
    if (dragAnchor === null) return;
    const el = e.target.closest("[data-index]");
    if (el) setSelection(dragAnchor, Number(el.dataset.index));
});

// On document so releasing the mouse outside the table still ends the drag
document.addEventListener("mouseup", () => { dragAnchor = null; });

// Escape clears the selection (replaces click-to-deselect)
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setSelection(null);
});

document.getElementById("deleteByteBtn").addEventListener("click", deleteSelectedByte);
document.getElementById("editByteBtn").addEventListener("click", editSelectedByte);
document.getElementById("insertByteBtn").addEventListener("click", insertByteAtSelection);