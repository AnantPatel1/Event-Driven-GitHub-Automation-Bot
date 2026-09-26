/**
 * Secure Client-Side API Helper
 * Routes requests through the Next.js server-side proxy (/api/...)
 * to shield the internal backend service and prevent CORS & exposure vulnerabilities.
 */

export const API_BASE = '/api';

export async function apiFetch<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON or empty response
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}
