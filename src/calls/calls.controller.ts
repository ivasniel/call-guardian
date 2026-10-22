import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { CallsService } from "./calls.service";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("calls")
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("priority") priority?: string,
    @Query("decision") decision?: string,
  ) {
    return this.calls.listForUser(request.user.id, {
      page,
      pageSize,
      search,
      category,
      priority,
      decision,
    });
  }

  @Get("stats")
  stats(
    @Req() request: AuthenticatedRequest,
    @Query("period") period?: string,
  ) {
    return this.calls.statsForUser(request.user.id, period);
  }

  @Get(":id")
  async detail(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const call = await this.calls.findForUser(request.user.id, id);

    if (!call) {
      throw new NotFoundException("Call not found");
    }

    return call;
  }
}
