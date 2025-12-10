import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { SlackIncService } from "./slack-inc.service";
import { SlackSignatureGuard } from "./slack-signature.guard";

@Controller("slack")
@Public()
export class SlackLegacyController {
  constructor(private readonly slackIncService: SlackIncService) {}

  @Post("interactions")
  @UseGuards(SlackSignatureGuard)
  handleInteractions(@Body("payload") payload: string) {
    return this.slackIncService.handleInteraction(payload);
  }
}
