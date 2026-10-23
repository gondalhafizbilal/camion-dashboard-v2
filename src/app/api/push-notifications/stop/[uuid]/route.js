import { forwardRequest } from '@/lib/serverApiProxy';

export async function PUT(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/push-notifications/stop/${uuid}`, {
    method: 'PUT',
  });
}
