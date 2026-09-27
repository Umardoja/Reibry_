import { createPostHandler } from "@/lib/api/handler";
import { captureSchema } from "@/lib/api/contracts";
import { services } from "@/lib/api/services";
import { captureIdentity } from "@/lib/auth/capture-identity";
export const POST = createPostHandler(captureSchema, services.capture, async () => (await captureIdentity()).userId);
