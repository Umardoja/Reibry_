import { nvidiaErrorCategory, transportErrorCode, type NvidiaErrorCategory } from "../src/lib/ai/nvidia/errors.ts";

export type CheckResult = { name: string; status: "PASS" | "FAIL"; category?: NvidiaErrorCategory; transportCode?: string; detail?: string; primaryCategory?: NvidiaErrorCategory; fallbackCategory?: NvidiaErrorCategory };

export async function runCheck(name: string, check: () => Promise<void>): Promise<CheckResult> {
  try {
    await check();
    return { name, status: "PASS" };
  } catch (error) {
    return {
      name,
      status: "FAIL",
      category: nvidiaErrorCategory(error),
      transportCode: transportErrorCode(error),
      detail: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function formatCheck(result: CheckResult): string {
  const line = `${result.name.padEnd(28, ".")} ${result.status}${result.category ? ` [${result.category}]` : ""}${result.transportCode ? ` (${result.transportCode})` : ""}`;
  return result.primaryCategory && result.fallbackCategory
    ? `${line}\nPrimary Multimodal ......... ${result.primaryCategory}\nText Fallback .............. ${result.fallbackCategory}`
    : line;
}

export async function runImageCheck(primary: () => Promise<void>, fallback: () => Promise<void>): Promise<CheckResult> {
  try {
    await primary();
    return { name: "Image Analysis", status: "PASS" };
  } catch (primaryError) {
    try {
      await fallback();
    } catch (fallbackError) {
      return {
        name: "Image Analysis",
        status: "FAIL",
        category: nvidiaErrorCategory(primaryError),
        transportCode: transportErrorCode(primaryError),
        primaryCategory: nvidiaErrorCategory(primaryError),
        fallbackCategory: nvidiaErrorCategory(fallbackError),
        detail: `Primary Multimodal: ${nvidiaErrorCategory(primaryError)}; Text Fallback: ${nvidiaErrorCategory(fallbackError)}`,
      };
    }
    return { name: "Image Analysis", status: "FAIL", category: nvidiaErrorCategory(primaryError), transportCode: transportErrorCode(primaryError), primaryCategory: nvidiaErrorCategory(primaryError), detail: `Primary Multimodal: ${nvidiaErrorCategory(primaryError)}; Text Fallback: PASS` };
  }
}
