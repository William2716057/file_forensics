//store and add the preview types here
const PREVIEW_TYPES = {
    "PNG image": { mime: "image/png", kind: "image" },
    "JPEG image": { mime: "image/jpeg", kind: "image" },
    "GIF image (87a/89a)": { mime: "image/gif", kind: "image" },
    "BMP image": { mime: "image/bmp", kind: "image" },
    "PDF document": { mime: "application/pdf", kind: "pdf" },
    "WAV audio": { mime: "audio/wav", kind: "audio" },
    "MP3 audio (ID3)": { mime: "audio/mpeg", kind: "audio" }
};

let previewUrl = null;
let previewTimer = null;

//debounce 
function updatePreview(bytes) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => renderPreview(bytes), 150);
}

function renderPreview(bytes) {
    const box = document.getElementById("previewContent");
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    box.replaceChildren();

    const info = PREVIEW_TYPES[detectFileType(bytes)];
    if (!info) {
        box.textContent = "No preview available for this file type.";
        return;
    }

    const url = previewUrl = URL.createObjectURL(new Blob([bytes], { type: info.mime }));
    let el;
    if (info.kind === "image") {
        el = new Image();
    } else if (info.kind === "audio") {
        el = document.createElement("audio");
        el.controls = true;
    } else {
        el = document.createElement("embed");
        el.type = info.mime;
    }
    el.onerror = () => {
        if (url !== previewUrl) return;   // ignore errors from stale render
        box.textContent = "Format detected, but the data can't be displayed (possibly edited or corrupted).";
    };
    el.src = url;
    box.appendChild(el);
}