import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/return-requests/${uuid}`, { method: 'GET' });
}

