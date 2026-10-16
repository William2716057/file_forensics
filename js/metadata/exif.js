const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

const SHOW_PADDING = false;   // hide Microsoft 0xea1c padding rows by default

//exif data tags 
// (legacy single-table lookups, superseded by the per-IFD tables below; no longer used by the parser)
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

// find each exif tag
const TAGS_IFD0 = {
    0x00fe: "NewSubfileType", 0x0100: "ImageWidth", 0x0101: "ImageLength",
    0x0102: "BitsPerSample", 0x0103: "Compression",
    0x0106: "PhotometricInterpretation", 0x010e: "ImageDescription",
    0x010f: "Make", 0x0110: "Model", 0x0112: "Orientation",
    0x0115: "SamplesPerPixel", 0x011a: "XResolution", 0x011b: "YResolution",
    0x011c: "PlanarConfiguration", 0x0128: "ResolutionUnit",
    0x0131: "Software", 0x0132: "DateTime", 0x013b: "Artist",
    0x013e: "WhitePoint", 0x013f: "PrimaryChromaticities",
    0x0201: "JPEGInterchangeFormat", 0x0202: "JPEGInterchangeFormatLength",
    0x0211: "YCbCrCoefficients", 0x0213: "YCbCrPositioning",
    0x0214: "ReferenceBlackWhite", 0x8298: "Copyright",
    0x8769: "ExifIFDPointer", 0x8825: "GPSInfoIFDPointer",
    0x9c9b: "XPTitle", 0x9c9c: "XPComment", 0x9c9d: "XPAuthor",
    0x9c9e: "XPKeywords", 0x9c9f: "XPSubject",
    0xea1c: "Padding (Microsoft)"
};

const TAGS_EXIF = {
    0x829a: "ExposureTime", 0x829d: "FNumber", 0x8822: "ExposureProgram",
    0x8824: "SpectralSensitivity", 0x8827: "ISO", 0x8828: "OECF",
    0x8830: "SensitivityType", 0x9000: "ExifVersion",
    0x9003: "DateTimeOriginal", 0x9004: "DateTimeDigitized",
    0x9010: "OffsetTime", 0x9011: "OffsetTimeOriginal",
    0x9012: "OffsetTimeDigitized", 0x9101: "ComponentsConfiguration",
    0x9102: "CompressedBitsPerPixel", 0x9201: "ShutterSpeedValue",
    0x9202: "ApertureValue", 0x9203: "BrightnessValue",
    0x9204: "ExposureBiasValue", 0x9205: "MaxApertureValue",
    0x9206: "SubjectDistance", 0x9207: "MeteringMode",
    0x9208: "LightSource", 0x9209: "Flash", 0x920a: "FocalLength",
    0x9214: "SubjectArea", 0x927c: "MakerNote", 0x9286: "UserComment",
    0x9290: "SubSecTime", 0x9291: "SubSecTimeOriginal",
    0x9292: "SubSecTimeDigitized", 0xa000: "FlashpixVersion",
    0xa001: "ColorSpace", 0xa002: "PixelXDimension",
    0xa003: "PixelYDimension", 0xa005: "InteroperabilityIFDPointer",
    0xa20e: "FocalPlaneXResolution", 0xa20f: "FocalPlaneYResolution",
    0xa210: "FocalPlaneResolutionUnit", 0xa217: "SensingMethod",
    0xa300: "FileSource", 0xa301: "SceneType", 0xa401: "CustomRendered",
    0xa402: "ExposureMode", 0xa403: "WhiteBalance",
    0xa404: "DigitalZoomRatio", 0xa405: "FocalLengthIn35mmFilm",
    0xa406: "SceneCaptureType", 0xa407: "GainControl",
    0xa408: "Contrast", 0xa409: "Saturation", 0xa40a: "Sharpness",
    0xa40c: "SubjectDistanceRange", 0xa420: "ImageUniqueID",
    0xa430: "CameraOwnerName", 0xa431: "BodySerialNumber",
    0xa432: "LensSpecification", 0xa433: "LensMake",
    0xa434: "LensModel", 0xa435: "LensSerialNumber",
    0xea1c: "Padding (Microsoft)"
};

