import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/v1/wms/orders?${query}` : '/v1/wms/orders';
  return forwardRequest(request, path, { method: 'GET' });
}

