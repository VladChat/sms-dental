import { billingConfig } from "../../config/billing.config";
import type { ClinicPhoneNumberRow } from "../db/clinic-phone-numbers";
import type {
  BillingPeriodSummary,
  BillingSummaryLineItem,
  ClinicBillingSummary,
} from "../../app/setup/[token]/_components/account-types";

type NumberCounts = {
  local: number;
  additionalTollFree: number;
};

export function buildClinicBillingSummary(
  numbers: Pick<
    ClinicPhoneNumberRow,
    "number_type" | "billing_class" | "is_active" | "removal_status"
  >[],
): ClinicBillingSummary {
  const currentCounts = countBillable(numbers, { includeScheduledRemovals: true });
  const nextCounts = countBillable(numbers, { includeScheduledRemovals: false });
  const pendingRemovalCount = numbers.filter((n) => n.removal_status === "scheduled").length;

  return {
    current: buildPeriod(currentCounts),
    nextCycle: buildPeriod(nextCounts),
    localNumberCount: currentCounts.local,
    additionalTollFreeCount: currentCounts.additionalTollFree,
    pendingRemovalCount,
    localComplianceFeeApplies: currentCounts.local > 0,
    notices:
      pendingRemovalCount > 0
        ? ["Scheduled removals stop routing now and update recurring billing for the next cycle."]
        : [],
  };
}

function countBillable(
  numbers: Pick<
    ClinicPhoneNumberRow,
    "number_type" | "billing_class" | "is_active" | "removal_status"
  >[],
  opts: { includeScheduledRemovals: boolean },
): NumberCounts {
  let local = 0;
  let additionalTollFree = 0;
  for (const n of numbers) {
    if (n.removal_status === "permanently_removed") continue;
    if (n.removal_status === "scheduled" && !opts.includeScheduledRemovals) continue;
    if (!n.is_active && n.removal_status !== "scheduled" && n.removal_status !== "active") continue;

    if (n.number_type === "local") {
      local += 1;
    } else if (n.billing_class === "additional") {
      additionalTollFree += 1;
    }
  }
  return { local, additionalTollFree };
}

function buildPeriod(counts: NumberCounts): BillingPeriodSummary {
  const lines: BillingSummaryLineItem[] = [
    {
      key: "base",
      label: billingConfig.basePlan.displayName,
      detail: "Base plan",
      quantity: 1,
      unitAmountCents: billingConfig.basePlan.monthlyUnitAmountCents,
      amountCents: billingConfig.basePlan.monthlyUnitAmountCents,
    },
  ];

  if (counts.additionalTollFree > 0) {
    const unit = billingConfig.additionalBusinessNumber.monthlyUnitAmountCents;
    lines.push({
      key: "additional_toll_free",
      label: "Additional toll-free numbers",
      detail: "Paid toll-free add-on",
      quantity: counts.additionalTollFree,
      unitAmountCents: unit,
      amountCents: counts.additionalTollFree * unit,
    });
  }

  if (counts.local > 0) {
    const unit = billingConfig.numberModel.local.mcdFees.monthlyNumberCents;
    lines.push({
      key: "local_numbers",
      label: "Local numbers",
      detail: "Local number add-on",
      quantity: counts.local,
      unitAmountCents: unit,
      amountCents: counts.local * unit,
    });

    const compliance = billingConfig.numberModel.local.regulatoryFees.monthlySmsComplianceCents;
    lines.push({
      key: "local_sms_compliance",
      label: "Local SMS compliance",
      detail: "Applies once while local numbers are assigned",
      quantity: 1,
      unitAmountCents: compliance,
      amountCents: compliance,
    });
  }

  return {
    lineItems: lines,
    totalAmountCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
  };
}
