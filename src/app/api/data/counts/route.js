import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request) {
  return forwardRequest(request, '/v1/data/counts', { method: 'GET' });
}

