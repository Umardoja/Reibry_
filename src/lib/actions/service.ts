import type { SuggestedAction } from "@/types/reibry";
import type { ActionRequest } from "@/lib/api/contracts";

export interface ActionService {
  generate(input: ActionRequest & { userId: string }): Promise<SuggestedAction>;
}
export const actionService: ActionService = {
  async generate(input) { return { type: input.type, title: input.type.replace("_"," "), description: "Mock action proposal requiring confirmation.", payload: { source: input.memoryId || input.lifeContextId || input.matchId || "" } }; },
};
