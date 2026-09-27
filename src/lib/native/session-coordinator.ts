export type NativeAuthState = "restoring" | "authenticated" | "unauthenticated" | "temporary-error";
export interface SessionCredentials { accessToken: string; refreshToken: string; userId: string; expiresAt: number }
export interface SessionTransport {
  read(): Promise<SessionCredentials | null>;
  begin(userId: string): Promise<string>;
  exchange(expected: SessionCredentials): Promise<SessionCredentials>;
  write(session: SessionCredentials, ticket: string): Promise<void>;
  clear(): Promise<void>;
  unavailable(ticket: string): Promise<void>;
}
/** Network requests may overlap; secure mutations are ordered and obsolete results discarded. */
export class SessionCoordinator {
  state: NativeAuthState = "restoring";
  userId: string | null = null;
  private revision = 0;
  private pending: Promise<void> | null = null;
  private mutations = Promise.resolve();
  private transport: SessionTransport;
  constructor(transport: SessionTransport) { this.transport = transport; }
  private mutate(operation: () => Promise<void>) {
    const result = this.mutations.then(operation);
    this.mutations = result.catch(() => {});
    return result;
  }
  clear(): Promise<void> {
    ++this.revision;
    this.pending = null;
    this.state = "unauthenticated";
    this.userId = null;
    return this.mutate(() => this.transport.clear());
  }
  sync(force = false): Promise<void> {
    if (this.pending && !force) return this.pending;
    const revision = ++this.revision;
    const current = () => revision === this.revision;
    this.state = "restoring";
    const run = (async () => {
      let ticket = "";
      try {
        const web = await this.transport.read();
        if (!current()) return;
        if (!web) { await this.clear(); return; }
        this.userId = web.userId;
        await this.mutate(async () => { if (current()) ticket = await this.transport.begin(web.userId); });
        if (!current()) return;
        const verified = await this.transport.exchange(web);
        if (verified.userId !== web.userId) throw new Error("Session changed");
        await this.mutate(async () => { if (current()) await this.transport.write(verified, ticket); });
        if (current()) this.state = "authenticated";
      } catch {
        if (current()) {
          this.state = "temporary-error";
          await this.mutate(async () => { if (current() && ticket) await this.transport.unavailable(ticket); }).catch(() => {});
        }
      }
    })();
    this.pending = run;
    void run.finally(() => { if (this.pending === run) this.pending = null; });
    return run;
  }
}
