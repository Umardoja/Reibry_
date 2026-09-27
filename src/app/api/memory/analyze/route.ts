import { createPostHandler } from "@/lib/api/handler";
import { analyzeSchema } from "@/lib/api/contracts";
import { services } from "@/lib/api/services";
export const POST = createPostHandler(analyzeSchema, services.analyze);
