import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function PUT(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  const normalizedBody = {
    ...body,
    status: typeof body?.status === 'string' ? body.status.toLowerCase() : body?.status,
  };
  return forwardRequest(request, `/v1/products/${uuid}/status`, {
    method: 'PUT',
    body: JSON.stringify(normalizedBody),
  });
}
