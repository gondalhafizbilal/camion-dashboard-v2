import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid, variantUUID } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query
    ? `/v1/products/${uuid}/variants/${variantUUID}/images?${query}`
    : `/v1/products/${uuid}/variants/${variantUUID}/images`;
  return forwardRequest(request, path, { method: 'GET' });
}

export async function POST(request, { params }) {
  const { uuid, variantUUID } = await params;
  const formData = await request.formData();
  return forwardRequest(request, `/v1/products/${uuid}/variants/${variantUUID}/images`, {
    method: 'POST',
    body: formData,
  });
}

