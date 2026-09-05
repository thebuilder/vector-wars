import { useEffect, useRef } from "react";
import { compassHeading } from "../game/layout";
const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);
const CARDINALS: Record<number, string> = {
  0: "N",
  90: "E",
  180: "S",
  270: "W",
};
/** Read the simulation each display frame; the rest of the HUD can remain at 10 Hz. */
export function Compass({ readHeading }: { readHeading: () => number }) {
  const root = useRef<HTMLDivElement>(null),
    value = useRef<HTMLElement>(null),
    ticks = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => {
    let frame = 0,
      previous = -1;
    const update = () => {
      const heading = compassHeading(readHeading());
      if (heading !== previous) {
        ticks.current.forEach((tick, i) =>
          tick?.setAttribute(
            "transform",
            `translate(${165 + (((TICKS[i] - heading + 540) % 360) - 180) * 3.1},0)`,
          ),
        );
        const label = `${String(Math.round(heading) % 360).padStart(3, "0")}°`;
        if (value.current) value.current.textContent = label;
        root.current?.setAttribute("aria-label", `Heading ${label}`);
        previous = heading;
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [readHeading]);
  return (
    <div
      ref={root}
      className="heading-tape"
      role="img"
      aria-label="Heading 0 degrees"
    >
      <strong ref={value}>000°</strong>
      <svg viewBox="0 0 330 42" aria-hidden="true">
        {TICKS.map((degrees, i) => (
          <g
            key={degrees}
            ref={(node) => {
              ticks.current[i] = node;
            }}
          >
            <text y="14" textAnchor="middle">
              {CARDINALS[degrees] ?? String(degrees).padStart(3, "0")}
            </text>
            <path d="M0 22v6" />
          </g>
        ))}
        <path className="compass-index" d="m160 36 5-6 5 6" />
      </svg>
    </div>
  );
}
