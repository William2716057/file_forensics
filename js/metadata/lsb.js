const LSB_MAX_BYTES = 1 << 20;
const LSB_MIN_RUN = 12;
const LSB_TYPES = new Set(["PNG image", "BMP image", "GIF image (87a/89a)", "WebP image"]);
const lsbPrintable = b => (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13;

let lsbToken = 0;   // discards results from older loads
let lsbOpen = false;

async function lsbLoadPixels(bytes) {
    const bmp = await createImageBitmap(new Blob([bytes]), {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none"
    });
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

function lsbExtract(img, channels, msbFirst) {
    const bytes = [];
    let current = 0, count = 0;
    const pixelCount = img.width * img.height;

    for (let p = 0; p < pixelCount && bytes.length < LSB_MAX_BYTES; p++) {
        for (const ch of channels) {
            const bit = img.data[p * 4 + ch] & 1;
            if (msbFirst) current = (current << 1) | bit;
            else current |= bit << count;
            if (++count === 8) { bytes.push(current); current = 0; count = 0; }
        }
    }
    return Uint8Array.from(bytes);
}

function lsbPrintablePrefix(buf) {
    let n = 0;
    while (n < buf.length && n < 500 && lsbPrintable(buf[n])) n++;
    return n;
}

function lsbHasAlpha(img) {
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return true;
    return false;
}

async function lsbScan(bytes) {
    const img = await lsbLoadPixels(bytes);
    const channelSets = { R: [0], G: [1], B: [2], RGB: [0, 1, 2], BGR: [2, 1, 0] };
    if (lsbHasAlpha(img)) { channelSets.A = [3]; channelSets.RGBA = [0, 1, 2, 3]; }

    const hits = [];
    for (const [name, channels] of Object.entries(channelSets)) {
        for (const msbFirst of [true, false]) {
            const buf = lsbExtract(img, channels, msbFirst);
            const run = lsbPrintablePrefix(buf);
            if (run >= LSB_MIN_RUN) {
                hits.push({
                    name, run,
                    order: msbFirst ? "MSB" : "LSB",
                    text: new TextDecoder("utf-8").decode(buf.subarray(0, run))
                });
            }
        }
    }
    return hits;
}

function lsbClose() {
    lsbToken++;                                   // discards any scan still running
    lsbOpen = false;
    document.getElementById("lsbPanel").hidden = true;
    document.getElementById("lsbPanelContent").textContent = "";
    document.getElementById("lsbBtn").classList.remove("active");
}

async function toggleLsb() {
    if (lsbOpen) { lsbClose(); return; }          // second press hides it

    const panel = document.getElementById("lsbPanel");
    const box = document.getElementById("lsbPanelContent");
    lsbOpen = true;
    document.getElementById("lsbBtn").classList.add("active");
    box.textContent = "Scanning…";
    panel.hidden = false;

    const token = ++lsbToken;
    let hits;
    try { hits = await lsbScan(currentBytes); }
    catch {
        if (token === lsbToken) box.textContent = "Could not decode this file as an image.";
        return;
    }
    if (token !== lsbToken) return;               // closed or new file loaded meanwhile

    box.textContent = "";
    if (hits.length === 0) {
        box.textContent = "No readable hidden text found.";
        return;
    }

    const intro = document.createElement("div");
    intro.textContent = "Possible hidden text found in the least significant bits.";
    box.appendChild(intro);

    for (const h of hits) {
        const head = document.createElement("h3");
        head.textContent = `Channels ${h.name}, ${h.order}-first (${h.run} readable bytes)`;
        const pre = document.createElement("pre");
        pre.className = "lsb-text";
        pre.textContent = h.text;
        box.append(head, pre);
    }
}