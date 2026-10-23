import { forwardRequest } from '@/lib/serverApiProxy';

function buildDefaultPath(request) {
  const { search } = new URL(request.url);
  return `/v1/referral/affiliates${search || ''}`;
}

export async function GET(request) {
  return forwardRequest(request, buildDefaultPath(request), { method: 'GET' });
}

