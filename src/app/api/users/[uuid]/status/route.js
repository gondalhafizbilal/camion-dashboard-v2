import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function PUT(request, { params }) {
  const resolvedParams = await params;
  const uuid = resolvedParams?.uuid;
  const body = await getJsonBody(request);

  return forwardRequest(request, `/v1/users/${uuid}/status`, {
    method: 'PUT',
    body,
  });
}

