export function slugifyServiceName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
