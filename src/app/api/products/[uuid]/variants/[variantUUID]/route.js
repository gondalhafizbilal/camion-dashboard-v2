import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';
import { normalizeVariantBody } from '@/lib/localizedPayload';

export async function GET(request, { params }) {
  const { uuid, variantUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/variants/${variantUUID}`, { method: 'GET' });
}

export async function PUT(request, { params }) {
  const { uuid, variantUUID } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}/variants/${variantUUID}`, {
    method: 'PUT',
    body: JSON.stringify(normalizeVariantBody(body)),
  });
}

export async function DELETE(request, { params }) {
  const { uuid, variantUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/variants/${variantUUID}`, { method: 'DELETE' });
}
