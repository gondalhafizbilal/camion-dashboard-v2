import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { sku } = await params;
  return forwardRequest(request, `/v1/products/variants/by-sku/${encodeURIComponent(sku)}`, {
    method: 'GET',
  });
}
