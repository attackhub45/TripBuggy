export type DestinationKey =
  | 'paris' | 'tokyo' | 'newyork' | 'rome' | 'santorini'
  | 'bali' | 'iceland' | 'dubai' | 'fallback';

interface DestinationInfo {
  aliases: string[];
  name: string;
}

export const DESTINATIONS: Record<Exclude<DestinationKey, 'fallback'>, DestinationInfo> = {
  paris: { aliases: ['paris', 'france'], name: 'Paris' },
  tokyo: { aliases: ['tokyo', 'japan'], name: 'Tokyo' },
  newyork: { aliases: ['new york', 'nyc', 'manhattan'], name: 'New York' },
  rome: { aliases: ['rome', 'italy'], name: 'Rome' },
  santorini: { aliases: ['santorini', 'greece', 'greek islands'], name: 'Santorini' },
  bali: { aliases: ['bali', 'indonesia'], name: 'Bali' },
  iceland: { aliases: ['iceland', 'reykjavik'], name: 'Iceland' },
  dubai: { aliases: ['dubai', 'uae', 'emirates'], name: 'Dubai' },
};

export function matchDestination(raw: string): DestinationKey {
  const q = raw.trim().toLowerCase();
  if (!q) return 'fallback';
  for (const key of Object.keys(DESTINATIONS) as (keyof typeof DESTINATIONS)[]) {
    const aliases = DESTINATIONS[key].aliases;
    if (aliases.some((a) => q.includes(a) || a.includes(q))) return key;
  }
  return 'fallback';
}

// Crop windows into the shared 320x200 scene canvas — used for the filmstrip thumbnails.
export const ART_CROPS: [number, number][] = [[30, 15], [95, 25], [155, 15], [60, 45]];
export const CROP_SIZE = 140;

export function Scene({ destKey, width = 320, height = 200 }: { destKey: DestinationKey; width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 320 200" width={width} height={height} role="img" aria-label={`Illustration of ${destKey}`}>
      <use href={`#scene-${destKey}`} width={320} height={200} />
    </svg>
  );
}

export function SceneCrop({ destKey, cropIndex, size = 64 }: { destKey: DestinationKey; cropIndex: number; size?: number }) {
  const [x, y] = ART_CROPS[cropIndex % ART_CROPS.length];
  return (
    <svg viewBox={`${x} ${y} ${CROP_SIZE} ${CROP_SIZE}`} width={size} height={size} aria-hidden="true">
      <use href={`#scene-${destKey}`} width={320} height={200} />
    </svg>
  );
}

