import { forwardRequest } from '@/lib/serverApiProxy';

export async function PUT(request, { params }) {
  const { uuid } = await params;
  const formData = await request.formData();

  return forwardRequest(request, `/v1/products/${uuid}/sizechart`, {
    method: 'PUT',
    body: formData,
  });
}

export async function DELETE(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/sizechart`, {
    method: 'DELETE',
  });
}
