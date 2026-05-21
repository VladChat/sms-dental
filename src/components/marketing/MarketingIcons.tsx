import type { SVGProps } from "react";

type MarketingIconProps = SVGProps<SVGSVGElement>;

const iconBaseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function MissedCallIcon(props: MarketingIconProps) {
  return (
    <svg {...iconBaseProps} {...props}>
      <path d="M6.4 4.4 8.6 8 7 9.6a13.2 13.2 0 0 0 7.4 7.4l1.6-1.6 3.6 2.2-1 2.5a2 2 0 0 1-2.2 1.2c-3.4-.6-6.7-2.3-9.3-4.9S2.8 10.5 2.2 7.1A2 2 0 0 1 3.4 5z" />
      <path d="M16 4h5v5" />
      <path d="m21 4-5.2 5.2" />
    </svg>
  );
}

export function AutomaticSmsIcon(props: MarketingIconProps) {
  return (
    <svg {...iconBaseProps} {...props}>
      <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4.2 3.3c-.6.5-1.5 0-1.5-.8V17H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
      <path d="M8 10h8M8 13.5h5.5" />
      <path d="M17.8 2.8v2.6M16.5 4.1h2.6" />
      <path d="M18.5 18.3a2 2 0 0 0 2-2" />
      <path d="m21 16.3-.5-1 .5-1" />
    </svg>
  );
}

export function PatientReplyIcon(props: MarketingIconProps) {
  return (
    <svg {...iconBaseProps} {...props}>
      <path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H11l-4.2 3.3c-.6.5-1.5 0-1.5-.8V16H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M15.5 10.5H9.2" />
      <path d="m11.2 8.5-2 2 2 2" />
    </svg>
  );
}

export function AppointmentOpportunityIcon(props: MarketingIconProps) {
  return (
    <svg {...iconBaseProps} {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.2" />
      <path d="M7.5 3.8v3.4M16.5 3.8v3.4M3.5 9.3h17" />
      <path d="M12 12.3v5.1M9.5 14.8h5" />
      <path d="m18.5 11.2.6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6 1.2-.6z" />
    </svg>
  );
}

export function ExistingPhoneNumberIcon(props: MarketingIconProps) {
  return (
    <svg {...iconBaseProps} {...props}>
      <path d="M6.4 4.4 8.6 8 7 9.6a13.2 13.2 0 0 0 7.4 7.4l1.6-1.6 3.6 2.2-1 2.5a2 2 0 0 1-2.2 1.2c-3.4-.6-6.7-2.3-9.3-4.9S2.8 10.5 2.2 7.1A2 2 0 0 1 3.4 5z" />
      <circle cx="18.5" cy="5.5" r="3" />
      <path d="M18.5 4v3M17.4 5.2h1.1" />
    </svg>
  );
}

export function OptOutStopIcon(props: MarketingIconProps) {
  return (
    <svg {...iconBaseProps} {...props}>
      <path d="M8 6.8h10a2 2 0 0 1 2 2v5.8a2 2 0 0 1-2 2h-6.2l-3.4 2.7c-.6.5-1.4 0-1.4-.8v-1.9H6a2 2 0 0 1-2-2V8.8a2 2 0 0 1 2-2Z" />
      <circle cx="7" cy="7" r="4.5" />
      <path d="m4 10 6-6" />
    </svg>
  );
}

export function SecureCompliantIcon(props: MarketingIconProps) {
  return (
    <svg {...iconBaseProps} {...props}>
      <path d="M12 3.3 4.5 6v5.5c0 4.2 2.7 8 7.5 9.2 4.8-1.2 7.5-5 7.5-9.2V6Z" />
      <path d="m8.8 12.1 2.1 2.1 4.3-4.3" />
    </svg>
  );
}

export function FrontDeskIcon(props: MarketingIconProps) {
  return (
    <svg {...iconBaseProps} {...props}>
      <circle cx="12" cy="6.5" r="2.5" />
      <path d="M6 20v-3.6a3.2 3.2 0 0 1 3.2-3.2h5.6a3.2 3.2 0 0 1 3.2 3.2V20" />
      <path d="M3 16.5h18M8.8 10.8h6.4" />
    </svg>
  );
}
