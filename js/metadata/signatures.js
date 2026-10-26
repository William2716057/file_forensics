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