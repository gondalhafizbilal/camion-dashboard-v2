import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/v1/return-requests/admin/all?${query}` : '/v1/return-requests/admin/all';
  return forwardRequest(request, path, { method: 'GET' });
}

