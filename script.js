function hexdumpRows(data) {
    const bytes = new Uint8Array(data);
    const rows = [];
    for (let i = 0; i < bytes.length; i += 16) {
        const chunk = bytes.slice(i, i + 16);
        const hexBytes = Array.from(chunk).map(b => b.toString(16).padStart(2, "0"));
        const ascii = Array.from(chunk)
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

function renderTable(rows) {
    const tbody = document.getElementById("hexBody");
    const table = document.getElementById("hexTable");
    const placeholder = document.getElementById("placeholder");

    tbody.innerHTML = "";

    const frag = document.createDocumentFragment();

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
            tr.appendChild(td);
        }

        const asciiTd = document.createElement("td");
        asciiTd.className = "ascii";
        asciiTd.textContent = row.ascii;
        tr.appendChild(asciiTd);

        frag.appendChild(tr);
    });

    tbody.appendChild(frag);
    table.style.display = "table";
    placeholder.style.display = "none";
}

const fileInput = document.getElementById("fileInput");
const metaEl = document.getElementById("meta");

fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    metaEl.textContent = `Reading "${file.name}" — ${file.size.toLocaleString()} bytes`;

    const reader = new FileReader();

    reader.onload = (e) => {
        const rows = hexdumpRows(e.target.result);
        renderTable(rows);
        metaEl.textContent = `${file.name} — ${file.size.toLocaleString()} bytes`;
    };

    reader.onerror = () => {
        metaEl.textContent = "Error reading file.";
        console.error("Failed to read file:", reader.error);
    };

    reader.readAsArrayBuffer(file);
});