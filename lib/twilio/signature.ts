import { validateRequest } from "twilio";
import { getTwilioServerEnv } from "../env";

// Validate the X-Twilio-Signature header against the reconstructed webhook URL
// and the form-encoded payload. Returns true on success, false on any failure
// or missing inputs. Never throws to the caller.
//
// Twilio's algorithm:
//   signature = base64(HMAC-SHA1(authToken, url + sorted(key+value)))
// The official `twilio` SDK implements this correctly across edge cases, so
// we delegate to it rather than rolling our own.
export function verifyTwilioSignature(args: {
  signatureHeader: string | null;
  url: string;
  params: Record<string, string>;
}): boolean {
  const { signatureHeader, url, params } = args;
  if (!signatureHeader) return false;
  let token: string;
  try {
    token = getTwilioServerEnv().TWILIO_AUTH_TOKEN;
  } catch {
    return false;
  }
  try {
    return validateRequest(token, signatureHeader, url, params);
  } catch {
    return false;
  }
}
