import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function POST(request, { params }) {
  const { orderNo } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/wms/inbound/${orderNo}/set-tracking`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}
