import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/reviews`, { method: 'GET' });
}

export async function POST(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}/reviews`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
