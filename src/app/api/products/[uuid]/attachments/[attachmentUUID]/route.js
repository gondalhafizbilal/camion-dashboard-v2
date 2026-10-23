import { forwardRequest } from '@/lib/serverApiProxy';

export async function DELETE(request, { params }) {
  const { uuid, attachmentUUID } = await params;
  return forwardRequest(request, `/v1/products/${uuid}/attachments/${attachmentUUID}`, {
    method: 'DELETE',
  });
}
