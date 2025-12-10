import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { SlackIncService } from "./slack-inc.service";
import { SlackOAuthService } from "./slack-oauth.service";
import { SlackSignatureGuard } from "./slack-signature.guard";
import { Public } from "../auth/decorators/public.decorator";

@Controller("integrations/slack")
@Public()
export class SlackController {
  constructor(
    private readonly slackIncService: SlackIncService,
    private readonly slackOAuthService: SlackOAuthService,
  ) {}

  @Post("commands/inc")
  @UseGuards(SlackSignatureGuard)
  handleSlash(@Body() body: any) {
    return this.slackIncService.handleSlashCommand(body);
  }

  @Post("interactions")
  @UseGuards(SlackSignatureGuard)
  handleInteractions(@Body("payload") payload: string) {
    return this.slackIncService.handleInteraction(payload);
  }
}
