
const hDec = (bytes, label = "utf-8") => new TextDecoder(label).decode(bytes);
const hRow = (group, tag, value, offset, warn = false) =>
    ({ group, tag, value, offset, ...(warn ? { warn: true } : {}) });
const hView = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const hPad = n => String(n).padStart(2, "0");
const hCstr = (bytes, start, end) => {                 // index of next NUL (or end)
    let i = start;
    while (i < end && bytes[i] !== 0) i++;
    return i;
};

//PNGs
const PNG_COLOR_TYPES = { 0: "Greyscale", 2: "RGB", 3: "Indexed", 4: "Greyscale + alpha", 6: "RGBA" };
const PNG_INTENTS = ["Perceptual", "Relative colorimetric", "Saturation", "Absolute colorimetric"];

function walkPng(bytes) {
    const rows = [], v = hView(bytes);
    let p = 8, ended = false;
    while (p + 12 <= bytes.length) {
        const len = v.getUint32(p);
        const type = hDec(bytes.subarray(p + 4, p + 8), "latin1");
        const d = p + 8;
        if (d + len + 4 > bytes.length) {
            rows.push(hRow("Warnings", "PNG", `Chunk ${type} runs past end of file`, p, true));
            break;
        }
        switch (type) {
            case "IHDR": //png header
                rows.push(hRow("PNG", "Dimensions", `${v.getUint32(d)} × ${v.getUint32(d + 4)}`, d));
                rows.push(hRow("PNG", "BitDepth", bytes[d + 8], d + 8));
                rows.push(hRow("PNG", "ColorType", `${PNG_COLOR_TYPES[bytes[d + 9]] ?? "Unknown"} (${bytes[d + 9]})`, d + 9));
                rows.push(hRow("PNG", "Interlace", bytes[d + 12] ? "Adam7" : "None", d + 12));
                break;
            case "tEXt": {
                const z = hCstr(bytes, d, d + len);
                rows.push(hRow("PNG text", hDec(bytes.subarray(d, z), "latin1"),
                    hDec(bytes.subarray(z + 1, d + len), "latin1"), d));
                break;
            }
            case "zTXt": {
                const z = hCstr(bytes, d, d + len);
                rows.push(hRow("PNG text", hDec(bytes.subarray(d, z), "latin1"), "(compressed)", d));
                break;
            }
            case "iTXt": {
                const z = hCstr(bytes, d, d + len);
                const compressed = bytes[z + 1];
                const l = hCstr(bytes, z + 3, d + len);          // language tag
                const t = hCstr(bytes, l + 1, d + len);          // translated keyword
                rows.push(hRow("PNG text", hDec(bytes.subarray(d, z), "latin1"),
                    compressed ? "(compressed)" : hDec(bytes.subarray(t + 1, d + len)), d));
                break;
            }
            case "tIME":
                rows.push(hRow("PNG", "LastModified",
                    `${v.getUint16(d)}-${hPad(bytes[d + 2])}-${hPad(bytes[d + 3])} ` +
                    `${hPad(bytes[d + 4])}:${hPad(bytes[d + 5])}:${hPad(bytes[d + 6])} UTC`, d));
                break;
            case "pHYs": {
                const x = v.getUint32(d), y = v.getUint32(d + 4);
                rows.push(hRow("PNG", "PixelsPerUnit", bytes[d + 8] === 1
                    ? `${x} × ${y} px/m (${(x * 0.0254).toFixed(1)} × ${(y * 0.0254).toFixed(1)} dpi)`
                    : `${x} × ${y} (unit unknown)`, d));
                break;
            }
            case "gAMA":
                rows.push(hRow("PNG", "Gamma", (v.getUint32(d) / 100000).toFixed(5), d));
                break;
            case "sRGB":
                rows.push(hRow("PNG", "sRGBIntent", PNG_INTENTS[bytes[d]] ?? bytes[d], d));
                break;
            case "iCCP":
                rows.push(hRow("PNG", "ICCProfile", hDec(bytes.subarray(d, hCstr(bytes, d, d + len)), "latin1"), d));
                break;
            case "eXIf":
                rows.push(...walkTiffAt(bytes, d));
                break;
        }
        p += 12 + len;
        if (type === "IEND") { ended = true; break; }
    }
    if (!ended) rows.push(hRow("Warnings", "PNG", "No IEND chunk (truncated?)", p, true));
    else if (p < bytes.length)
        rows.push(hRow("Warnings", "TrailingData", `${bytes.length - p} bytes after IEND`, p, true));
    return rows;
}

