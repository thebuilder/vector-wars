import type { Snapshot } from "../game/types";
export function Radar({ state }: { state: Snapshot }) {
  const scale = 0.31;
  return (
    <div
      className="radar"
      aria-label={`Radar: ${state.relays} of 3 relays destroyed, ${state.enemies} drones remaining`}
    >
      <div className="radar-heading">
        <span>
          <i className="led" />
          LOCAL SCAN
        </span>
        <span>650 M</span>
      </div>
      <svg
        viewBox="0 0 220 180"
        role="img"
        aria-label="Overhead map of the sector"
      >
        <defs>
          <radialGradient id="radar-fill">
            <stop stopColor="#86fadd" stopOpacity=".07" />
            <stop offset="1" stopColor="#86fadd" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          cx="110"
          cy="94"
          r="76"
          fill="url(#radar-fill)"
          stroke="#86fadd"
          strokeOpacity=".23"
        />
        <circle
          cx="110"
          cy="94"
          r="51"
          fill="none"
          stroke="#86fadd"
          strokeOpacity=".1"
          strokeDasharray="2 5"
        />
        <circle
          cx="110"
          cy="94"
          r="25"
          fill="none"
          stroke="#86fadd"
          strokeOpacity=".12"
        />
        <path d="M110 10v168M26 94h168" stroke="#86fadd" strokeOpacity=".13" />
        <path
          d="M110 148C142 132 151 106 144 77S111 29 87 49 63 93 79 124Z"
          fill="none"
          stroke="#86fadd"
          strokeOpacity=".22"
        />
        <text x="107" y="9">
          N
        </text>
        <text x="199" y="97">
          E
        </text>
        <text x="107" y="179">
          S
        </text>
        <text x="12" y="97">
          W
        </text>
        {state.blips
          .filter((b) => b.alive)
          .map((b, i) => {
            const x = 110 + b.x * scale,
              y = 94 + (b.z + 50) * scale;
            return b.kind === "repair" ? (
              <path
                key={i}
                d={`M${x - 2.5} ${y}h5M${x} ${y - 2.5}v5`}
                stroke="#86fadd"
              />
            ) : b.kind === "drone" ? (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.7"
                fill="#ff5b82"
                opacity=".65"
              />
            ) : (
              <rect
                key={i}
                x={x - 3}
                y={y - 3}
                width="6"
                height="6"
                fill={b.kind === "boss" ? "#ffbc57" : "#ff5b82"}
                transform={`rotate(45 ${x} ${y})`}
              />
            );
          })}
        <g
          transform={`translate(${110 + state.x * scale} ${94 + (state.z + 50) * scale}) rotate(${(-state.heading * 180) / Math.PI})`}
        >
          <path d="m0-5 3.5 8L0 1l-3.5 2Z" fill="#d9ffef" />
          <circle r="8" stroke="#d9ffef" strokeOpacity=".25" fill="none" />
        </g>
      </svg>
      <div className="radar-legend">
        <span>
          <i className="dot hostile" />
          HOSTILE
        </span>
        <span>
          <i className="dot" />
          SUPPLY
        </span>
        <span>↑ N</span>
      </div>
    </div>
  );
}
