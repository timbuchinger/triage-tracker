import { Body, Controller, Get, Param, Post, Patch, Query } from "@nestjs/common";
import { FindIncidentsDto } from "./dto/find-incidents.dto";
import { IncidentsService } from "./incidents.service";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { AddEventDto } from "./dto/add-event.dto";
import { AddSummaryDto } from "./dto/add-summary.dto";
import { UpdateSummaryDto } from "./dto/update-summary.dto";
import { CurrentUser, CurrentUserData } from "../auth/decorators/current-user.decorator";

@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findAll(@Query() query: FindIncidentsDto, @CurrentUser() user: CurrentUserData) {
    // map owner=me -> current user id
    const ownerId = query.owner === "me" ? user.id : undefined;

    return this.incidentsService.findAll({
      statuses: query.status,
      dateRange: query.dateRange,
      ownerId
    });
  }

  @Get(":refId")
  findOne(@Param("refId") refId: string) {
    return this.incidentsService.findOne(refId);
  }

  @Post()
  async create(@Body() dto: CreateIncidentDto, @CurrentUser() user: CurrentUserData) {
    return this.incidentsService.create(dto, user.id);
  }

  @Patch(":refId")
  update(@Param("refId") refId: string, @Body() dto: UpdateIncidentDto) {
    return this.incidentsService.update(refId, dto);
  }

  @Post(":refId/events")
  addEvent(@Param("refId") refId: string, @Body() dto: AddEventDto) {
    return this.incidentsService.addTimelineEvent(refId, dto);
  }

  @Post(":refId/summaries")
  addSummary(@Param("refId") refId: string, @Body() dto: AddSummaryDto) {
    return this.incidentsService.addSummary(refId, dto);
  }

  @Post(":refId/summaries/generate")
  generateSummary(@Param("refId") refId: string) {
    return this.incidentsService.generateSummary(refId);
  }

  @Patch(":refId/summaries/:summaryId")
  updateSummary(
    @Param("refId") refId: string,
    @Param("summaryId") summaryId: string,
    @Body() dto: UpdateSummaryDto
  ) {
    return this.incidentsService.updateSummary(refId, summaryId, dto.content);
  }
}
