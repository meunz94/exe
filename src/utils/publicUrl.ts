export function publicUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return path;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const normalized = trimmed.replace(/^\/+/, "");
  let base = import.meta.env.BASE_URL || "/";
  if (!base.endsWith("/")) base += "/";
  return `${base}${normalized}`;
}
