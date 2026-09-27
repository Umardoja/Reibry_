import { jsonHandler } from "@/lib/api/integration-handler"; import { today } from "@/lib/integration/orchestrator"; export const GET=jsonHandler(()=>today());
