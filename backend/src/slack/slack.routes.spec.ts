import { PATH_METADATA } from "@nestjs/common/constants";
import { SlackController } from "./slack.controller";

describe("SlackController route metadata", () => {
  it("has the expected controller base path", () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, SlackController);
    expect(controllerPath).toBe("integrations/slack");
  });
});