const TAGS_GPS = {
    0x0000: "GPSVersionID", 0x0001: "GPSLatitudeRef", 0x0002: "GPSLatitude",
    0x0003: "GPSLongitudeRef", 0x0004: "GPSLongitude",
    0x0005: "GPSAltitudeRef", 0x0006: "GPSAltitude",
    0x0007: "GPSTimeStamp", 0x0008: "GPSSatellites", 0x0009: "GPSStatus",
    0x000a: "GPSMeasureMode", 0x000b: "GPSDOP", 0x000c: "GPSSpeedRef",
    0x000d: "GPSSpeed", 0x000e: "GPSTrackRef", 0x000f: "GPSTrack",
    0x0010: "GPSImgDirectionRef", 0x0011: "GPSImgDirection",
    0x0012: "GPSMapDatum", 0x0013: "GPSDestLatitudeRef",
    0x0014: "GPSDestLatitude", 0x0015: "GPSDestLongitudeRef",
    0x0016: "GPSDestLongitude", 0x0017: "GPSDestBearingRef",
    0x0018: "GPSDestBearing", 0x0019: "GPSDestDistanceRef",
    0x001a: "GPSDestDistance", 0x001b: "GPSProcessingMethod",
    0x001c: "GPSAreaInformation", 0x001d: "GPSDateStamp",
    0x001e: "GPSDifferential", 0x001f: "GPSHPositioningError"
};

const TAGS_INTEROP = { 0x0001: "InteroperabilityIndex", 0x0002: "InteroperabilityVersion" };

const IFD_TABLES = {
    IFD0: TAGS_IFD0, IFD1: TAGS_IFD0, Exif: TAGS_EXIF,
    GPS: TAGS_GPS, Interop: TAGS_INTEROP
};

// Enum value labels
const ENUMS = {
    Orientation: {
        1: "Normal", 2: "Mirrored horizontal", 3: "Rotated 180°", 4: "Mirrored vertical",
        5: "Mirrored horizontal, rotated 270° CW", 6: "Rotated 90° CW",
        7: "Mirrored horizontal, rotated 90° CW", 8: "Rotated 270° CW"
    },
    ResolutionUnit: { 1: "None", 2: "Inches", 3: "Centimetres" },
    FocalPlaneResolutionUnit: { 1: "None", 2: "Inches", 3: "Centimetres" },
    Compression: { 1: "Uncompressed", 6: "JPEG (old-style)", 7: "JPEG" },
    PhotometricInterpretation: { 0: "WhiteIsZero", 1: "BlackIsZero", 2: "RGB", 6: "YCbCr" },
    YCbCrPositioning: { 1: "Centred", 2: "Co-sited" },
    ExposureProgram: {
        0: "Not defined", 1: "Manual", 2: "Normal program", 3: "Aperture priority",
        4: "Shutter priority", 5: "Creative (slow)", 6: "Action (fast)", 7: "Portrait", 8: "Landscape"
    },
    MeteringMode: {
        0: "Unknown", 1: "Average", 2: "Centre-weighted average", 3: "Spot",
        4: "Multi-spot", 5: "Multi-segment (pattern)", 6: "Partial", 255: "Other"
    },
    LightSource: {
        0: "Unknown", 1: "Daylight", 2: "Fluorescent", 3: "Tungsten", 4: "Flash", 9: "Fine weather",
        10: "Cloudy", 11: "Shade", 12: "Daylight fluorescent", 13: "Day white fluorescent",
        14: "Cool white fluorescent", 15: "White fluorescent", 17: "Standard light A",
        18: "Standard light B", 19: "Standard light C", 20: "D55", 21: "D65", 22: "D75", 23: "D50",
        24: "ISO studio tungsten", 255: "Other"
    },
    ColorSpace: { 1: "sRGB", 65535: "Uncalibrated" },
    SensingMethod: {
        1: "Not defined", 2: "One-chip colour area", 3: "Two-chip colour area",
        4: "Three-chip colour area", 5: "Colour sequential area", 7: "Trilinear", 8: "Colour sequential linear"
    },
    CustomRendered: { 0: "Normal", 1: "Custom" },
    ExposureMode: { 0: "Auto", 1: "Manual", 2: "Auto bracket" },
    WhiteBalance: { 0: "Auto", 1: "Manual" },
    SceneCaptureType: { 0: "Standard", 1: "Landscape", 2: "Portrait", 3: "Night" },
    GainControl: { 0: "None", 1: "Low gain up", 2: "High gain up", 3: "Low gain down", 4: "High gain down" },
    Contrast: { 0: "Normal", 1: "Soft", 2: "Hard" },
    Saturation: { 0: "Normal", 1: "Low", 2: "High" },
    Sharpness: { 0: "Normal", 1: "Soft", 2: "Hard" },
    SubjectDistanceRange: { 0: "Unknown", 1: "Macro", 2: "Close", 3: "Distant" },
    GPSAltitudeRef: { 0: "Above sea level", 1: "Below sea level" },
    GPSLatitudeRef: { N: "North", S: "South" },
    GPSLongitudeRef: { E: "East", W: "West" },
    GPSImgDirectionRef: { T: "True north", M: "Magnetic north" },
    GPSTrackRef: { T: "True north", M: "Magnetic north" },
    GPSSpeedRef: { K: "km/h", M: "mph", N: "knots" },
    GPSStatus: { A: "Measurement active", V: "Measurement void" },
    GPSDifferential: { 0: "No correction", 1: "Differential correction applied" }
};

