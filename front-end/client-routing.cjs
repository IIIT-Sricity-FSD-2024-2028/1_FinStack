// Shared by development/preview hosting and hosting regression tests. Admin
// keeps its own application and assets; only extensionless client URLs fall back.
function isClientSpaPath(pathname) {
  let path;
  try { path = decodeURIComponent(pathname); } catch { return false; }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || Array.from(path).some(char => char.charCodeAt(0) <= 32)) return false;
  if (path.startsWith('/@')) return false; // Vite runtime, refresh, virtual modules and /@fs assets.
  if (/^\/(?:api|admin|client-react|node_modules|js|css|assets)(?:\/|$)/i.test(path)) return false;
  return !path.split('/').some(part => part.startsWith('.')) && !/(?:^|\/)[^/]+\.[^/]+$/.test(path);
}

module.exports = { isClientSpaPath };
