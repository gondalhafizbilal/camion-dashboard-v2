import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function POST(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/wms/orders/${uuid}/replace-item`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}
