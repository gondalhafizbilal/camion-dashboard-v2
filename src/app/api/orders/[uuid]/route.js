import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid } = await params;
  const currency = request.nextUrl?.searchParams?.get('currency') || 'qar';
  const query = new URLSearchParams();
  if (currency) query.set('currency', currency);
  return forwardRequest(request, `/v1/orders/${uuid}?${query.toString()}`, { method: 'GET' });
}
