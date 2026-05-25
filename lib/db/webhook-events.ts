import { getDb, isDatabaseConfigured } from "./client";

export type WebhookProvider = "twilio" | "stripe";

export type RecordWebhookEventInput = {
  provider: WebhookProvider;
  eventType: string;
  externalId: string;
  payload: unknown;
};

export type RecordWebhookEventResult =
  | { recorded: true; id: string; duplicate: false }
  | { recorded: true; id: string; duplicate: true }
  | { recorded: false; reason: "db_not_configured" };

// Idempotent insert into webhook_events. Uses the unique constraint on
// (provider, external_id). On conflict, returns the existing row id with
// duplicate=true. Callers can short-circuit duplicate work on that flag.
export async function recordWebhookEvent(
  input: RecordWebhookEventInput,
): Promise<RecordWebhookEventResult> {
  if (!isDatabaseConfigured()) {
    return { recorded: false, reason: "db_not_configured" };
  }
  const sql = getDb();
  const payloadJson = JSON.stringify(input.payload ?? null);
  const rows = await sql<
    { id: string; inserted: boolean }[]
  >`
    with attempt as (
      insert into webhook_events (provider, event_type, external_id, payload)
      values (
        ${input.provider},
        ${input.eventType},
        ${input.externalId},
        ${payloadJson}::jsonb
      )
      on conflict (provider, external_id) do nothing
      returning id
    )
    select id, true as inserted from attempt
    union all
    select id, false as inserted from webhook_events
    where provider = ${input.provider}
      and external_id = ${input.externalId}
      and not exists (select 1 from attempt)
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    // Should not happen, but be defensive.
    throw new Error("webhook_events insert returned no row");
  }
  return { recorded: true, id: row.id, duplicate: !row.inserted };
}
