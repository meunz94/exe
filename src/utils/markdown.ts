const CJK =
  "[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]";

const RE_BOLD = new RegExp(`\\*\\*(.+?)\\*\\*(${CJK})`, "g");
const RE_ITALIC = new RegExp(`(?<!\\*)\\*([^*\\r\\n]+?)\\*(${CJK})`, "g");

export function fixCjkEmphasis(text: string): string {
  return text.replace(RE_BOLD, "<strong>$1</strong>$2").replace(RE_ITALIC, "<em>$1</em>$2");
}
