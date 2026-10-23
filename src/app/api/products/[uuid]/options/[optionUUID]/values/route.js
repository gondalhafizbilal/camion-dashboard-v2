import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';
import { normalizeOptionValueBody } from '@/lib/localizedPayload';

export async function GET(request, { params }) {
  const { uuid, optionUUID } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query
    ? `/v1/products/${uuid}/options/${optionUUID}/values?${query}`
    : `/v1/products/${uuid}/options/${optionUUID}/values`;
  return forwardRequest(request, path, { method: 'GET' });
}

export async function POST(request, { params }) {
  const { uuid, optionUUID } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}/options/${optionUUID}/values`, {
    method: 'POST',
    body: JSON.stringify(normalizeOptionValueBody(body)),
  });
}
