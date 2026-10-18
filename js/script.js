
//let currentBytes = [];
let selectedIndex = null;
let currentBytes = new Uint8Array();
//storeOriginalHash(currentBytes);
//metadata panel can be re-rendered after edits
let currentFile = null;
//store state
let highlightPattern = null; // bytes to search for, e.g. [0x6c, 0x61]
let highlightSet = new Set(); // each byte index covered by a match
let patternDrag = false;      // true while dragging after a double-click

let selectionEnd = null;
let dragAnchor = null;

let viewMode = "hex";

//for hex editing
let editing = false;          // true only between pressing Edit/Insert and finishing the byte
let insertMode = false;       // false = overwrite, true = insert (only meaningful while editing)
let pendingNibble = null;     // first hex digit typed, waiting for the second
let metaTimer = null;


//fix undo functions
const UNDO_MAX_STEPS = 200;
const UNDO_MAX_BYTES = 128 * 1024 * 1024; // total across all snapshots
let undoStack = [];
let redoStack = [];


function getAsciiClass(charCode) {
    if (charCode < 32 || charCode > 126) {
        return "control";
    }

    if (
        (charCode >= 65 && charCode <= 90) ||
        (charCode >= 97 && charCode <= 122)
    ) {
        return "letter";
    }

    if (charCode >= 48 && charCode <= 57) {
        return "number";
    }

    return "special";
}



// inPlace = true when the caller is about to mutate currentBytes directly
function snapshot(inPlace) {
    return {
        bytes: inPlace ? currentBytes.slice() : currentBytes,
        start: selectedIndex,
        end: selectionEnd
    };
}

// Call this BEFORE changing currentBytes
function pushUndo(inPlace) {
    undoStack.push(snapshot(inPlace));
    redoStack = [];

    let total = undoStack.reduce((sum, s) => sum + s.bytes.length, 0);
    while (undoStack.length > 1 &&
        (undoStack.length > UNDO_MAX_STEPS || total > UNDO_MAX_BYTES)) {
        total -= undoStack.shift().bytes.length;
    }
    updateToolbarState();
}

function restoreSnapshot(s) {
    editing = false; pendingNibble = null; updateEditButtons();
    currentBytes = s.bytes;//added
    const max = currentBytes.length - 1;
    if (s.start !== null && s.start <= max) {
        selectedIndex = s.start;
        selectionEnd = Math.min(s.end, max);
    } else {
        selectedIndex = null;
        selectionEnd = null;
    }
    renderTable();
    updateMeta();
    renderMetaPanel(currentFile, currentBytes);
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshot(false));
    restoreSnapshot(undoStack.pop());
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshot(false));
    restoreSnapshot(redoStack.pop());
}

function deleteSelectedByte() {
    if (selectedIndex === null) return;

    pushUndo(false);   //take snapshot before change

    const count = selectionEnd - selectedIndex + 1;
    const newBytes = new Uint8Array(currentBytes.length - count);
    newBytes.set(currentBytes.subarray(0, selectedIndex), 0);
    newBytes.set(currentBytes.subarray(selectionEnd + 1), selectedIndex);

    currentBytes = newBytes;
    selectedIndex = null;
    selectionEnd = null;

    renderTable();
    updateMeta();
    renderMetaPanel(currentFile, currentBytes);
}

function insertByteAtSelection() {
    if (selectedIndex === null) return;

    const input = window.prompt("Enter hex byte value to insert (00-FF):", "00"); //change to d
    if (input === null) return;

    const cleaned = input.trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{1,2}$/.test(cleaned)) {
        window.alert("Please enter a valid hex byte, e.g. \"1A\" or \"FF\".");
        return;
    }

    pushUndo(false);   // after validation, cancelled or invalid input adds no step

    const newBytes = new Uint8Array(currentBytes.length + 1);
    newBytes.set(currentBytes.subarray(0, selectedIndex), 0);
    newBytes[selectedIndex] = parseInt(cleaned, 16);
    newBytes.set(currentBytes.subarray(selectedIndex), selectedIndex + 1);

    currentBytes = newBytes;
    selectionEnd = selectedIndex;   // collapse selection to the inserted byte

    renderTable();
    updateMeta();
    renderMetaPanel(currentFile, currentBytes);
}

