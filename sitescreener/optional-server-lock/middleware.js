// Optional: real server-side password on /sitescreener (Basic Auth).
// Requires "@vercel/edge" as a dependency (see package.json in this folder).
// If you use this, you can delete the in-page gate from index.html to avoid a double prompt.
import { next } from '@vercel/edge';

export const config = { matcher: ['/sitescreener', '/sitescreener/:path*'] };

export default function middleware(request) {
  const PASSWORD = 'igce';
  const auth = request.headers.get('authorization');
  if (auth && auth.startsWith('Basic ')) {
    try {
      const [, pwd] = atob(auth.split(' ')[1]).split(':');
      if (pwd === PASSWORD) return next();
    } catch (_) {}
  }
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="IGCE Site Screener"' },
  });
}
