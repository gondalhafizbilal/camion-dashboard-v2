import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/exchange-rates/${uuid}`, { method: 'GET' });
}

export async function PUT(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);

  return forwardRequest(request, `/v1/exchange-rates/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function DELETE(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/exchange-rates/${uuid}`, { method: 'DELETE' });
}

