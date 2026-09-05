import { compassHeading, compassTicks } from "../game/layout";
export function Compass({ heading }: { heading: number }) {
  const degrees = Math.round(compassHeading(heading)) % 360;
  const cardinals: Record<number, string> = {
    0: "N",
    90: "E",
    180: "S",
    270: "W",
  };
  return (
    <div
      className="heading-tape"
      role="img"
      aria-label={`Heading ${degrees} degrees`}
    >
      <strong>{String(degrees).padStart(3, "0")}°</strong>
      <svg viewBox="0 0 330 42" aria-hidden="true">
        {compassTicks(heading).map((t) => (
          <g key={t.degrees} transform={`translate(${165 + t.offset},0)`}>
            <text y="14" textAnchor="middle">
              {cardinals[t.degrees] ?? String(t.degrees).padStart(3, "0")}
            </text>
            <path d="M0 22v6" />
          </g>
        ))}
        <path className="compass-index" d="m160 36 5-6 5 6" />
      </svg>
    </div>
  );
}
