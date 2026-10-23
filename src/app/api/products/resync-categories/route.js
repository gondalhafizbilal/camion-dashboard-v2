import { forwardRequest } from '@/lib/serverApiProxy';

export async function POST(request) {
  return forwardRequest(request, '/v1/products/resync-categories', {
    method: 'POST',
    body: await request.text(),
  });
}

