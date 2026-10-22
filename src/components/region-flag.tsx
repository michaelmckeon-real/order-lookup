import type { RegionConfig } from "@/lib/region";

export function RegionFlag({ config }: { config: RegionConfig }) {
  return (
    <svg
      viewBox="0 0 60 30"
      className="h-4 w-8 shrink-0"
      role="img"
      aria-label={config.name}
    >
      {config.region === "IE" ? (
        <>
          <rect width="20" height="30" fill="#169B62" />
          <rect x="20" width="20" height="30" fill="#FFFFFF" />
          <rect x="40" width="20" height="30" fill="#FF883E" />
        </>
      ) : (
        <>
          <rect width="60" height="30" fill="#012169" />
          <path d="M0 0L60 30M60 0L0 30" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2" />
          <path d="M30 0V30M0 15H60" stroke="#FFFFFF" strokeWidth="10" />
          <path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth="6" />
        </>
      )}
    </svg>
  );
}
