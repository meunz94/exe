import { useEffect } from "react";
import { publicUrl } from "../../utils/publicUrl";

/* ---------------------------------------------------------------------------
 * Retro pixel cursors for the boot desk.
 *
 * This used to inject a recoloured, scoped copy of 98.css for the Win98 window
 * chrome. That chrome is gone — entries are full pages now — so all that's left
 * is the cursor pair, which still belongs on the machine's own screen.
 * ------------------------------------------------------------------------- */

const cursorArrow = publicUrl("cursors/retro-arrow.svg");
const cursorHand = publicUrl("cursors/retro-hand.svg");

const CLICKABLE = ["a", "button", "[role=button]", "summary"];

// High specificity on purpose: index.css sets the site-wide cursors with
// !important, so these have to outrank them inside the scope.
const arrowSel = ["html [data-win98-root]", "html [data-win98-root] *"].join(", ");
const handSel = CLICKABLE.map((c) => `html [data-win98-root] ${c}`).join(", ");

const cursorCss = `
${arrowSel} {
  cursor: url("${cursorArrow}") 0 0, default !important;
}
${handSel} {
  cursor: url("${cursorHand}") 5 0, pointer !important;
}`;

/**
 * Injects the retro cursors while the caller is mounted, scoped to the
 * `[data-win98-root]` subtree so the rest of the site keeps its own pointers.
 */
export function useRetroCursors() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-retro-cursors", "");
    style.textContent = cursorCss;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);
}
