import { NextResponse } from 'next/server';
import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const { uuid } = params;

  const listResponse = await forwardRequest(request, '/v1/currencies', { method: 'GET' });
  const listPayload = await listResponse.json().catch(() => []);

  if (!listResponse.ok) {
    return NextResponse.json(listPayload, { status: listResponse.status });
  }

  const item = Array.isArray(listPayload)
    ? listPayload.find((currency) => String(currency?.uuid) === String(uuid))
    : null;

  if (!item) {
    return NextResponse.json(
      {
        status: 'fail',
        errors: {
          error: 'Failed to find the currency. Please check and try again.',
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json(item, { status: 200 });
}

export async function PUT(request, { params }) {
  const { uuid } = params;
  const body = await getJsonBody(request);

  return forwardRequest(request, `/v1/currencies/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function DELETE(request, { params }) {
  const { uuid } = params;
  return forwardRequest(request, `/v1/currencies/${uuid}`, { method: 'DELETE' });
}
