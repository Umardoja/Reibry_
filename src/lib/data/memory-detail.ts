import { z } from "zod";
import { IntegrationError } from "../integration/errors.ts";
import type { Memory } from "@/types/reibry";

type MemoryLookup = { get(table: "memories", id: string): Promise<Memory> };

/** Direct, ownership-scoped Memory lookup for detail views. */
export async function getMemoryById(store: MemoryLookup, id: string): Promise<Memory> {
  if (!z.uuid().safeParse(id).success) throw new IntegrationError("NOT_FOUND", "Memory not found.");
  return store.get("memories", id);
}
