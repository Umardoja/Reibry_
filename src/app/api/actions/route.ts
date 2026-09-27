import { createPostHandler } from "@/lib/api/handler";
import { actionSchema } from "@/lib/api/contracts";
import { services } from "@/lib/api/services";
export const POST = createPostHandler(actionSchema, services.action);
