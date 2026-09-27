import "server-only";
import { createClient } from "@/lib/supabase/server";
import { IntegrationError } from "@/lib/integration/errors";
import { isUnauthenticated } from "./account-policy";
export async function signUp(email:string,password:string){const {data,error}=await (await createClient()).auth.signUp({email,password});if(error)throw new IntegrationError("AUTH_REQUIRED",error.message);return data;}
export async function signIn(email:string,password:string){const {data,error}=await (await createClient()).auth.signInWithPassword({email,password});if(error)throw new IntegrationError("AUTH_REQUIRED",error.message);return data;}
export async function signOut(){const {error}=await (await createClient()).auth.signOut();if(error)throw new IntegrationError("AUTH_REQUIRED",error.message);return {signedOut:true};}
export async function currentSession(){const {data,error}=await (await createClient()).auth.getUser();if(error){if(isUnauthenticated(error))return {user:null};throw new IntegrationError("INTERNAL_ERROR","Session verification temporarily unavailable.");}return {user:data.user};}
export async function currentUser(){return (await createClient()).auth.getUser();}
