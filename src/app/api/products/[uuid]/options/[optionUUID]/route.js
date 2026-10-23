import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';
import { normalizeOptionBody } from '@/lib/localizedPayload';

export async function GET(request, { params }) {
  const { uuid, optionUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/options/${optionUUID}`, { method: 'GET' });
}

export async function PUT(request, { params }) {
  const { uuid, optionUUID } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}/options/${optionUUID}`, {
    method: 'PUT',
    body: JSON.stringify(normalizeOptionBody(body)),
  });
}

export async function DELETE(request, { params }) {
  const { uuid, optionUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/options/${optionUUID}`, { method: 'DELETE' });
}
