import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function PUT(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/customers/${uuid}/email-address`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

