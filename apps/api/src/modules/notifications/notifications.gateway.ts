import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { allowedOrigins, env } from "../../config/env";
import type { JwtPayload } from "../../common/auth-types";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

/**
 * Real-time channel at ws://<api>/notifications.
 * The browser connects with its access token (`auth: { token }`); each user
 * joins a private room `user:<id>`, so events only reach their owner.
 */
@WebSocketGateway({
  namespace: "/notifications",
  cors: { origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, !origin || allowedOrigins().includes(origin)), credentials: true },
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger("NotificationsGateway");
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  afterInit(server: Server) {
    this.notifications.attach(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth as { token?: string })?.token;
      if (!token) throw new Error("missing token");
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: env().JWT_ACCESS_SECRET, algorithms: ["HS256"] });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { isActive: true } });
      if (!user?.isActive) throw new Error("inactive");
      await client.join(`user:${payload.sub}`);
    } catch {
      client.emit("unauthorized");
      client.disconnect(true);
    }
  }
}
