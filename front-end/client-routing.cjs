function isClientSpaPath(pathname) {
  if (pathname === '/api' || pathname.startsWith('/api/')) return false;
  return pathname === '/' || !/(?:^|\/)[^/]+\.[^/]+$/.test(pathname);
}

module.exports = { isClientSpaPath };
