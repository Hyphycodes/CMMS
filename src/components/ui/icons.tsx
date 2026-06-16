/** Minimal inline stroke icons — no icon dependency. */
type P = { className?: string };
const base = (className?: string) => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: "1em",
  height: "1em",
});

export const InboxIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 13l2 5h12l2-5M4 13V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v8M4 13h4l1.5 2h5L16 13h4" />
  </svg>
);
export const SummaryIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);
export const DiaryIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4zM6 4a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2" />
  </svg>
);
export const BookIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5zM20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2V5z" />
  </svg>
);
export const BoxesIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8M12 12v8" />
  </svg>
);
export const EstimateIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 7h6M9 11h6M9 15h3" />
  </svg>
);
export const AuthIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const SearchIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 12l5 5 9-10" />
  </svg>
);
export const ChevronDown = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const ChevronRight = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const XIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const DotsIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </svg>
);
export const LayersIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />
  </svg>
);
