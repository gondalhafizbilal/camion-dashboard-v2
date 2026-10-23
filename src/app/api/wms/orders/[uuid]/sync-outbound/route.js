import { forwardRequest } from '@/lib/serverApiProxy';

export async function POST(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/wms/orders/${uuid}/sync-outbound`, {
    method: 'POST',
  });
}
