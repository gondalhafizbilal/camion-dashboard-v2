import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';
import { normalizeVariantBody } from '@/lib/localizedPayload';

export async function GET(request, { params }) {
  const { uuid } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query
    ? `/v1/products/${uuid}/variants?${query}`
    : `/v1/products/${uuid}/variants`;
  return forwardRequest(request, path, { method: 'GET' });
}

export async function POST(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/products/${uuid}/variants`, {
    method: 'POST',
    body: JSON.stringify(normalizeVariantBody(body)),
  });
}

export async function PUT(request, context) {
  return POST(request, context);
}
