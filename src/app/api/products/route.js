import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';
import { normalizeProductBody } from '@/lib/localizedPayload';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/v1/products?${query}` : '/v1/products';
  return forwardRequest(request, path, { method: 'GET' });
}

export async function POST(request) {
  const body = await getJsonBody(request);
  return forwardRequest(request, '/v1/products', {
    method: 'POST',
    body: JSON.stringify(normalizeProductBody(body)),
  });
}
