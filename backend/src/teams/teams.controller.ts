import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { TeamsService } from "./teams.service";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { AddMembersDto } from "./dto/add-members.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("teams")
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(@Query("organizationId") organizationId: string) {
    return this.teamsService.findAll(organizationId);
  }

  @Get("default")
  getDefaultTeam(@Query("organizationId") organizationId: string) {
    return this.teamsService.getDefaultTeam(organizationId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.teamsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.teamsService.delete(id);
  }

  @Post(":id/members")
  addMembers(@Param("id") id: string, @Body() dto: AddMembersDto) {
    return this.teamsService.addMembers(id, dto);
  }

  @Delete(":id/members/:userId")
  removeMember(@Param("id") id: string, @Param("userId") userId: string) {
    return this.teamsService.removeMember(id, userId);
  }
}
