import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request) {
  return forwardRequest(request, '/v1/languages', { method: 'GET' });
}

export async function POST(request) {
  const body = await getJsonBody(request);
  return forwardRequest(request, '/v1/languages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
