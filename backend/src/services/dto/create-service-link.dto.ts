import { IsEnum, IsString, IsUrl } from 'class-validator';
import { ServiceLinkType } from '@prisma/client';

export class CreateServiceLinkDto {
  @IsString()
  serviceId!: string;

  @IsEnum(ServiceLinkType)
  type!: ServiceLinkType;

  @IsString()
  url!: string;
}
