import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require auth
const PUBLIC_PATHS = ['/login', '/player'];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths and all /player routes
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // Check for cms_token cookie (set on login redirect)
    // We also accept the ?token= query param for initial redirect from login
    const tokenCookie = request.cookies.get('cms_token')?.value;

    if (!tokenCookie) {
        // Redirect to /login; we use client-side check in api.ts for most cases,
        // but this middleware handles direct URL access
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - api routes
         */
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
};
