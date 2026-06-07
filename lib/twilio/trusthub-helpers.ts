type TrustHubListMethod<TItem> = (params: { limit: number }) => Promise<TItem[]>;

export type TrustHubListContainer<TItem> = {
  list?: TrustHubListMethod<TItem>;
};

export type TrustHubEvaluationResult = {
  sid?: string | null;
  status?: string | null;
};

export function bindTrustHubListMethod<TItem>(
  container: TrustHubListContainer<TItem>,
): TrustHubListMethod<TItem> | null {
  return typeof container.list === "function" ? container.list.bind(container) : null;
}

export function requireTrustHubEvaluationStatus(
  result: TrustHubEvaluationResult | null | undefined,
  resourceLabel: string,
): string {
  if (!result) {
    throw new Error(`Twilio ${resourceLabel} evaluation returned no result.`);
  }
  const status = typeof result.status === "string" ? result.status.trim() : "";
  if (!status) {
    throw new Error(`Twilio ${resourceLabel} evaluation returned no status.`);
  }
  return status;
}
