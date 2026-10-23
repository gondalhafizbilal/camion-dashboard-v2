import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request) {
  return forwardRequest(request, '/v1/currencies', { method: 'GET' });
}

export async function POST(request) {
  const body = await getJsonBody(request);
  return forwardRequest(request, '/v1/currencies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
