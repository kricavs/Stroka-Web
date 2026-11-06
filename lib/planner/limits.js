// Defensive limits for planning imports (one place). Pure, browser-safe.
export const MB = 1024 * 1024;

// Vercel Functions reject request bodies above ~4.5 MB, so 4 MB is the real ceiling.
export const MAX_XLSX_BYTES = 4 * MB;

// XLSX is a ZIP: bound what it may unpack to (zip-bomb protection).
export const MAX_ZIP_ENTRIES = 60;
export const MAX_UNCOMPRESSED_BYTES = 24 * MB; // all parts together
export const MAX_PART_BYTES = 12 * MB; // any single part

// Workbook shape.
export const MAX_SHEETS = 12;
export const MAX_ROWS_PER_SHEET = 2000;
export const MAX_COLS = 40;
export const MAX_CELL_CHARS = 2000;
export const MAX_ITEMS = 500;
