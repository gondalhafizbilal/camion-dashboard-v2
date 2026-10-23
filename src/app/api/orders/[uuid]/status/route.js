import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function PATCH(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/orders/${uuid}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body || {}),
  });
}

