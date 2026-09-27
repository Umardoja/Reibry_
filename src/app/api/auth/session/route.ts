import { jsonHandler } from "@/lib/api/integration-handler"; import { currentSession } from "@/lib/auth/service"; export const GET=jsonHandler(()=>currentSession());
