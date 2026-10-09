import { createContext, useContext } from "react";

// Vertical rhythm. "compact" is only used when a document would otherwise spill
// onto an extra page that compacting can remove (see render.js); sizes of
// titles, prices and type stay identical.
export const DensityContext = createContext(false);
export const useCompact = () => useContext(DensityContext);
export const pick = (compact, normal, tight) => (compact ? tight : normal);
