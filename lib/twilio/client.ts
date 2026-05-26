import { Twilio } from "twilio";
import { getTwilioServerEnv } from "../env";

let cachedClient: Twilio | undefined;

export function getTwilioClient(): Twilio {
  if (cachedClient) return cachedClient;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = getTwilioServerEnv();
  cachedClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return cachedClient;
}
