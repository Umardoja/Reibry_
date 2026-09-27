import type { ContextMatch } from "@/types/reibry";

export interface ContextService {
  match(input: { userId: string; lifeContextId: string; memoryIds?: string[] }): Promise<ContextMatch[]>;
}
export const contextService: ContextService = {
  async match() { return []; },
};
