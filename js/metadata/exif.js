const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

//exif data tags 
const EXIF_TAGS = {
    0x010F: "Make", 0x0110: "Model", 0x0112: "Orientation", 0x0131: "Software",
    0x0132: "DateTime", 0x013B: "Artist", 0x8298: "Copyright",
    0x829A: "ExposureTime", 0x829D: "FNumber", 0x8827: "ISO",
    0x9003: "DateTimeOriginal", 0x9004: "DateTimeDigitized", 0x920A: "FocalLength",
    0xA002: "PixelXDimension", 0xA003: "PixelYDimension", 0xA434: "LensModel"
    //add more
};

//metadata tags
const GPS_TAGS = {
    1: "GPSLatitudeRef", 2: "GPSLatitude", 3: "GPSLongitudeRef", 4: "GPSLongitude",
    5: "GPSAltitudeRef", 6: "GPSAltitude", 7: "GPSTimeStamp", 29: "GPSDateStamp"
    //add more
};

const POINTER_TAGS = new Set([0x8769, 0x8825, 0xA005]);

const METADATA_HANDLERS = {
    "JPEG image": [walkJpeg],
    //"PNG image": [walkPng], uncomment when handlers functions are written
    //"PDF document": [parsePdfInfo],
    // add more
};

function readValue(view, entry, le) {
    const { type, count, size, valPos } = entry;
    if (!TYPE_SIZE[type] || valPos < 0 || valPos + size > view.byteLength) return null;

    if (type === 2) {                                      // ASCII
        const raw = new Uint8Array(view.buffer, view.byteOffset + valPos, count);
        return new TextDecoder("latin1").decode(raw).replace(/\0+$/, "");
    }
    if (type === 7) {                                      // UNDEFINED: show a hex preview
        const raw = new Uint8Array(view.buffer, view.byteOffset + valPos, Math.min(count, 16));
        return Array.from(raw, hex2).join(" ") + (count > 16 ? " …" : "");
    }

    const out = [];
    for (let i = 0; i < Math.min(count, 64); i++) {
        const p = valPos + i * TYPE_SIZE[type];
        switch (type) {
            case 1: out.push(view.getUint8(p)); break;
            case 3: out.push(view.getUint16(p, le)); break;
            case 4: out.push(view.getUint32(p, le)); break;
            case 5: { const d = view.getUint32(p + 4, le); out.push(d ? view.getUint32(p, le) / d : 0); break; }
            case 6: out.push(view.getInt8(p)); break;
            case 8: out.push(view.getInt16(p, le)); break;
            case 9: out.push(view.getInt32(p, le)); break;
            case 10: { const d = view.getInt32(p + 4, le); out.push(d ? view.getInt32(p, le) / d : 0); break; }
            case 11: out.push(view.getFloat32(p, le)); break;
            case 12: out.push(view.getFloat64(p, le)); break;
        }
    }
    return out.length === 1 ? out[0] : out;
}

function collectEntries(view, entries, le, group, names, rows) {
    for (const e of entries) {
        if (POINTER_TAGS.has(e.tag)) continue;             // followed separately
        rows.push({
            group,
            tag: names[e.tag] ?? "0x" + e.tag.toString(16).padStart(4, "0"),
            value: readValue(view, e, le),
            offset: e.valPos                               // absolute file offset
        });
    }
}

//walkthroughs 
function walkJpeg(bytes) {
    const base = findJpegExif(bytes);
    if (base < 0) return [];

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const order = view.getUint16(base);
    if (order !== 0x4949 && order !== 0x4D4D)
        return [{ group: "Warnings", tag: "EXIF", value: "Bad TIFF byte order marker", offset: base, warn: true }];
    const le = order === 0x4949;

    const rows = [];
    const seen = new Set();
    const ifd0 = readIfd(view, base, view.getUint32(base + 4, le), le, seen);
    collectEntries(view, ifd0.entries, le, "Image", EXIF_TAGS, rows);

    const follow = (tag, group, names) => {
        const p = ifd0.entries.find(e => e.tag === tag);
        if (!p) return;
        const sub = readIfd(view, base, view.getUint32(p.valPos, le), le, seen);
        collectEntries(view, sub.entries, le, group, names, rows);
    };
    follow(0x8769, "Exif", EXIF_TAGS);
    follow(0x8825, "GPS", GPS_TAGS);

    if (ifd0.next) {                                       // IFD1 = embedded thumbnail
        const ifd1 = readIfd(view, base, ifd0.next, le, seen);
        collectEntries(view, ifd1.entries, le, "Thumbnail", EXIF_TAGS, rows);
    }
    return rows;
}



function extractMetadata(bytes) {
    const handlers = METADATA_HANDLERS[detectFileType(bytes)] ?? []; //access metadata.js from exif.js
    return handlers.flatMap(h => {
        try { return h(bytes); }
        catch (err) { return [{ group: "Warnings", tag: "Parser", value: String(err.message), offset: 0, warn: true }]; }
    });
}

const fmt = v => Array.isArray(v) ? v.join(", ")
    : typeof v === "number" && !Number.isInteger(v) ? v.toFixed(4)
        : v ?? "unreadable";

function updateExif(bytes) {
    const box = document.getElementById("exifPanelContent");
    const rows = extractMetadata(bytes);
    if (!rows.length) { box.innerHTML = '<div class="exif-empty">No metadata found.</div>'; return; }

    const groups = new Map();
    for (const r of rows) {
        if (!groups.has(r.group)) groups.set(r.group, []);
        groups.get(r.group).push(r);
    }
    box.innerHTML = '<div class="exif-list">' + [...groups].map(([g, items]) =>
        `<div class="exif-group"><h3>${esc(g)}</h3>` + items.map(r =>
            `<div class="exif-row" data-offset="${r.offset}">
               <span class="exif-tag">${esc(r.tag)}</span>
               <span class="exif-value${r.warn ? " warn" : ""}">${esc(fmt(r.value))}</span>
             </div>`).join("") + "</div>").join("") + "</div>";
}


//find offsets of TIFF headers in JPEG
function findJpegExif(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return -1;
    let p = 2;
    while (p + 4 <= bytes.length && bytes[p] === 0xFF) {
        const marker = bytes[p + 1];
        if (marker === 0xDA || marker === 0xD9) break;        // image data / end
        const len = (bytes[p + 2] << 8) | bytes[p + 3];
        const isExif = marker === 0xE1 &&
            String.fromCharCode(...bytes.subarray(p + 4, p + 10)) === "Exif\0\0";
        if (isExif) return p + 10;
        p += 2 + len;
    }
    return -1;
}

//Parse IFDs 

function readIfd(view, base, off, le, seen) {
    const entries = [];
    if (seen.has(off) || base + off + 2 > view.byteLength) return { entries, next: 0 };
    seen.add(off);                                            // stops looping IFD chains
    const n = Math.min(view.getUint16(base + off, le), 512);  // cap entry count
    for (let i = 0; i < n; i++) {
        const e = base + off + 2 + i * 12;
        if (e + 12 > view.byteLength) break;
        const type = view.getUint16(e + 2, le);
        const count = view.getUint32(e + 4, le);
        const size = (TYPE_SIZE[type] || 0) * count;
        const valPos = size <= 4 ? e + 8 : base + view.getUint32(e + 8, le);
        entries.push({ tag: view.getUint16(e, le), type, count, size, valPos });
    }
    const nextPos = base + off + 2 + n * 12;
    const next = nextPos + 4 <= view.byteLength ? view.getUint32(nextPos, le) : 0;
    return { entries, next };
}
