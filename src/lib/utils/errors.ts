export class ConfigurationError extends Error {
  constructor() {
    super("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
    this.name = "ConfigurationError";
  }
}

export class NotImplementedError extends Error {
  constructor(service: string) {
    super(`${service} is not implemented in the shared foundation.`);
    this.name = "NotImplementedError";
  }
}
