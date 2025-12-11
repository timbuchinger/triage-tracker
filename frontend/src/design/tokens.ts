export const radius = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const layout = {
  pagePaddingX: "24px",
  pagePaddingY: "24px",
  sectionGap: "24px",
  fieldGap: "12px"
} as const;

export const typography = {
  title: "text-xl font-semibold",
  subtitle: "text-sm text-base-content/70",
  sectionHeading: "text-sm font-medium text-base-content/80",
  body: "text-sm",
  label: "text-xs font-medium text-base-content/70 uppercase tracking-wide"
} as const;

export const badges = {
  roleOwner: "badge badge-accent",
  roleMember: "badge badge-secondary",
  severityCritical: "badge badge-error",
  severityHigh: "badge badge-warning",
  severityMedium: "badge badge-info",
  severityLow: "badge badge-neutral",
  statusOpen: "badge badge-secondary",
  statusInvestigating: "badge badge-primary",
  statusMitigated: "badge badge-warning",
  statusResolved: "badge badge-success",
  statusActive: "badge badge-success",
  statusInactive: "badge badge-ghost",
  statusPending: "badge badge-warning"
} as const;

export const triageTracker = {
  appName: "Triage Tracker"
};
