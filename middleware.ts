import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isProfile = pathname === '/profile' || pathname.startsWith('/profile/');
  if (!isAdmin && !isProfile) return NextResponse.next();

  if (pathname === '/admin/login') return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (isProfile) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  const role = token.role as string | undefined;
  if (role !== 'ADMIN' && role !== 'EDITOR') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/admin/users') && role !== 'ADMIN') {
    const url = req.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/profile'],
};
