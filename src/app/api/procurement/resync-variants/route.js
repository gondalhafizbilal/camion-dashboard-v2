import { forwardRequest } from '@/lib/serverApiProxy';

export async function POST(request) {
  return forwardRequest(request, '/v1/procurement/resync-variants', {
    method: 'POST',
    body: await request.text(),
  });
}

