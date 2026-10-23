import { forwardRequest } from "@/lib/serverApiProxy";

export async function PUT(request, { params }) {
  const { uuid } = await params;
  const formData = await request.formData();
  return forwardRequest(request, `/v1/bundles/${uuid}/image`, {
    method: "PUT",
    body: formData,
  });
}
