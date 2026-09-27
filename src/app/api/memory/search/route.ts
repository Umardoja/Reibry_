import { createPostHandler } from "@/lib/api/handler";
import { searchSchema } from "@/lib/api/contracts";
import { services } from "@/lib/api/services";
export const POST = createPostHandler(searchSchema, services.search);