//GIFs
function walkGif(bytes) {
    const rows = [], v = hView(bytes);
    if (bytes.length < 13) return rows;
    rows.push(hRow("GIF", "Version", hDec(bytes.subarray(0, 6), "latin1"), 0));
    rows.push(hRow("GIF", "Dimensions", `${v.getUint16(6, true)} × ${v.getUint16(8, true)}`, 6));

    let p = 13, frames = 0, ended = false;
    if (bytes[10] & 0x80) p += 3 * (1 << ((bytes[10] & 7) + 1));     // global colour table
    const skipSub = q => { while (q < bytes.length && bytes[q]) q += bytes[q] + 1; return q + 1; };

    while (p < bytes.length) {
        const b = bytes[p];
        if (b === 0x3B) { ended = true; p++; break; }
        if (b === 0x21) {                                             // extension block
            const label = bytes[p + 1];
            if (label === 0xFE) {                                     // comment
                let q = p + 2;
                const parts = [];
                while (q < bytes.length && bytes[q]) {
                    parts.push(hDec(bytes.subarray(q + 1, q + 1 + bytes[q]), "latin1"));
                    q += bytes[q] + 1;
                }
                rows.push(hRow("GIF", "Comment", parts.join(""), p));
            } else if (label === 0xFF) {                              // application extension
                rows.push(hRow("GIF", "ApplicationExtension",
                    hDec(bytes.subarray(p + 3, p + 3 + bytes[p + 2]), "latin1"), p));
            }
            p = skipSub(p + 2);
        } else if (b === 0x2C) {                                      // image descriptor
            frames++;
            const flags = bytes[p + 9];
            p += 10;
            if (flags & 0x80) p += 3 * (1 << ((flags & 7) + 1));      // local colour table
            p = skipSub(p + 1);                                       // +1 = LZW min code size
        } else break;
    }
    rows.push(hRow("GIF", "Frames", frames, 13));
    if (!ended) rows.push(hRow("Warnings", "GIF", "No trailer byte (truncated or malformed)", p, true));
    else if (p < bytes.length)
        rows.push(hRow("Warnings", "TrailingData", `${bytes.length - p} bytes after trailer`, p, true));
    return rows;
}

//BMP
const BMP_COMPRESSION = { 0: "BI_RGB", 1: "BI_RLE8", 2: "BI_RLE4", 3: "BI_BITFIELDS", 4: "BI_JPEG", 5: "BI_PNG" };

function walkBmp(bytes) {
    const rows = [], v = hView(bytes);
    if (bytes.length < 26) return rows;
    const declared = v.getUint32(2, true);
    rows.push(hRow("BMP", "DeclaredFileSize",
        declared === bytes.length ? `${declared} bytes` : `${declared} bytes (actual ${bytes.length})`,
        2, declared !== bytes.length));
    rows.push(hRow("BMP", "PixelDataOffset", v.getUint32(10, true), 10));
    const dib = v.getUint32(14, true);
    rows.push(hRow("BMP", "DIBHeaderSize", dib, 14));
    if (dib >= 40 && bytes.length >= 54) {
        const h = v.getInt32(22, true);
        rows.push(hRow("BMP", "Dimensions", `${v.getInt32(18, true)} × ${Math.abs(h)}${h < 0 ? " (top-down)" : ""}`, 18));
        rows.push(hRow("BMP", "BitsPerPixel", v.getUint16(28, true), 28));
        const c = v.getUint32(30, true);
        rows.push(hRow("BMP", "Compression", `${BMP_COMPRESSION[c] ?? "Unknown"} (${c})`, 30));
        rows.push(hRow("BMP", "ImageSize", v.getUint32(34, true), 34));
        rows.push(hRow("BMP", "PixelsPerMetre", `${v.getInt32(38, true)} × ${v.getInt32(42, true)}`, 38));
        rows.push(hRow("BMP", "ColorsUsed", v.getUint32(46, true), 46));
    } else if (dib === 12) {
        rows.push(hRow("BMP", "Dimensions", `${v.getUint16(18, true)} × ${v.getUint16(20, true)}`, 18));
        rows.push(hRow("BMP", "BitsPerPixel", v.getUint16(24, true), 24));
    }
    return rows;
}

