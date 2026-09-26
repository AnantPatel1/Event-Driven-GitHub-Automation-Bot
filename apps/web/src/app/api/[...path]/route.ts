import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-Side Gateway Proxy Route Handler
 * Shields backend Fastify server from direct browser exposure.
 * Forwards session cookies and prevents cross-site security vulnerabilities.
 */
const BACKEND_URL =
  process.env.INTERNAL_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

async function proxyHandler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await context.params;
    const pathSegments = resolvedParams?.path || [];
    const pathStr = pathSegments.join('/');
    const search = request.nextUrl.search;
    const targetUrl = `${BACKEND_URL}/${pathStr}${search}`;

    const headers = new Headers(request.headers);
    headers.delete('host');

    const method = request.method;
    let body: ArrayBuffer | undefined = undefined;

    if (!['GET', 'HEAD'].includes(method)) {
      body = await request.arrayBuffer();
    }

    const backendRes = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(backendRes.headers);

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Backend gateway connection failure',
        message: error?.message || 'Unable to connect to internal API server',
      },
      { status: 502 }
    );
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
