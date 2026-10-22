import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "./jwt-auth.guard";
import { AuthService } from "./auth.service";
import { EmailVerificationService } from "./email-verification.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Post("login")
  login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(body?.email as string, body?.password as string);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user.id);
  }

  @Post("email/send-verification")
  @UseGuards(JwtAuthGuard)
  sendEmailVerification(@Req() request: AuthenticatedRequest) {
    return this.emailVerification.send(request.user.id);
  }

  @Post("email/verify")
  verifyEmail(@Body() body: { token?: string }) {
    return this.emailVerification.verify(body?.token ?? "");
  }
}
