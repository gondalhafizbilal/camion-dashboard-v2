import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filters = searchParams.get('filters') || '';
  const sort = searchParams.get('sort') || '';
  const pageNumber = searchParams.get('pageNumber') || '1';
  const itemsPerPage = searchParams.get('itemsPerPage') || '100';
  const status = searchParams.get('status') || '';
  const customerUuid = searchParams.get('customerUuid') || '';
  const currency = searchParams.get('currency') || 'qar';

  let normalizedFilters = filters;
  if (customerUuid) {
    let filtersObject = {};
    if (normalizedFilters) {
      try {
        filtersObject = JSON.parse(normalizedFilters);
      } catch {
        filtersObject = {};
      }
    }
    filtersObject.customerUUID = customerUuid;
    normalizedFilters = JSON.stringify(filtersObject);
  }

  const params = new URLSearchParams();
  if (normalizedFilters) params.set('filters', normalizedFilters);
  if (sort) params.set('sort', sort);
  if (status) params.set('status', status);
  if (currency) params.set('currency', currency);
  params.set('pageNumber', pageNumber);
  params.set('itemsPerPage', itemsPerPage);

  return forwardRequest(request, `/v1/orders?${params.toString()}`, { method: 'GET' });
}