// Flash is a bitfield, so decode it separately.
function decodeFlash(v) {
    const fired = v & 1;
    const ret = (v >> 1) & 3;
    const mode = (v >> 3) & 3;
    const none = (v >> 5) & 1;
    const red = (v >> 6) & 1;
    const parts = [fired ? "Fired" : "Did not fire"];
    if (ret === 2) parts.push("return not detected");
    if (ret === 3) parts.push("return detected");
    if (mode === 1) parts.push("compulsory");
    if (mode === 2) parts.push("suppressed");
    if (mode === 3) parts.push("auto");
    if (none) parts.push("no flash function");
    if (red) parts.push("red-eye reduction");
    return parts.join(", ");
}

// ---------- Byte-level decoders ----------
function decodeUTF16LE(bytes) {
    return new TextDecoder("utf-16le").decode(new Uint8Array(bytes)).replace(/\0+$/, "");
}

// EXIF ASCII fields often hold UTF-8 anyway: try UTF-8 first, fall back to Latin-1
function decodeExifText(bytes) {
    const u8 = new Uint8Array(bytes);
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/\0+$/, "");
    } catch {
        return new TextDecoder("latin1").decode(u8).replace(/\0+$/, "");
    }
}

// Version tags (ExifVersion "0210", FlashpixVersion "0100")
function decodeVersion(bytes) {
    const s = String.fromCharCode(...bytes);
    return /^\d{4}$/.test(s) ? `${+s.slice(0, 2)}.${s.slice(2)}` : s;
}

// UserComment starts with an 8-byte charset ID
function decodeUserComment(bytes) {
    const id = String.fromCharCode(...bytes.slice(0, 8)).replace(/\0/g, "");
    const body = bytes.slice(8);
    if (id === "UNICODE") return decodeUTF16LE(body);
    return decodeExifText(body);
}

const METADATA_HANDLERS = {
    "JPEG image": [walkJpeg],
    //"PNG image": [walkPng], uncomment when handlers functions are written
    //"PDF document": [parsePdfInfo],
    // add more
};

