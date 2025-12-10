import { IsString, IsNotEmpty } from "class-validator";
import { Transform } from "class-transformer";

export class CreateServiceDto {
  @IsString()
  name!: string;

  // Accept either `teamId` (camelCase) or `team_id` (snake_case) from the client.
  // The transform prefers an explicit `teamId`, then falls back to `team_id`.
  @Transform(({ value, obj }) => (value ?? obj?.team_id ?? obj?.teamId))
  @IsNotEmpty({ message: "Team ID is required" })
  teamId!: string;
}