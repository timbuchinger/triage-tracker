import { IsNotEmpty, IsArray } from "class-validator";

export class AddMembersDto {
  @IsNotEmpty({ message: "Member IDs are required" })
  @IsArray()
  memberIds!: string[];
}
