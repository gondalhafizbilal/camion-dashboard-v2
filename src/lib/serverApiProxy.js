import { NextResponse } from 'next/server';

function getApiUrl() {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

function maskSensitive(value) {
  const blockedKeys = new Set(['password', 'token', 'authorization', 'access_token', 'refresh_token', 'secret']);

  if (Array.isArray(value)) {
    return value.map(maskSensitive);
  }

  if (value && typeof value === 'object') {
    const masked = {};
    for (const [key, val] of Object.entries(value)) {
      masked[key] = blockedKeys.has(String(key).toLowerCase()) ? '***' : maskSensitive(val);
    }
    return masked;
  }

  return value;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getRequestBodyLog(body) {
  if (body === undefined || body === null) return null;

  if (typeof body === 'string') {
    const asJson = safeJsonParse(body);
    if (asJson !== null) {
      return { type: 'json', value: maskSensitive(asJson) };
    }
    return { type: 'text', value: body.slice(0, 2000) };
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const entries = [];
    for (const [key, value] of body.entries()) {
      if (typeof value === 'string') {
        entries.push([key, value]);
      } else {
        entries.push([key, `[file:${value?.name || 'blob'}]`]);
      }
    }
    return { type: 'form-data', value: maskSensitive(Object.fromEntries(entries)) };
  }

  return { type: typeof body, value: String(body).slice(0, 2000) };
}

export async function forwardRequest(request, path, init = {}) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const apiUrl = `${getApiUrl()}${path}`;
  const method = init.method || request.method;
  const startedAt = Date.now();

  try {
    const headers = new Headers(init.headers || {});
    const authHeader = request.headers.get('authorization');

    if (authHeader) {
      headers.set('authorization', authHeader);
    }

    // Only set JSON content-type when we're sure it's JSON.
    // For multipart/form-data (FormData) we must NOT set Content-Type so fetch can set the boundary.
    if (!headers.has('Content-Type') && init.body !== undefined) {
      if (typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }
    }

    const bodyLog = getRequestBodyLog(init.body);
    console.info('[api-proxy][request]', {
      requestId,
      method,
      url: apiUrl,
      body: bodyLog,
    });

    const response = await fetch(apiUrl, {
      method,
      headers,
      body: init.body,
      cache: 'no-store',
    });

    const responseText = await response.text().catch(() => '');
    const responseJson = safeJsonParse(responseText);

    console.info('[api-proxy][response]', {
      requestId,
      method,
      url: apiUrl,
      status: response.status,
      durationMs: Date.now() - startedAt,
      response:
        responseJson !== null
          ? maskSensitive(responseJson)
          : String(responseText || '').slice(0, 4000),
    });

    const payload = responseJson ?? {};
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[api-proxy][error]', {
      requestId,
      method,
      url: apiUrl,
      durationMs: Date.now() - startedAt,
      error: error?.message || 'Unknown error',
    });
    return NextResponse.json(
      {
        status: 'fail',
        errors: {
          error: 'Unable to reach backend service.',
        },
      },
      { status: 503 }
    );
  }
}

export async function getJsonBody(request) {
  return request.json().catch(() => ({}));
}
