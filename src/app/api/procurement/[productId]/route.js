import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { productId } = await params;
  return forwardRequest(request, `/v1/procurement/${productId}`, { method: 'GET' });
}
