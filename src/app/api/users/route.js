import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request) {
  return forwardRequest(request, '/v1/users', { method: 'GET' });
}

export async function POST(request) {
  const body = await getJsonBody(request);
  return forwardRequest(request, '/v1/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
