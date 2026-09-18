let currentBytes = [];
let selectedIndex = null;

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

        const slice = byteArray.slice(start, end).map(b => b.toString(16).padStart(2, "0"));
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

function renderMetaPanel(file, byteArray) {
    const container = document.getElementById("metaPanelContent");

    if (!file) {
        container.innerHTML = '<div class="meta-empty">No file loaded.</div>';
        return;
    }

    const detectedType = detectFileType(byteArray);
    const lastModified = new Date(file.lastModified);
    const firstBytesHex = byteArray.slice(0, 8)
        .map(b => b.toString(16).padStart(2, "0"))
        .join(" ");

    container.innerHTML = `
    <div class="meta-section">
      <h3>Basic Info</h3>
      <div class="meta-row"><span class="meta-label">Name</span><span class="meta-value">${file.name}</span></div>
      <div class="meta-row"><span class="meta-label">Size</span><span class="meta-value">${formatBytes(file.size)} (${file.size.toLocaleString()} B)</span></div>
      <div class="meta-row"><span class="meta-label">MIME type</span><span class="meta-value">${file.type || '<span class="meta-value unknown">unreported</span>'}</span></div>
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

function hexdumpRows(byteArray) {
    const rows = [];
    for (let i = 0; i < byteArray.length; i += 16) {
        const chunk = byteArray.slice(i, i + 16);
        const hexBytes = chunk.map(b => b.toString(16).padStart(2, "0"));
        const ascii = chunk
            .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".")
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

    rows.forEach(row => {
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
                td.addEventListener("click", () => selectByte(idx));
                td.addEventListener("dblclick", onByteDoubleClick);
                if (idx === selectedIndex) {
                    td.classList.add("selected");
                }
                absoluteIndex++;
            }
            tr.appendChild(td);
        }

        const asciiTd = document.createElement("td");
        asciiTd.className = "ascii";
        asciiTd.textContent = row.ascii;
        tr.appendChild(asciiTd);

        frag.appendChild(tr);
    });

    tbody.appendChild(frag);
    table.style.display = currentBytes.length ? "table" : "none";
    placeholder.style.display = currentBytes.length ? "none" : "block";

    updateToolbarState();
}

//find better way to manage larger files 
function selectByte(idx) {
    selectedIndex = (selectedIndex === idx) ? null : idx;
    renderTable();
}

function updateToolbarState() {
    const hasSelection = selectedIndex !== null && selectedIndex < currentBytes.length;
    document.getElementById("deleteByteBtn").disabled = !hasSelection;
    document.getElementById("editByteBtn").disabled = !hasSelection;
}

//remove or leave byte location
function deleteSelectedByte() {
    if (selectedIndex === null) return;
    currentBytes.splice(selectedIndex, 1);
    selectedIndex = null;
    renderTable();
    updateMeta();
}

//repeat delete function with insert byte function

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

    currentBytes[selectedIndex] = parseInt(cleaned, 16);
    renderTable();
}

function updateMeta() {
    const metaEl = document.getElementById("meta");
    if (currentBytes.length && currentFileName) {
        metaEl.textContent = `${currentFileName} — ${currentBytes.length.toLocaleString()} bytes`;
    }
}

function onByteDoubleClick(event) { //edit to allow doubleclick on multiple values
    const clickedValue = event.currentTarget.dataset.value;

    // Clear previous matches
    document.querySelectorAll(".hex-byte.match").forEach(el => el.classList.remove("match"));

    // Highlight every cell with the same hex value
    document.querySelectorAll(".hex-byte").forEach(el => {
        if (el.dataset.value === clickedValue) {
            el.classList.add("match");
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
        currentBytes = Array.from(new Uint8Array(e.target.result));
        currentFileName = file.name;
        selectedIndex = null;
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

document.getElementById("deleteByteBtn").addEventListener("click", deleteSelectedByte);
document.getElementById("editByteBtn").addEventListener("click", editSelectedByte);