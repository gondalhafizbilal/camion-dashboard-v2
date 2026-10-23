import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query ? `/v1/stories/${uuid}/frames?${query}` : `/v1/stories/${uuid}/frames`;
  return forwardRequest(request, path, { method: 'GET' });
}

export async function POST(request, { params }) {
  const { uuid } = await params;
  const formData = await request.formData();
  return forwardRequest(request, `/v1/stories/${uuid}/frames`, {
    method: 'POST',
    body: formData,
  });
}
