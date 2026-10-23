import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request) {
  const search = request.nextUrl?.search || '';
  return forwardRequest(request, `/v1/exchange-rates${search}`, { method: 'GET' });
}

export async function POST(request) {
  const body = await getJsonBody(request);
  return forwardRequest(request, '/v1/exchange-rates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
