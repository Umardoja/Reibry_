import { jsonHandler } from '@/lib/api/integration-handler'; import { signOut } from '@/lib/auth/service'; export const POST=jsonHandler(()=>signOut());
