import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';
import { normalizeProductBody } from '@/lib/localizedPayload';

export async function GET(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/products/${uuid}`, { method: 'GET' });
}

export async function PUT(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(normalizeProductBody(body)),
  });
}

export async function DELETE(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/products/${uuid}`, { method: 'DELETE' });
}
