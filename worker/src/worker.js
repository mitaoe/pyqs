const worker = {
  async fetch(request, env) {

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    const url = new URL(request.url);

    let key;
    try {
      key = decodeURIComponent(url.pathname.slice(1));
    } catch {
      return new Response('Bad Request', {
        status: 400,
        headers: corsHeaders(request),
      });
    }

    if (key === '' || key === '/') {
      return new Response('MITAOE PYQ Storage Active', {
        status: 200,
        headers: corsHeaders(request),
      });
    }

    const object = await env.PDF_BUCKET.get(key);

    if (object === null) {
      return new Response('File Not Found', {
        status: 404,
        headers: corsHeaders(request),
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Content-Type', 'application/pdf');
    headers.set('Cache-Control', 'public, max-age=14400');

    for (const [k, v] of Object.entries(corsHeaders(request))) {
      headers.set(k, v);
    }

    return new Response(object.body, { headers });
  }
};

export default worker;

const ALLOWED_ORIGINS = new Set([
  'https://mitaoe-pyqs.vercel.app',
  'http://localhost:3000',
  'https://mitaoe-pyq.vercel.app',
  'https://mozilla.github.io',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
  };
}
