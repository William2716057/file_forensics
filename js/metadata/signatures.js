const FILE_SIGNATURES = [ //match byte patterns
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
    { type: "UTF-8 text (BOM)", offset: 0, bytes: ["ef", "bb", "bf"] },
    { type: "WebP image", offset: 8, bytes: ["57", "45", "42", "50"] },
    { type: "AVI video", offset: 8, bytes: ["41", "56", "49", "20"] },
    { type: "TIFF image", offset: 0, bytes: ["49", "49", "2a", "00"] },   // little-endian
    { type: "TIFF image", offset: 0, bytes: ["4d", "4d", "00", "2a"] },   // big-endian
];

/*
//only matching bytes, not entire file structure can still be wrong
const FILE_SIGNATURES = [ //match byte patterns
    // Images
    { type: "PNG image", offset: 0, bytes: ["89", "50", "4e", "47", "0d", "0a", "1a", "0a"] },
    { type: "JPEG image", offset: 0, bytes: ["ff", "d8", "ff"] },
    { type: "GIF image (87a/89a)", offset: 0, bytes: ["47", "49", "46", "38"] },
    { type: "BMP image", offset: 0, bytes: ["42", "4d"] },
    { type: "WebP image", offset: 8, bytes: ["57", "45", "42", "50"] },
    { type: "TIFF image (little-endian)", offset: 0, bytes: ["49", "49", "2a", "00"] },
    { type: "TIFF image (big-endian)", offset: 0, bytes: ["4d", "4d", "00", "2a"] },
    { type: "ICO icon", offset: 0, bytes: ["00", "00", "01", "00"] },
    { type: "CUR cursor", offset: 0, bytes: ["00", "00", "02", "00"] },
    { type: "JPEG 2000 image", offset: 0, bytes: ["00", "00", "00", "0c", "6a", "50", "20", "20"] },
    { type: "JPEG 2000 codestream", offset: 0, bytes: ["ff", "4f", "ff", "51"] },
    { type: "OpenEXR image", offset: 0, bytes: ["76", "2f", "31", "01"] },
    { type: "HEIC/HEIF image (ftyp)", offset: 4, bytes: ["66", "74", "79", "70"] },
    { type: "AVIF image (ftyp)", offset: 4, bytes: ["66", "74", "79", "70"] },
    { type: "PSD image", offset: 0, bytes: ["38", "42", "50", "53"] },
    { type: "XCF image", offset: 0, bytes: ["67", "69", "6d", "70", "20", "78", "63", "66"] },
    { type: "FLIF image", offset: 0, bytes: ["46", "4c", "49", "46"] },

    // Documents and ebooks
    { type: "PDF document", offset: 0, bytes: ["25", "50", "44", "46"] },
    { type: "RTF document", offset: 0, bytes: ["7b", "5c", "72", "74", "66"] },
    { type: "Microsoft Compound File (DOC/XLS/PPT)", offset: 0, bytes: ["d0", "cf", "11", "e0", "a1", "b1", "1a", "e1"] },
    { type: "Microsoft Word / Excel / PowerPoint (OOXML ZIP)", offset: 0, bytes: ["50", "4b", "03", "04"] },
    { type: "PostScript document", offset: 0, bytes: ["25", "21", "50", "53"] },
    { type: "DjVu document", offset: 0, bytes: ["41", "54", "26", "54", "46", "4f", "52", "4d"] },
    { type: "EPUB ebook (ZIP-based)", offset: 0, bytes: ["50", "4b", "03", "04"] },
    { type: "MOBI ebook", offset: 60, bytes: ["42", "4f", "4f", "4b", "4d", "4f", "42", "49"] },
    { type: "Palm database / PDB", offset: 60, bytes: ["00", "00", "00", "00"] },

    // Archives and compressed files
    { type: "ZIP archive", offset: 0, bytes: ["50", "4b", "03", "04"] },
    { type: "ZIP empty archive", offset: 0, bytes: ["50", "4b", "05", "06"] },
    { type: "ZIP spanning archive", offset: 0, bytes: ["50", "4b", "07", "08"] },
    { type: "GZIP archive", offset: 0, bytes: ["1f", "8b"] },
    { type: "7-Zip archive", offset: 0, bytes: ["37", "7a", "bc", "af", "27", "1c"] },
    { type: "RAR archive v1.5-v4.x", offset: 0, bytes: ["52", "61", "72", "21", "1a", "07", "00"] },
    { type: "RAR archive v5+", offset: 0, bytes: ["52", "61", "72", "21", "1a", "07", "01", "00"] },
    { type: "BZIP2 archive", offset: 0, bytes: ["42", "5a", "68"] },
    { type: "XZ archive", offset: 0, bytes: ["fd", "37", "7a", "58", "5a", "00"] },
    { type: "Zstandard archive", offset: 0, bytes: ["28", "b5", "2f", "fd"] },
    { type: "LZ4 frame", offset: 0, bytes: ["04", "22", "4d", "18"] },
    { type: "LZIP archive", offset: 0, bytes: ["4c", "5a", "49", "50"] },
    { type: "Unix compress (.Z)", offset: 0, bytes: ["1f", "9d"] },
    { type: "CAB archive", offset: 0, bytes: ["4d", "53", "43", "46"] },
    { type: "AR archive", offset: 0, bytes: ["21", "3c", "61", "72", "63", "68", "3e", "0a"] },
    { type: "TAR archive (ustar)", offset: 257, bytes: ["75", "73", "74", "61", "72"] },

    // Executables and binary formats
    { type: "ELF executable / shared library / object", offset: 0, bytes: ["7f", "45", "4c", "46"] },
    { type: "Windows PE (EXE/DLL)", offset: 0, bytes: ["4d", "5a"] },
    { type: "Mach-O 32-bit (big-endian)", offset: 0, bytes: ["fe", "ed", "fa", "ce"] },
    { type: "Mach-O 32-bit (little-endian)", offset: 0, bytes: ["ce", "fa", "ed", "fe"] },
    { type: "Mach-O 64-bit (big-endian)", offset: 0, bytes: ["fe", "ed", "fa", "cf"] },
    { type: "Mach-O 64-bit (little-endian)", offset: 0, bytes: ["cf", "fa", "ed", "fe"] },
    { type: "Mach-O universal binary (32-bit)", offset: 0, bytes: ["ca", "fe", "ba", "be"] },
    { type: "Mach-O universal binary (64-bit)", offset: 0, bytes: ["ca", "fe", "ba", "bf"] },
    { type: "Java class file", offset: 0, bytes: ["ca", "fe", "ba", "be"] },
    { type: "WebAssembly module", offset: 0, bytes: ["00", "61", "73", "6d"] },
    { type: "DEX Android executable", offset: 0, bytes: ["64", "65", "78", "0a", "30"] },
    { type: "Java JAR / APK / WAR (ZIP-based)", offset: 0, bytes: ["50", "4b", "03", "04"] },
    { type: "Windows shortcut (LNK)", offset: 0, bytes: ["4c", "00", "00", "00", "01", "14", "02", "00"] },
    { type: "Windows Registry hive", offset: 0, bytes: ["72", "65", "67", "66"] },
    { type: "Windows minidump", offset: 0, bytes: ["4d", "44", "4d", "50"] },
    { type: "Windows shortcut / OLE Compound File", offset: 0, bytes: ["d0", "cf", "11", "e0", "a1", "b1", "1a", "e1"] },

    // Audio
    { type: "WAV audio", offset: 8, bytes: ["57", "41", "56", "45"] },
    { type: "MP3 audio (ID3)", offset: 0, bytes: ["49", "44", "33"] },
    { type: "MP3 audio (frame sync)", offset: 0, bytes: ["ff", "fb"] },
    { type: "FLAC audio", offset: 0, bytes: ["66", "4c", "61", "43"] },
    { type: "Ogg container (Vorbis/Opus)", offset: 0, bytes: ["4f", "67", "67", "53"] },
    { type: "AIFF audio", offset: 8, bytes: ["41", "49", "46", "46"] },
    { type: "AAC audio (ADTS)", offset: 0, bytes: ["ff", "f1"] },
    { type: "AAC audio (ADTS, MPEG-2)", offset: 0, bytes: ["ff", "f9"] },
    { type: "Musepack audio", offset: 0, bytes: ["4d", "50", "2b"] },
    { type: "Monkey's Audio (APE)", offset: 0, bytes: ["4d", "41", "43", "20"] },
    { type: "WavPack audio", offset: 0, bytes: ["77", "76", "70", "6b"] },
    { type: "MIDI file", offset: 0, bytes: ["4d", "54", "68", "64"] },
    { type: "AMR audio", offset: 0, bytes: ["23", "21", "41", "4d", "52", "0a"] },

    // Video and multimedia containers
    { type: "AVI video", offset: 8, bytes: ["41", "56", "49", "20"] },
    { type: "MP4 / MOV / M4V / 3GP (ftyp)", offset: 4, bytes: ["66", "74", "79", "70"] },
    { type: "Matroska / MKV / WebM", offset: 0, bytes: ["1a", "45", "df", "a3"] },
    { type: "FLV video", offset: 0, bytes: ["46", "4c", "56", "01"] },
    { type: "MPEG video", offset: 0, bytes: ["00", "00", "01", "b3"] },
    { type: "MPEG program stream", offset: 0, bytes: ["00", "00", "01", "ba"] },
    { type: "MPEG transport stream (188-byte packets)", offset: 0, bytes: ["47"] },
    { type: "RealMedia container", offset: 0, bytes: ["2e", "52", "4d", "46"] },
    { type: "3GPP2 video (ftyp)", offset: 4, bytes: ["66", "74", "79", "70"] },

    // Databases and structured data
    { type: "SQLite database", offset: 0, bytes: ["53", "51", "4c", "69", "74", "65", "20", "66", "6f", "72", "6d", "61", "74", "20", "33", "00"] },
    { type: "Microsoft Access database (MDB)", offset: 4, bytes: ["00", "01", "00", "00", "53", "74", "61", "6e", "64", "61", "72", "64", "20", "4a", "65", "74"] },
    { type: "Microsoft Access ACCDB", offset: 0, bytes: ["00", "01", "00", "00", "53", "74", "61", "6e", "64", "61", "72", "64", "20", "41", "43", "45", "44", "42"] },
    { type: "Berkeley DB", offset: 12, bytes: ["00", "05", "31", "62"] },
    { type: "Apache Parquet", offset: 0, bytes: ["50", "41", "52", "31"] },
    { type: "Apache Avro object container", offset: 0, bytes: ["4f", "62", "6a", "01"] },
    { type: "LevelDB log/table (possible)", offset: 0, bytes: ["44", "41", "54", "41"] },

    // Email and message formats
    { type: "Outlook PST", offset: 0, bytes: ["21", "42", "44", "4e"] },
    { type: "Outlook OST", offset: 0, bytes: ["21", "42", "44", "4e"] },
    { type: "EML / MBOX", offset: 0, bytes: ["46", "72", "6f", "6d", "20"] },

    // Disk images and forensic formats
    { type: "ISO 9660 / UDF disk image", offset: 32769, bytes: ["43", "44", "30", "30", "31"] },
    { type: "VMDK virtual disk", offset: 0, bytes: ["4b", "44", "4d"] },
    { type: "QCOW2 virtual disk", offset: 0, bytes: ["51", "46", "49", "fb"] },
    { type: "VHDX virtual disk", offset: 0, bytes: ["76", "68", "64", "78", "66", "69", "6c", "65"] },
    { type: "VHD virtual disk", offset: 0, bytes: ["63", "6f", "6e", "65", "63", "74", "69", "78"] },
    { type: "DMG disk image", offset: 0, bytes: ["78", "01", "73", "0d", "62", "62", "60"] },
    { type: "EWF forensic image (E01)", offset: 0, bytes: ["45", "56", "46", "09", "0d", "0a", "ff", "00"] },
    { type: "AFF forensic image", offset: 0, bytes: ["41", "46", "46"] },
    { type: "Windows memory dump (raw heuristic)", offset: 0, bytes: ["50", "41", "47", "45"] },

    // Fonts
    { type: "TrueType font", offset: 0, bytes: ["00", "01", "00", "00"] },
    { type: "OpenType font", offset: 0, bytes: ["4f", "54", "54", "4f"] },
    { type: "WOFF font", offset: 0, bytes: ["77", "4f", "46", "46"] },
    { type: "WOFF2 font", offset: 0, bytes: ["77", "4f", "46", "32"] },

    // Web and source formats
    { type: "UTF-8 text (BOM)", offset: 0, bytes: ["ef", "bb", "bf"] },
    { type: "UTF-16 LE text (BOM)", offset: 0, bytes: ["ff", "fe"] },
    { type: "UTF-16 BE text (BOM)", offset: 0, bytes: ["fe", "ff"] },
    { type: "UTF-32 LE text (BOM)", offset: 0, bytes: ["ff", "fe", "00", "00"] },
    { type: "UTF-32 BE text (BOM)", offset: 0, bytes: ["00", "00", "fe", "ff"] },
    { type: "XML document", offset: 0, bytes: ["3c", "3f", "78", "6d", "6c"] },
    { type: "HTML document (doctype)", offset: 0, bytes: ["3c", "21", "44", "4f", "43", "54", "59", "50", "45"] },
    { type: "HTML document (html tag)", offset: 0, bytes: ["3c", "68", "74", "6d", "6c"] },

    // Cryptographic and miscellaneous formats
    { type: "DER-encoded X.509 certificate / ASN.1 object", offset: 0, bytes: ["30", "82"] },
    { type: "OpenSSH private key", offset: 0, bytes: ["2d", "2d", "2d", "2d", "2d", "42", "45", "47", "49", "4e", "20", "4f", "50", "45", "4e", "53", "53", "48", "20", "50", "52", "49", "56", "41", "54", "45", "20", "4b", "45", "59", "2d", "2d", "2d", "2d", "2d"] },
    { type: "PEM certificate / key", offset: 0, bytes: ["2d", "2d", "2d", "2d", "2d", "42", "45", "47", "49", "4e"] },
    { type: "WebSocket / TLS record (heuristic)", offset: 0, bytes: ["16", "03"] },
    { type: "Windows event log (EVTX)", offset: 0, bytes: ["45", "6c", "66", "46", "69", "6c", "65", "00"] },
]; */

//add code to check against heuristics for true or false file headers