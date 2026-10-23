import { forwardRequest } from '@/lib/serverApiProxy';

export async function POST(request) {
  return forwardRequest(request, '/v1/procurement/import', {
    method: 'POST',
    body: await request.text(),
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';
  const pageNumber = searchParams.get('pageNumber') || searchParams.get('page') || '1';
  const itemsPerPage = searchParams.get('itemsPerPage') || searchParams.get('pageSize') || '20';
  const sort = searchParams.get('sort') || '';
  const priceStart = searchParams.get('priceStart') || '';
  const priceEnd = searchParams.get('priceEnd') || '';

  const params = new URLSearchParams();
  if (keyword) params.set('keyword', keyword);
  // Backend controller currently expects pageNumber/itemsPerPage.
  params.set('pageNumber', pageNumber);
  params.set('itemsPerPage', itemsPerPage);
  if (sort) params.set('sort', sort);
  if (priceStart) params.set('priceStart', priceStart);
  if (priceEnd) params.set('priceEnd', priceEnd);

  return forwardRequest(request, `/v1/procurement?${params.toString()}`, { method: 'GET' });
}