function updateEditButtons() {
    document.getElementById("editByteBtn").classList.toggle("active", editing && !insertMode);
    document.getElementById("insertByteBtn").classList.toggle("active", editing && insertMode);
}

function startEdit(insert) {
    if (selectedIndex === null) return;
    editing = true;
    insertMode = insert;
    pendingNibble = null;
    updateEditButtons();
    renderTable(false); // display __ placeholder while editing 
}

//cancel if half typed
// returns true if an edit was actually in progress
function endEdit() {
    const was = editing;
    editing = false;
    pendingNibble = null;
    updateEditButtons();
    if (was) renderTable(false);
    return was;
}

//rescan in metapanel
function refreshMetaSoon() {
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => {
        updateMeta();
        renderMetaPanel(currentFile, currentBytes);
    }, 300);
}


function scrollToIndex(idx) {
    const top = Math.floor(idx / 16) * ROW_H;
    const margin = ROW_H * 2;
    if (top < scroller.scrollTop + margin) scroller.scrollTop = Math.max(0, top - margin);
    else if (top + ROW_H > scroller.scrollTop + scroller.clientHeight - margin)
        scroller.scrollTop = top + ROW_H - scroller.clientHeight + margin;
}

function moveCursor(i) {
    i = Math.max(0, Math.min(currentBytes.length - 1, i));
    selectedIndex = selectionEnd = i;
    scrollToIndex(i);
    renderTable(false);
}

function typeHexDigit(d) {
    if (pendingNibble === null) {          // first digit: show it and wait
        pendingNibble = d;
        renderTable(false);
        return;
    }

    const value = parseInt(pendingNibble + d, 16);

    if (insertMode) {
        pushUndo(false);
        const nb = new Uint8Array(currentBytes.length + 1);
        nb.set(currentBytes.subarray(0, selectedIndex), 0);
        nb[selectedIndex] = value;
        nb.set(currentBytes.subarray(selectedIndex), selectedIndex + 1);
        currentBytes = nb;
    } else {
        pushUndo(true);
        currentBytes[selectedIndex] = value;
    }

    editing = false;                       // revert when finished
    pendingNibble = null;
    selectionEnd = selectedIndex;          
    updateEditButtons();
    renderTable();
    refreshMetaSoon();
}
//check
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (endEdit()) return;             // first Escape cancels the edit
        setSelection(null);
        highlightPattern = null;
        updateHighlightSet();
        applyHighlight();
        return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (selectedIndex === null || currentBytes.length === 0) return;

    if (editing && /^[0-9a-f]$/i.test(e.key)) {    // digits only count while editing
        e.preventDefault();
        typeHexDigit(e.key.toLowerCase());
        return;
    }

    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -16, ArrowDown: 16 }[e.key];
    if (step) {
        e.preventDefault();
        endEdit();                         // moving away cancels
        moveCursor(selectedIndex + step);
    } else if (e.key === "Delete") {       // optional: Delete key removes the selection
        e.preventDefault();
        endEdit();
        deleteSelectedByte();
    }
});


/*
function editSelectedByte() {
    if (selectedIndex === null) return;
 
    const current = currentBytes[selectedIndex].toString(16).padStart(2, "0");
    const input = window.prompt("Enter new hex byte value (00-FF):", current); //change to edit at space rather than through prompt
    if (input === null) return;
 
    const cleaned = input.trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{1,2}$/.test(cleaned)) {
        window.alert("Hex byte invalid");
        return;
    }
 
    pushUndo(true);    // fill() edits the array in place, so store a copy
 
    currentBytes.fill(parseInt(cleaned, 16), selectedIndex, selectionEnd + 1);
 
    renderTable();
    renderMetaPanel(currentFile, currentBytes);
}*/

//bit shift operations
function bitShift(direction) {
    if (currentBytes.length === 0) return;

    pushUndo(true);    // the loops below modify currentBytes in place

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
    renderMetaPanel(currentFile, currentBytes);
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

const ROW_H = 20;      // must match the CSS row height
const BUFFER = 15;     // extra rows above and below the viewport
const scroller = document.getElementById("hexScroll");
//let highlightMask = null;

function spacer(h) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 18; td.style.height = h + "px"; td.style.padding = "0";
    tr.appendChild(td);
    return tr;
}

