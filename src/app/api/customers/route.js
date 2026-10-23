import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/v1/customers?${query}` : '/v1/customers';
  return forwardRequest(request, path, { method: 'GET' });
}

export async function POST(request) {
  const body = await getJsonBody(request);
  return forwardRequest(request, '/v1/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
