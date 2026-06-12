import {
  buildInitialSmsBody,
  type ConversationTemplateConfig,
} from "./conversation-templates";

export function buildRecoverySmsBodyFromConversationConfig(
  clinicName: string | null | undefined,
  config: Pick<ConversationTemplateConfig, "initialTemplate">,
): string {
  return buildInitialSmsBody(clinicName, config.initialTemplate);
}