//PDF
//Reads plain-text Info dictionaries. 
//Strings inside compressed object streams are not visible.
function pdfString(raw, key) {
    let b;
    if (raw[0] === "<") {
        const hex = raw.slice(1, -1).replace(/\s+/g, "");
        b = Uint8Array.from(hex.match(/../g) ?? [], h => parseInt(h, 16));
    } else {
        const s = raw.slice(1, -1).replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g, (_, c) =>
            /^[0-7]{1,3}$/.test(c) ? String.fromCharCode(parseInt(c, 8))
                : ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[c] ?? (c[0] === "\r" || c[0] === "\n" ? "" : c)));
        b = Uint8Array.from(s, ch => ch.charCodeAt(0) & 255);
    }
    let out;
    if (b[0] === 0xFE && b[1] === 0xFF) out = hDec(b.subarray(2), "utf-16be");
    else if (b[0] === 0xFF && b[1] === 0xFE) out = hDec(b.subarray(2), "utf-16le");
    else out = hDec(b, "latin1");
    if (key.endsWith("Date")) {
        const m = /^D:(\d{4})(\d\d)?(\d\d)?(\d\d)?(\d\d)?(\d\d)?([Z+-].*)?/.exec(out);
        if (m) out = `${m[1]}-${m[2] ?? "01"}-${m[3] ?? "01"} ${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"} ${m[7] ?? ""}`.trim();
    }
    return out;
}

function walkPdf(bytes) {
    const rows = [];
    const text = hDec(bytes, "latin1");
    const head = /^%PDF-(\d\.\d)/.exec(text);
    if (head) rows.push(hRow("PDF", "Version", head[1], 0));

    // Every match is listed, earlier revisions (incremental updates) show up too
    for (const key of ["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate"]) {
        const re = new RegExp(`/${key}\\s*(\\((?:\\\\.|[^\\\\)])*\\)|<[0-9A-Fa-f\\s]*>)`, "g");
        for (const m of text.matchAll(re)) rows.push(hRow("PDF Info", key, pdfString(m[1], key), m.index));
    }

    const eofs = (text.match(/%%EOF/g) ?? []).length;
    rows.push(hRow("PDF", "EOFMarkers", eofs > 1 ? `${eofs} (incremental updates: earlier versions may be recoverable)` : eofs,
        text.lastIndexOf("%%EOF"), eofs > 1));

    // Presence of features often checked in triage
    for (const flag of ["Encrypt", "JavaScript", "JS", "OpenAction", "AA", "Launch", "EmbeddedFile", "URI", "SubmitForm"]) {
        const i = text.search(new RegExp(`/${flag}(?![A-Za-z])`));
        if (i >= 0) rows.push(hRow("PDF features", flag, "present", i, ["JavaScript", "JS", "Launch", "OpenAction"].includes(flag)));
    }
    return rows;
}

//ZIP (also docx/xlsx/pptx/jar/apk/odt)
const ZIP_METHODS = { 0: "stored", 8: "deflate", 9: "deflate64", 12: "bzip2", 14: "lzma", 93: "zstd", 95: "xz", 99: "AES" };

