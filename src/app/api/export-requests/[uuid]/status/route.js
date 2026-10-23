import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function PATCH(request, { params }) {
  const resolved = await params;
  const uuid = resolved?.uuid;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/export-requests/${uuid}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