//here
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
            //add here
            td.textContent = formatCell(hex);
            if (editing && idx === selectedIndex) {
                td.textContent = pendingNibble !== null ? pendingNibble + "_" : "__";
                td.classList.add("editing");
            }
            //to here
            td.dataset.value = hex;
            td.dataset.index = idx;
            if (isSelected(idx)) td.classList.add("selected");
            //highlightmask no longer necessary
            //if (highlightMask && highlightMask[idx]) td.classList.add("match");
            if (highlightSet.has(idx)) td.classList.add("match");

            const span = document.createElement("span");

            //colour changes
            span.className = `ascii-char ${getAsciiClass(b)}`;
            span.dataset.index = idx;
            span.dataset.value = hex;
            span.textContent =
                (b >= 32 && b <= 126)
                    ? String.fromCharCode(b)
                    : ".";
            //access selected highlights
            if (isSelected(idx)) span.classList.add("selected");
            if (highlightSet.has(idx)) span.classList.add("match");
            asciiTd.appendChild(span);
        } else {
            td.className = "hex-byte";
        }
        tr.appendChild(td);
    }
    tr.appendChild(asciiTd);
    return tr;
}



//here

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

//reset typing state after editing byte
function setSelection(a, b) {
    const wasEditing = editing;
    editing = false;                       // clicking elsewhere cancels an edit
    pendingNibble = null;
    if (wasEditing) updateEditButtons();

    const start = a === null ? null : Math.min(a, b);
    const end = a === null ? null : Math.max(a, b);
    if (start === selectedIndex && end === selectionEnd) {
        if (wasEditing) renderTable(false);
        return;
    }
    selectedIndex = start;
    selectionEnd = end;
    hexBody.querySelectorAll("[data-index]").forEach(el =>
        el.classList.toggle("selected", isSelected(Number(el.dataset.index))));
    if (wasEditing) renderTable(false);
    updateToolbarState();
}



let scrollQueued = false;
scroller.addEventListener("scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; renderTable(false); });
});

//access selected bytes
function isSelected(idx) {
    return selectedIndex !== null && idx >= selectedIndex && idx <= selectionEnd;
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
    document.getElementById("undoBtn").disabled = undoStack.length === 0;
    document.getElementById("redoBtn").disabled = redoStack.length === 0;
}
function updateMeta() {
    const metaEl = document.getElementById("meta");
    if (currentBytes.length && currentFileName) {
        metaEl.textContent = `${currentFileName} ? ${currentBytes.length.toLocaleString()} bytes`;
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
        // slice() copies first so the bytes on screen aren't reversed
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

    metaEl.textContent = `Reading "${file.name}" ? ${file.size.toLocaleString()} bytes`;

    const reader = new FileReader();

    reader.onload = (e) => {
        currentBytes = new Uint8Array(e.target.result);
        storeOriginalHash(currentBytes);
        currentFileName = file.name;
        currentFile = file; //remember the file for later metadata re-renders
        selectedIndex = null;
        selectionEnd = null;
        undoStack = [];
        redoStack = [];
        editing = false; pendingNibble = null; updateEditButtons();
        highlightPattern = null; //clear highlight from the previous file
        renderTable();
        renderMetaPanel(file, currentBytes);
        metaEl.textContent = `${file.name} ? ${currentBytes.length.toLocaleString()} bytes`;
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
/*
// Escape clears the selection 
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        setSelection(null);
        highlightPattern = null;
        updateHighlightSet();
        applyHighlight();
    }
});*/

//listeners 
document.getElementById("deleteByteBtn").addEventListener("click", deleteSelectedByte);
//document.getElementById("editByteBtn").addEventListener("click", editSelectedByte);
//document.getElementById("insertByteBtn").addEventListener("click", insertByteAtSelection);
//document.getElementById("editByteBtn").addEventListener("click", () => setEditMode(false));
document.getElementById("insertByteBtn").addEventListener("click", () => startEdit(true));
document.getElementById("saveBtn").addEventListener("click", saveFile);
document.getElementById("hexViewBtn").addEventListener("click", () => setViewMode("hex"));
document.getElementById("binViewBtn").addEventListener("click", () => setViewMode("bin"));
document.getElementById("shiftLeftBtn").addEventListener("click", () => bitShift(-1));
document.getElementById("shiftRightBtn").addEventListener("click", () => bitShift(1));
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);
document.getElementById("editByteBtn").addEventListener("click", () => startEdit(false));

document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
});