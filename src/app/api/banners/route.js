import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/v1/banners?${query}` : '/v1/banners';
  return forwardRequest(request, path, { method: 'GET' });
}

export async function POST(request) {
  const formData = await request.formData();
  return forwardRequest(request, '/v1/banners', {
    method: 'POST',
    body: formData,
  });
}

