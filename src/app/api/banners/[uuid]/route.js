import { forwardRequest, getJsonBody } from '@/lib/serverApiProxy';
import { normalizeBannerPlacement } from '@/lib/bannerPlacement';

export async function GET(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/banners/${uuid}`, { method: 'GET' });
}

export async function PUT(request, { params }) {
  const { uuid } = await params;
  const body = await getJsonBody(request);
  const normalizedBody =
    body && typeof body === 'object' && !Array.isArray(body)
      ? {
          ...body,
          placement: normalizeBannerPlacement(body.placement) || body.placement,
        }
      : body;
  return forwardRequest(request, `/v1/banners/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(normalizedBody),
  });
}

export async function DELETE(request, { params }) {
  const { uuid } = await params;
  return forwardRequest(request, `/v1/banners/${uuid}`, { method: 'DELETE' });
}
