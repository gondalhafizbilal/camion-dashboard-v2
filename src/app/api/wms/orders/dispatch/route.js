import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function POST(request) {
  const body = await getJsonBody(request);
  return forwardRequest(request, '/v1/wms/orders/dispatch', {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}

