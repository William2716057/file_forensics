# Hex Editor
 
A browser-based hex viewer and file analysis tool, written in HTML, CSS and JavaScript. This allows users to inspect corrupted files, check for metadata, inspect and edit bytes, check for steganographic signatures. This can be useful for purposes such as file repair, digital recovery or capture the flag style challengese.
 
**Link to live demonstration:** https://william2716057.github.io/file_forensics
 
## Features
 
### Hex viewer
- Hex and ASCII table view of any loaded file
- Hex / binary view toggle
- Click-and-drag multi-byte selection
- Double-click-and-drag pattern highlighting across both the hex and ASCII columns
- Live preview box below the hex table

### Editing
- Insert, edit and delete bytes
- Undo / redo
- Bit shift left / right
- Save as a reversed file, or export as hex text

### Analysis
- Magic-number file type detection
- Metadata side panel showing file details
- EXIF panel for image files, extracted by `exif.js`, which walks the JPEG structure, reads the IFDs and decodes tag values

## Getting started
 
```bash
git clone https://github.com/William2716057/file_forensics.git
cd file_forensics
```
 
Open `index.html` in a browser, or serve the folder locally:
 
```bash
python -m http.server 8000
```
 
Then visit `http://localhost:8000`.
 
## Project structure
 
```
file_forensics/
├── index.html          # Page layout
├── styles.css          # Styling
├── js/
│   ├── script.js       # Hex table, selection, editing, file loading
│   └── metadata/
│       └── metadata.js # Metadata handling
└── exif.js             # EXIF parsing and the EXIF panel
```
 
 
### How the EXIF code is organised
 
| Function | Purpose |
| --- | --- |
| `walkJpeg` / `findJpegExif` | Locate the EXIF segment inside a JPEG |
| `readIfd` / `readValue` | Parse image file directories and decode tag values |
| `collectEntries` | Gather parsed tags for display |
| `METADATA_HANDLERS` | Dispatches to a handler based on detected file type |
| `updateExif` | Renders results into `#exifPanelContent` |
 
## Privacy
 
All processing happens client-side. Files you load will never be uploaded anywhere.
 
