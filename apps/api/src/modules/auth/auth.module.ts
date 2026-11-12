import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OtpService } from "./otp.service";
import { TokenService } from "./token.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, OtpService],
  exports: [TokenService, OtpService],
})
export class AuthModule {}
