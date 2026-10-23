import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const resolved = await params;
  const uuid = resolved?.uuid;
  return forwardRequest(request, `/v1/export-requests/${uuid}`, { method: 'GET' });
}

export async function PUT(request, { params }) {
  const resolved = await params;
  const uuid = resolved?.uuid;
  const body = await getJsonBody(request);
  return forwardRequest(request, `/v1/export-requests/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function DELETE(request, { params }) {
  const resolved = await params;
  const uuid = resolved?.uuid;
  return forwardRequest(request, `/v1/export-requests/${uuid}`, { method: 'DELETE' });
}