/** One-time hidden defs block holding every hand-drawn destination scene. Mount once near the app root. */
export function DestinationArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="sky-paris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F4C9A0" /><stop offset="1" stopColor="#E88C6B" /></linearGradient>
        <symbol id="scene-paris" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-paris)" />
          <rect y="140" width="320" height="60" fill="#6B5A46" />
          <polygon points="140,140 160,42 180,140" fill="#2B2620" />
          <polygon points="152,140 160,108 168,140" fill="url(#sky-paris)" />
          <line x1="146" y1="92" x2="174" y2="92" stroke="#2B2620" strokeWidth="2" />
          <line x1="142" y1="118" x2="178" y2="118" stroke="#2B2620" strokeWidth="2" />
          <circle cx="160" cy="40" r="3" fill="#2B2620" />
        </symbol>

        <linearGradient id="sky-tokyo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FADADD" /><stop offset="1" stopColor="#FF8FA3" /></linearGradient>
        <symbol id="scene-tokyo" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-tokyo)" />
          <rect y="140" width="320" height="60" fill="#4A4A55" />
          <polygon points="70,140 130,55 190,140" fill="#5C6B8A" />
          <polygon points="115,72 130,55 145,72" fill="#FFFFFF" opacity=".9" />
          <polygon points="215,140 230,48 245,140" fill="#E0553D" />
          <rect x="222" y="38" width="16" height="8" fill="#E0553D" />
          <line x1="218" y1="80" x2="242" y2="80" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="212" y1="110" x2="248" y2="110" stroke="#FFFFFF" strokeWidth="2" />
        </symbol>

        <linearGradient id="sky-newyork" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#CDE3F0" /><stop offset="1" stopColor="#F3D9A8" /></linearGradient>
        <symbol id="scene-newyork" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-newyork)" />
          <rect y="140" width="320" height="60" fill="#3A3A40" />
          <rect x="90" y="80" width="24" height="60" fill="#232326" />
          <rect x="118" y="50" width="24" height="90" fill="#232326" />
          <polygon points="118,50 130,30 142,50" fill="#232326" />
          <rect x="146" y="70" width="24" height="70" fill="#232326" />
          <rect x="174" y="40" width="24" height="100" fill="#232326" />
          <rect x="202" y="85" width="24" height="55" fill="#232326" />
        </symbol>

        <linearGradient id="sky-rome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F7DFC0" /><stop offset="1" stopColor="#E2A15E" /></linearGradient>
        <symbol id="scene-rome" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-rome)" />
          <rect y="140" width="320" height="60" fill="#8A7156" />
          <rect x="95" y="100" width="130" height="40" fill="#C79A66" />
          <rect x="95" y="96" width="130" height="8" fill="#B0835A" />
          <circle cx="112" cy="112" r="9" fill="url(#sky-rome)" />
          <circle cx="136" cy="112" r="9" fill="url(#sky-rome)" />
          <circle cx="160" cy="112" r="9" fill="url(#sky-rome)" />
          <circle cx="184" cy="112" r="9" fill="url(#sky-rome)" />
          <circle cx="208" cy="112" r="9" fill="url(#sky-rome)" />
        </symbol>

        <linearGradient id="sky-santorini" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#BFE3F0" /><stop offset="1" stopColor="#3E86A8" /></linearGradient>
        <symbol id="scene-santorini" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-santorini)" />
          <rect y="140" width="320" height="60" fill="#E8E2D6" />
          <rect x="118" y="112" width="22" height="28" rx="3" fill="#F4F1E8" />
          <circle cx="129" cy="108" r="13" fill="#2C6E8E" />
          <rect x="149" y="100" width="24" height="40" rx="3" fill="#FBFAF4" />
          <circle cx="161" cy="96" r="15" fill="#2C6E8E" />
          <rect x="182" y="115" width="20" height="25" rx="3" fill="#F4F1E8" />
          <circle cx="192" cy="111" r="12" fill="#2C6E8E" />
        </symbol>

        <linearGradient id="sky-bali" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBD9A0" /><stop offset="1" stopColor="#E8814A" /></linearGradient>
        <symbol id="scene-bali" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-bali)" />
          <rect y="140" width="320" height="60" fill="#4A3B2A" />
          <polygon points="128,140 140,70 152,140" fill="#3A2E22" />
          <polygon points="168,140 180,70 192,140" fill="#3A2E22" />
          <rect x="150" y="130" width="20" height="10" fill="#3A2E22" />
          <path d="M240,140 C238,110 246,90 244,66" stroke="#2F4A2E" strokeWidth="3" fill="none" />
          <g fill="#2F4A2E">
            <ellipse cx="244" cy="60" rx="16" ry="7" transform="rotate(-20 244 60)" />
            <ellipse cx="244" cy="60" rx="16" ry="7" transform="rotate(30 244 60)" />
            <ellipse cx="244" cy="60" rx="16" ry="7" transform="rotate(80 244 60)" />
            <ellipse cx="244" cy="60" rx="16" ry="7" transform="rotate(-70 244 60)" />
          </g>
        </symbol>

        <linearGradient id="sky-iceland" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0E2A4A" /><stop offset="1" stopColor="#1C4A63" /></linearGradient>
        <symbol id="scene-iceland" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-iceland)" />
          <path d="M30,60 C110,20 180,90 260,40 C300,60 310,80 320,70" stroke="#7FE0A8" strokeWidth="7" fill="none" opacity=".55" />
          <rect y="140" width="320" height="60" fill="#DCE8EE" />
          <polygon points="20,140 70,80 110,140" fill="#233042" />
          <polygon points="90,140 150,60 210,140" fill="#233042" />
          <polygon points="190,140 240,90 290,140" fill="#233042" />
        </symbol>

        <linearGradient id="sky-dubai" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBE3B0" /><stop offset="1" stopColor="#F2A65A" /></linearGradient>
        <symbol id="scene-dubai" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-dubai)" />
          <rect y="140" width="320" height="60" fill="#C9A46B" />
          <polygon points="140,140 150,90 170,90 180,140" fill="#EDE6D6" />
          <polygon points="148,90 152,60 168,60 172,90" fill="#E2D6BE" />
          <polygon points="155,60 158,42 162,42 165,60" fill="#D8C7A8" />
          <line x1="160" y1="42" x2="160" y2="28" stroke="#D8C7A8" strokeWidth="2" />
        </symbol>

        <linearGradient id="sky-fallback" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F4EFE0" /><stop offset="1" stopColor="#E7CBA8" /></linearGradient>
        <symbol id="scene-fallback" viewBox="0 0 320 200">
          <rect width="320" height="140" fill="url(#sky-fallback)" />
          <circle cx="230" cy="55" r="22" fill="#C15B2A" />
          <path d="M0,120 C60,90 100,130 160,105 C210,85 260,115 320,95 L320,140 L0,140 Z" fill="#6E7A5C" opacity=".55" />
          <path d="M0,135 C70,110 120,145 190,118 C240,100 280,125 320,110 L320,140 L0,140 Z" fill="#4C5A6B" opacity=".5" />
          <rect y="140" width="320" height="60" fill="#5A4A3A" />
          <path d="M160,200 C150,170 175,150 165,120 C158,100 172,80 160,60" stroke="#8F877A" strokeWidth="18" fill="none" />
          <path d="M160,200 C150,170 175,150 165,120 C158,100 172,80 160,60" stroke="#DCD6C6" strokeWidth="2" strokeDasharray="8 8" fill="none" />
        </symbol>
      </defs>
    </svg>
  );
}
