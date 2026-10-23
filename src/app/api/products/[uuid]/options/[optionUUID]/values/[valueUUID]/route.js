import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';
import { normalizeOptionValueBody } from '@/lib/localizedPayload';

export async function GET(request, { params }) {
  const { uuid, optionUUID, valueUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/options/${optionUUID}/values/${valueUUID}`, {
    method: 'GET',
  });
}

export async function PUT(request, { params }) {
  const { uuid, optionUUID, valueUUID } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}/options/${optionUUID}/values/${valueUUID}`, {
    method: 'PUT',
    body: JSON.stringify(normalizeOptionValueBody(body)),
  });
}

export async function DELETE(request, { params }) {
  const { uuid, optionUUID, valueUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/options/${optionUUID}/values/${valueUUID}`, {
    method: 'DELETE',
  });
}
