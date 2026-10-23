import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function PUT(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}/slug`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
