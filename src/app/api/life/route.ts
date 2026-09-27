import { NextResponse } from "next/server"; import { verifiedStore } from "@/lib/integration/orchestrator";
const privateJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
export async function GET(){try{const {store}=await verifiedStore();return privateJson({data:await store.list("life_contexts"),error:null});}catch{return privateJson({data:null,error:{code:"AUTH_REQUIRED",message:"Sign in to view life contexts."}},401);}}
