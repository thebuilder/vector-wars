const STEPS = ["01", "02", "JUMP", "RELAY"];

export function BreachGuide({
  gate,
  speed,
  airborne,
  awaitingLaunch,
}: {
  gate: number;
  speed: number;
  airborne: boolean;
  awaitingLaunch: boolean;
}) {
  return (
    <div className="breach-guide">
      <ol className="breach-steps" aria-label="Outpost breach sequence">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={
              index < gate ? "complete" : index === gate ? "active" : ""
            }
            aria-current={index === gate ? "step" : undefined}
          >
            <span>{index < gate ? `✓ ${step}` : step}</span>
            {index < STEPS.length - 1 && <i aria-hidden="true">→</i>}
          </li>
        ))}
      </ol>
      {awaitingLaunch ? (
        <p className="launch-hint">SAFE TO PREPARE · W / ↑ TO LAUNCH</p>
      ) : gate === 2 ? (
        <p className="jump-readiness">
          <span className={speed >= 90 ? "ready" : ""}>
            {speed >= 90 ? "✓" : "↑"} 90+ KM/H
          </span>
          <span className={airborne ? "ready" : ""}>
            {airborne ? "✓ AIRBORNE" : "↑ TAKE THE RAMP"}
          </span>
        </p>
      ) : gate === 3 ? (
        <p>SHIELD DOWN · FIRE AT THE RELAY</p>
      ) : gate === 0 ? (
        <>
          <p>14 SEC FROM GATE 01 · JUMP AT 90+ KM/H</p>
          <p className="outpost-switch-hint">T · NEXT OUTPOST</p>
        </>
      ) : (
        <p>14 SEC FROM GATE 01 · JUMP AT 90+ KM/H</p>
      )}
    </div>
  );
}
