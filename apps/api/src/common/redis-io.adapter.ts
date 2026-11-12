import { Logger, type INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server, ServerOptions } from "socket.io";

/**
 * Socket.IO adapter backed by Redis pub/sub, so notifications reach users no
 * matter which API instance they're connected to. If Redis isn't reachable
 * the API keeps working with the default in-memory adapter (single instance).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly log = new Logger("RedisIoAdapter");
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connect(url: string | undefined) {
    if (!url) return;
    const pub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2, enableOfflineQueue: false });
    const sub = pub.duplicate();
    try {
      await Promise.all([pub.connect(), sub.connect()]);
      this.adapterConstructor = createAdapter(pub, sub);
      this.log.log("Socket.IO using Redis adapter");
    } catch (e) {
      pub.disconnect();
      sub.disconnect();
      this.log.warn(`Redis unavailable (${(e as Error).message}); using in-memory Socket.IO adapter`);
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
