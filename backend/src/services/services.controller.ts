import { Controller, Get, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServiceLinksService } from "./service-links.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { CreateServiceLinkDto } from "./dto/create-service-link.dto";
import { UpdateServiceLinkDto } from "./dto/update-service-link.dto";

@Controller("services")
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly serviceLinksService: ServiceLinksService,
  ) {}

  @Get()
  findAll() {
    return this.servicesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.servicesService.delete(id);
  }

  @Get(":id/links")
  getLinks(@Param("id") id: string) {
    return this.serviceLinksService.findByServiceId(id);
  }

  @Post(":id/links")
  createLink(@Param("id") serviceId: string, @Body() dto: Omit<CreateServiceLinkDto, "serviceId">) {
    return this.serviceLinksService.create({ ...dto, serviceId } as CreateServiceLinkDto);
  }

  @Put("links/:linkId")
  updateLink(@Param("linkId") linkId: string, @Body() dto: UpdateServiceLinkDto) {
    return this.serviceLinksService.update(linkId, dto);
  }

  @Delete("links/:linkId")
  deleteLink(@Param("linkId") linkId: string) {
    return this.serviceLinksService.delete(linkId);
  }
}