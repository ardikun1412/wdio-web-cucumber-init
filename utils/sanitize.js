export function sanitizeFileName(name, fallback = 'attachment') {
  return String(name || fallback)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 150);
}