function walkZip(bytes) {
    const rows = [], v = hView(bytes);
    let e = -1;
    for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 65535); p--) {
        if (v.getUint32(p, true) === 0x06054B50) { e = p; break; }
    }
    if (e < 0) return [hRow("Warnings", "ZIP", "End of central directory not found", 0, true)];

    const total = v.getUint16(e + 10, true), cdOff = v.getUint32(e + 16, true), cLen = v.getUint16(e + 20, true);
    rows.push(hRow("ZIP", "Entries", total, e + 10));
    if (cLen) rows.push(hRow("ZIP", "Comment", hDec(bytes.subarray(e + 22, e + 22 + cLen), "latin1"), e + 22));
    if (e + 22 + cLen < bytes.length)
        rows.push(hRow("Warnings", "TrailingData", `${bytes.length - (e + 22 + cLen)} bytes after end of central directory`, e + 22 + cLen, true));

    let p = cdOff;
    for (let i = 0; i < Math.min(total, 500) && p + 46 <= bytes.length; i++) {
        if (v.getUint32(p, true) !== 0x02014B50) {
            rows.push(hRow("Warnings", "ZIP", "Bad central directory entry signature", p, true));
            break;
        }
        const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true);
        const time = v.getUint16(p + 12, true), date = v.getUint16(p + 14, true);
        const csize = v.getUint32(p + 20, true), usize = v.getUint32(p + 24, true);
        const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
        const name = hDec(bytes.subarray(p + 46, p + 46 + nl), flags & 0x800 ? "utf-8" : "latin1");
        const when = `${(date >> 9) + 1980}-${hPad((date >> 5) & 15)}-${hPad(date & 31)} ` +
            `${hPad(time >> 11)}:${hPad((time >> 5) & 63)}:${hPad((time & 31) * 2)}`;
        rows.push(hRow("ZIP entries", name,
            `${usize} bytes (${csize} compressed, ${ZIP_METHODS[method] ?? "method " + method})` +
            `${flags & 1 ? ", encrypted" : ""} · ${when}`, v.getUint32(p + 42, true)));
        p += 46 + nl + xl + cl;
    }
    if (total > 500) rows.push(hRow("ZIP", "Note", `Showing first 500 of ${total} entries`, cdOff));
    return rows;
}

//RIFF (WAV, WebP, AVI)
const RIFF_INFO = {
    INAM: "Title", IART: "Artist", ICMT: "Comment", ICRD: "CreationDate", ISFT: "Software",
    IGNR: "Genre", ICOP: "Copyright", IPRD: "Product", IENG: "Engineer", ITCH: "Technician", ISBJ: "Subject"
};
const WAV_FORMATS = { 1: "PCM", 3: "IEEE float", 6: "A-law", 7: "µ-law", 0xFFFE: "Extensible" };

function walkRiff(bytes) {
    const rows = [], v = hView(bytes);
    if (bytes.length < 12) return rows;
    const id = o => hDec(bytes.subarray(o, o + 4), "latin1");
    rows.push(hRow("RIFF", "Form", id(8), 8));
    const declared = v.getUint32(4, true) + 8;
    if (declared !== bytes.length)
        rows.push(hRow("RIFF", "DeclaredSize", `${declared} bytes (actual ${bytes.length})`, 4, true));

    const walk = (p, end) => {
        while (p + 8 <= end) {
            const cid = id(p), len = v.getUint32(p + 4, true), d = p + 8;
            if (d + len > end) {
                rows.push(hRow("Warnings", "RIFF", `Chunk "${cid}" runs past its container`, p, true));
                break;
            }
            if (cid === "fmt " && len >= 16) {
                const tag = v.getUint16(d, true);
                rows.push(hRow("RIFF", "Format", `${WAV_FORMATS[tag] ?? "Unknown"} (${tag})`, d));
                rows.push(hRow("RIFF", "Channels", v.getUint16(d + 2, true), d + 2));
                rows.push(hRow("RIFF", "SampleRate", `${v.getUint32(d + 4, true)} Hz`, d + 4));
                rows.push(hRow("RIFF", "BitsPerSample", v.getUint16(d + 14, true), d + 14));
            } else if (cid === "LIST") {
                const lt = id(d);
                if (lt === "INFO") walk(d + 4, d + len);
                else rows.push(hRow("RIFF", "LIST", lt, d));
            } else if (RIFF_INFO[cid]) {
                rows.push(hRow("RIFF info", RIFF_INFO[cid], hDec(bytes.subarray(d, d + len), "latin1").replace(/\0+$/, ""), d));
            } else if (cid === "VP8X" && len >= 10) {                 // WebP extended header
                const w = 1 + (bytes[d + 4] | (bytes[d + 5] << 8) | (bytes[d + 6] << 16));
                const h = 1 + (bytes[d + 7] | (bytes[d + 8] << 8) | (bytes[d + 9] << 16));
                rows.push(hRow("WebP", "Canvas", `${w} × ${h}`, d + 4));
            } else if (cid === "EXIF") {
                const skip = hDec(bytes.subarray(d, d + 6), "latin1") === "Exif\0\0" ? 6 : 0;
                rows.push(...walkTiffAt(bytes, d + skip));
            } else if (cid === "XMP ") {
                rows.push(hRow("RIFF", "XMP", `${len} bytes of XMP`, d));
            } else if (cid === "data") {
                rows.push(hRow("RIFF", "data", `${len} bytes`, d));
            }
            p = d + len + (len & 1);                                  // chunks are padded to even size
        }
    };
    walk(12, Math.min(bytes.length, declared));
    return rows;
}

