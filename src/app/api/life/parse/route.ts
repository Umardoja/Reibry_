import { createPostHandler } from "@/lib/api/handler";
import { parseLifeSchema } from "@/lib/api/contracts";
import { services } from "@/lib/api/services";
export const POST = createPostHandler(parseLifeSchema, services.parseLife);
