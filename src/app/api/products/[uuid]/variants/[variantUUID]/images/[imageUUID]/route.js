import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid, variantUUID, imageUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/variants/${variantUUID}/images/${imageUUID}`, { method: 'GET' });
}

export async function PUT(request, { params }) {
  const { uuid, variantUUID, imageUUID } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}/variants/${variantUUID}/images/${imageUUID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function DELETE(request, { params }) {
  const { uuid, variantUUID, imageUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/variants/${variantUUID}/images/${imageUUID}`, { method: 'DELETE' });
}

