import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function GapFinderLogo({ className = "h-7 w-7", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect width="28" height="28" rx="7" fill="#4F46E5" />
      <path
        d="M8.5 14C8.5 10.9624 10.9624 8.5 14 8.5C15.86 8.5 17.5044 9.42322 18.5 10.8361"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M19.5 14C19.5 17.0376 17.0376 19.5 14 19.5C12.14 19.5 10.4956 18.5768 9.5 17.1639"
        stroke="#C7D2FE"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="14" cy="14" r="2.2" fill="white" />
    </svg>
  );
}

export function OverviewIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="4" rx="1.5" />
      <rect x="11" y="9" width="6" height="8" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
    </svg>
  );
}

export function MaterialsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4.5 4.5A1.5 1.5 0 0 1 6 3h5.5L15.5 7v9a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 16V4.5Z" />
      <path d="M11 3v4.5h4.5" />
      <path d="M7.5 11h5M7.5 14h3.5" strokeLinecap="round" />
    </svg>
  );
}

export function TopicMapIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="5" cy="10" r="2.2" />
      <circle cx="15" cy="5.5" r="2.2" />
      <circle cx="15" cy="14.5" r="2.2" />
      <path d="M7 9l6-2.5M7 11l6 2.5" strokeLinecap="round" />
    </svg>
  );
}

export function DiagnosticIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M7.5 10.2l1.8 1.8 3.4-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GapAnalysisIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3.5 15.5h13" strokeLinecap="round" />
      <rect x="5" y="9.5" width="2.5" height="6" rx="0.6" />
      <rect x="9" y="5" width="2.5" height="10.5" rx="0.6" />
      <rect x="13" y="7.5" width="2.5" height="8" rx="0.6" />
    </svg>
  );
}

export function PlannerIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="1.8" />
      <path d="M3 8.5h14M7 2.8v2.4M13 2.8v2.4" strokeLinecap="round" />
      <path d="M7 12h2M11 12h2" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3.5 14.5l4.2-4.2 3 2.6 5.8-6.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 6.5h3v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="10" r="2.6" />
      <path
        d="M10 3v1.6M10 15.4V17M3 10h1.6M15.4 10H17M5.1 5.1l1.1 1.1M13.8 13.8l1.1 1.1M14.9 5.1l-1.1 1.1M6.2 13.8l-1.1 1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2L16.8 16.8" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M15 8.5a5 5 0 1 0-10 0c0 4-1.5 5.2-1.5 5.2h13S15 12.5 15 8.5Z" strokeLinejoin="round" />
      <path d="M8.5 16a1.6 1.6 0 0 0 3 0" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4.5 10h11M11.5 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="10" r="6.8" />
      <path d="M10 6.5v3.8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M5 10.5l3.2 3.2L15 6.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