//ID3 (MP3)
const ID3_FRAMES = {
    TIT2: "Title", TPE1: "Artist", TALB: "Album", TYER: "Year", TDRC: "RecordingTime", TCON: "Genre",
    TRCK: "Track", TCOM: "Composer", TENC: "EncodedBy", TSSE: "EncoderSettings", TPE2: "AlbumArtist",
    TPUB: "Publisher", TCOP: "Copyright"
};

function id3Text(b) {
    const enc = b[0], body = b.subarray(1);
    let s;
    if (enc === 1) {
        if (body[0] === 0xFE && body[1] === 0xFF) s = hDec(body.subarray(2), "utf-16be");
        else s = hDec(body[0] === 0xFF && body[1] === 0xFE ? body.subarray(2) : body, "utf-16le");
    } else if (enc === 2) s = hDec(body, "utf-16be");
    else if (enc === 3) s = hDec(body);
    else s = hDec(body, "latin1");
    return s.replace(/\0+$/, "");
}

function walkId3(bytes) {
    const rows = [];
    const syncsafe = o => ((bytes[o] & 127) << 21) | ((bytes[o + 1] & 127) << 14) | ((bytes[o + 2] & 127) << 7) | (bytes[o + 3] & 127);

    if (hDec(bytes.subarray(0, 3), "latin1") === "ID3") {
        const ver = bytes[3], v = hView(bytes);
        rows.push(hRow("ID3", "Version", `2.${ver}.${bytes[4]}`, 3));
        if (ver === 3 || ver === 4) {
            let p = 10;
            const end = Math.min(10 + syncsafe(6), bytes.length);
            while (p + 10 <= end && bytes[p]) {
                const fid = hDec(bytes.subarray(p, p + 4), "latin1");
                const fsz = ver === 4 ? syncsafe(p + 4) : v.getUint32(p + 4);
                const d = p + 10;
                if (fsz === 0 || d + fsz > end) break;
                if (fid[0] === "T" && fid !== "TXXX") rows.push(hRow("ID3", ID3_FRAMES[fid] ?? fid, id3Text(bytes.subarray(d, d + fsz)), d));
                else if (fid === "APIC") rows.push(hRow("ID3", "AttachedPicture", `${fsz} bytes`, d));
                else rows.push(hRow("ID3", fid, `${fsz} bytes`, d));
                p = d + fsz;
            }
        } else {
            rows.push(hRow("Warnings", "ID3", `Frames of ID3v2.${ver} are not decoded`, 10, true));
        }
    }

    // ID3v1 trailer: last 128 bytes
    const t = bytes.length - 128;
    if (t >= 0 && hDec(bytes.subarray(t, t + 3), "latin1") === "TAG") {
        const f = (a, n) => hDec(bytes.subarray(t + a, t + a + n), "latin1").replace(/\0.*$/s, "").trim();
        rows.push(hRow("ID3v1", "Title", f(3, 30), t + 3));
        rows.push(hRow("ID3v1", "Artist", f(33, 30), t + 33));
        rows.push(hRow("ID3v1", "Album", f(63, 30), t + 63));
        rows.push(hRow("ID3v1", "Year", f(93, 4), t + 93));
        rows.push(hRow("ID3v1", "Comment", f(97, 30), t + 97));
    }
    return rows;
}

//registration
// >>> The keys must match EXACTLY what detectFileType() returns for each format.
Object.assign(METADATA_HANDLERS, {
    "PNG image": [walkPng],
    "GIF image (87a/89a)": [walkGif],
    "BMP image": [walkBmp],
    "PDF document": [walkPdf],
    "ZIP / DOCX / XLSX / PPTX / JAR": [walkZip],
    "WAV audio": [walkRiff],
    "WebP image": [walkRiff],
    "AVI video": [walkRiff],
    "MP3 audio (ID3)": [walkId3],
    "TIFF image": [b => walkTiffAt(b, 0)]
});