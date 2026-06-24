import { useEffect } from "react";
import win98raw from "98.css?raw";
import { publicUrl } from "../../utils/publicUrl";

// 98.css ships with relative font urls and one malformed media query that
// breaks the CSS minifier — so we import it raw and patch both here before
// injecting. Font files are copied into public/fonts/98/.
const win98css = win98raw
  .replace(/url\((ms_sans_serif(?:_bold)?\.woff2?)\)/g, (_m, file) => `url(${publicUrl(`fonts/98/${file}`)})`)
  .replace("@media (not(hover))", "@media (hover: none)");

// Pixel-art cursors for any Win98 subtree. High-specificity selectors (incl.
// the dark-theme variant) override index.css's custom dot/crosshair cursors,
// which use !important.
const cursorArrow = publicUrl("cursors/retro-arrow.svg");
const cursorHand = publicUrl("cursors/retro-hand.svg");
const CLICKABLE = "a, button, [role=button], summary";
const arrowSel = [
  "html [data-win98-root]",
  "html [data-win98-root] *",
  'html[data-theme="dark"] [data-win98-root]',
  'html[data-theme="dark"] [data-win98-root] *',
].join(", ");
const handSel = ["html [data-win98-root]", 'html[data-theme="dark"] [data-win98-root]']
  .flatMap((root) => CLICKABLE.split(", ").map((c) => `${root} ${c}`))
  .join(", ");
const cursorCss = `
${arrowSel} {
  cursor: url("${cursorArrow}") 0 0, default !important;
}
${handSel} {
  cursor: url("${cursorHand}") 5 0, pointer !important;
}`;

/**
 * Injects 98.css + the retro pixel cursors into a scoped <style> while the
 * caller is mounted, removing it on unmount. The styles only take effect under
 * the `[data-win98-root]` subtree, so the rest of the site keeps its own look.
 * Shared by the boot screen and the post-login Win98 desktop.
 */
export function useWin98Styles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-win98", "");
    style.textContent = win98css + cursorCss;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);
}