function readValue(view, entry, le) {
    const { type, count, size, valPos } = entry;
    if (!TYPE_SIZE[type] || valPos < 0 || valPos + size > view.byteLength) return null;

    const raw = n => new Uint8Array(view.buffer, view.byteOffset + valPos, Math.min(count, n));

    if (type === 2) return decodeExifText(raw(count));             // ASCII
    if (type === 7) return Array.from(raw(1024));                  // UNDEFINED: raw bytes

    const cap = type === 1 ? 1024 : 64;
    const out = [];
    for (let i = 0; i < Math.min(count, cap); i++) {
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

function formatDMS(arr, ref) {
    if (!Array.isArray(arr) || arr.length < 2) return String(arr);
    const [d, m, s = 0] = arr;
    const dec = d + m / 60 + s / 3600;
    const signed = (ref === "S" || ref === "W") ? -dec : dec;
    // Some cameras store decimal minutes with a zero seconds field
    const label = s === 0 && !Number.isInteger(m) ? `${d}° ${m}'` : `${d}° ${m}' ${s}"`;
    return `${label} ${ref || ""} (${signed.toFixed(6)})`;
}

function describeTag(ifd, tag, value, entry, ctx = {}) {
    const name = (IFD_TABLES[ifd] || {})[tag] ?? "0x" + tag.toString(16).padStart(4, "0");
    if (value == null) return { name, raw: null, display: null };

    let display = value;
    const isBytes = Array.isArray(value) && (entry.type === 1 || entry.type === 7);

    if (name.startsWith("XP") && isBytes) display = decodeUTF16LE(value);
    else if (name === "ExifVersion" || name === "FlashpixVersion") display = decodeVersion(value);
    else if (name === "UserComment" && isBytes) display = decodeUserComment(value);
    else if (name === "Flash") display = decodeFlash(value);
    else if (name === "ComponentsConfiguration" && isBytes)
        display = value.map(v => ["-", "Y", "Cb", "Cr", "R", "G", "B"][v] ?? v).join("");
    else if (name === "GPSLatitude") display = formatDMS(value, ctx.GPSLatitudeRef);
    else if (name === "GPSLongitude") display = formatDMS(value, ctx.GPSLongitudeRef);
    else if (name === "GPSImgDirection" || name === "GPSTrack") display = `${(+value).toFixed(2)}°`;
    else if (name === "FNumber") display = `f/${(+value).toFixed(1)}`;
    else if (name === "ExposureTime") display = value > 0 && value < 1 ? `1/${Math.round(1 / value)} s` : `${value} s`;
    else if (name === "FocalLength" || name === "FocalLengthIn35mmFilm") display = `${value} mm`;
    else if (name === "GPSAltitude") display = `${value} m`;
    else if (name.startsWith("Padding")) display = `${entry.count} bytes of padding`;
    else if (ENUMS[name] && ENUMS[name][value] !== undefined) display = `${ENUMS[name][value]} (${value})`;
    else if (isBytes && entry.type === 7)           // unknown UNDEFINED blob: hex preview
        display = value.slice(0, 16).map(hex2).join(" ") + (entry.count > 16 ? " …" : "");

    return { name, raw: value, display };
}

function collectEntries(view, entries, le, group, ifd, rows) {
    const names = IFD_TABLES[ifd] ?? {};
    const values = entries.map(e => readValue(view, e, le));

    // Sibling values (e.g. GPSLatitudeRef) so lat/long can be shown signed
    const ctx = {};
    entries.forEach((e, i) => { if (names[e.tag]) ctx[names[e.tag]] = values[i]; });

    entries.forEach((e, i) => {
        if (POINTER_TAGS.has(e.tag)) return;                       // followed separately
        const d = describeTag(ifd, e.tag, values[i], e, ctx);
        if (d.name.startsWith("Padding") && !SHOW_PADDING) return;
        rows.push({
            group,
            tag: d.name,
            value: d.display,
            raw: d.raw,
            offset: e.valPos                               // absolute file offset
        });
    });
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
    collectEntries(view, ifd0.entries, le, "Image", "IFD0", rows);

    const follow = (entries, tag, group, ifd) => {
        const p = entries.find(e => e.tag === tag);
        if (!p) return null;
        const sub = readIfd(view, base, view.getUint32(p.valPos, le), le, seen);
        collectEntries(view, sub.entries, le, group, ifd, rows);
        return sub;
    };
    const exif = follow(ifd0.entries, 0x8769, "Exif", "Exif");
    if (exif) follow(exif.entries, 0xA005, "Interop", "Interop");
    follow(ifd0.entries, 0x8825, "GPS", "GPS");

    if (ifd0.next) {                                       // IFD1 = embedded thumbnail
        const ifd1 = readIfd(view, base, ifd0.next, le, seen);
        collectEntries(view, ifd1.entries, le, "Thumbnail", "IFD1", rows);
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
