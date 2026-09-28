// Match the production clean URL in Vite dev and preview as well.
export function editorRoute(request, response, next) {
  const url = request.url || '/';
  const queryIndex = url.indexOf('?');
  const pathname = queryIndex < 0 ? url : url.slice(0, queryIndex);
  const query = queryIndex < 0 ? '' : url.slice(queryIndex);
  if (pathname === '/editor/') {
    response.writeHead(308, { Location: `/editor${query}` });
    response.end();
    return;
  }
  if (pathname === '/editor') request.url = `/editor.html${query}`;
  next();
}
