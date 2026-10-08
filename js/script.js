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

const ROW_H = 20;      // must match the CSS row height
const BUFFER = 15;     // extra rows above and below the viewport
const scroller = document.getElementById("hexScroll");
let highlightMask = null;

function spacer(h) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 18; td.style.height = h + "px"; td.style.padding = "0";
    tr.appendChild(td);
    return tr;
}

function buildRow(r) {
    const len = currentBytes.length;
    const base = r * 16;
    const tr = document.createElement("tr");

    const offsetTd = document.createElement("td");
    offsetTd.className = "offset";
    offsetTd.textContent = base.toString(16).padStart(8, "0");
    tr.appendChild(offsetTd);

    const asciiTd = document.createElement("td");
    asciiTd.className = "ascii";

    for (let col = 0; col < 16; col++) {
        const idx = base + col;
        const td = document.createElement("td");
        if (idx < len) {
            const b = currentBytes[idx];
            const hex = b.toString(16).padStart(2, "0");
            td.className = "hex-byte" + (b === 0 ? " zero" : "");
            td.textContent = formatCell(hex);
            td.dataset.value = hex;
            td.dataset.index = idx;
            if (isSelected(idx)) td.classList.add("selected");
            if (highlightMask && highlightMask[idx]) td.classList.add("match");

            const span = document.createElement("span");
            span.className = "ascii-char";
            span.dataset.index = idx;
            span.dataset.value = hex;
            span.textContent = (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".";
            if (isSelected(idx)) span.classList.add("selected");
            if (highlightMask && highlightMask[idx]) span.classList.add("match");
            asciiTd.appendChild(span);
        } else {
            td.className = "hex-byte";
        }
        tr.appendChild(td);
    }
    tr.appendChild(asciiTd);
    return tr;
}

// rescan = false when only scrolling (bytes and pattern unchanged)
function renderTable(rescan = true) {
    if (rescan) updateHighlightSet();

    const len = currentBytes.length;
    const totalRows = Math.ceil(len / 16);
    const top = scroller.scrollTop;
    const first = Math.max(0, Math.floor(top / ROW_H) - BUFFER);
    const last = Math.min(totalRows, Math.ceil((top + scroller.clientHeight) / ROW_H) + BUFFER);

    const frag = document.createDocumentFragment();
    frag.appendChild(spacer(first * ROW_H));
    for (let r = first; r < last; r++) frag.appendChild(buildRow(r));
    frag.appendChild(spacer((totalRows - last) * ROW_H));
    hexBody.replaceChildren(frag);

    document.getElementById("hexTable").style.display = len ? "table" : "none";
    document.getElementById("placeholder").style.display = len ? "none" : "block";
    updateToolbarState();
}

let scrollQueued = false;
scroller.addEventListener("scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; renderTable(false); });
});

//find better way to manage larger files 
function isSelected(idx) {
    return selectedIndex !== null && idx >= selectedIndex && idx <= selectionEnd;
}

function setSelection(a, b) {
    const start = a === null ? null : Math.min(a, b);
    const end = a === null ? null : Math.max(a, b);
    if (start === selectedIndex && end === selectionEnd) return;
    selectedIndex = start;
    selectionEnd = end;
    hexBody.querySelectorAll("[data-index]").forEach(el =>
        el.classList.toggle("selected", isSelected(Number(el.dataset.index))));
    updateToolbarState();
}

function applyHighlight() {
    hexBody.querySelectorAll("[data-index]").forEach(el =>
        el.classList.toggle("match", !!(highlightMask && highlightMask[Number(el.dataset.index)])));
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
        metaEl.textContent = `${currentFileName}  ${currentBytes.length.toLocaleString()} bytes`;
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

//offset, 16 hex bytes, ASCII
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

    metaEl.textContent = `Reading "${file.name}"  ${file.size.toLocaleString()} bytes`;

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
        metaEl.textContent = `${file.name}  ${currentBytes.length.toLocaleString()} bytes`;
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

//releasing the mouse outside the table still ends the drag
document.addEventListener("mouseup", () => {
    dragAnchor = null;
    patternDrag = false;
});

// Escape clears the selection 
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
