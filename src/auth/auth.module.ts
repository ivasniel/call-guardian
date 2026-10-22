import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { EmailService } from "./email.service";
import { EmailVerificationService } from "./email-verification.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");

        if (!secret || secret.length < 32) {
          throw new Error("JWT_SECRET must contain at least 32 characters");
        }

        return {
          secret,
          signOptions: {
            expiresIn: "8h",
            algorithm: "HS256",
          },
          verifyOptions: {
            algorithms: ["HS256"],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    EmailService,
    EmailVerificationService,
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
