import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/attachments`, {
    method: 'GET',
  });
}

export async function POST(request, { params }) {
  const { uuid } = await params;
  const formData = await request.formData();

  return forwardRequest(request, `/v1/products/${uuid}/attachments`, {
    method: 'POST',
    body: formData,
  });
}
