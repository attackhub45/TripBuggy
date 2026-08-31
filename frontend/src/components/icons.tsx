export function CompassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M15.5 8.5l-2.2 5.2-5.2 2.2 2.2-5.2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

/** The TripBuggy mark: a faceted paper airplane, teal with a coral fold-sliver. */
export function LogoMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <polygon points="92,8 6,64 52,54" fill="#146E72" />
      <polygon points="92,8 52,54 62,58" fill="#F2652E" />
      <polygon points="92,8 62,58 82,84" fill="#1D8A8C" />
    </svg>
  );
}
