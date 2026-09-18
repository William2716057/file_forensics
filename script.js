function hexdump(data) {
    const bytes = new Uint8Array(data);
    let output = "";
    for (let i = 0; i < bytes.length; i += 16) {
        const chunk = bytes.slice(i, i + 16);
        const hex = Array.from(chunk)
            .map(b => b.toString(16).padStart(2, "0"))
            .join(" ")
            .padEnd(47, " ");
        const ascii = Array.from(chunk)
            .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".")
            .join("");
        output += `${i.toString(16).padStart(8, "0")}  ${hex} |${ascii}|\n`;
    }
    return output;
}

const fileInput = document.getElementById("fileInput");
const outputEl = document.getElementById("output");
const metaEl = document.getElementById("meta");

fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    metaEl.textContent = `Reading "${file.name}" — ${file.size.toLocaleString()} bytes`;

    const reader = new FileReader();

    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        outputEl.textContent = hexdump(arrayBuffer);
        metaEl.textContent = `${file.name} — ${file.size.toLocaleString()} bytes`;
    };

    reader.onerror = () => {
        outputEl.textContent = "Error reading file.";
        console.error("Failed to read file:", reader.error);
    };

    reader.readAsArrayBuffer(file);
});