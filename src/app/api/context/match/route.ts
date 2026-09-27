import { createPostHandler } from "@/lib/api/handler";
import { matchSchema } from "@/lib/api/contracts";
import { services } from "@/lib/api/services";
export const POST = createPostHandler(matchSchema, services.match);
