/**
 * TLS ends at the reverse proxy, so the app sees `http://` URLs while browsers send an `https://`
 * Origin; React Router rejects such actions as CSRF (400). Requests for our own host get
 * PUBLIC_URL's scheme back.
 */
export function withPublicScheme(request: Request, publicUrl: string): Request {
  const url = new URL(request.url);
  const pub = new URL(publicUrl);
  if (url.host !== pub.host || url.protocol === pub.protocol) return request;
  url.protocol = pub.protocol;
  return new Request(url, request);
}
