import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import "./BootScreen.css";

export function BootScreen({
  progress,
  ready,
  error,
  onSkip,
}: {
  progress: number;
  ready: boolean;
  error: string;
  onSkip: () => void;
}) {
  const skipButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ready) skipButton.current?.focus({ preventScroll: true });
  }, [ready]);
  return createPortal(
    <section className="boot-screen" aria-label="Connecting to Vector Wars">
      <div className="boot-status" role="status">
        {error ||
          (!ready ? "CONNECTING TO THE GRID…" : "RECONSTRUCTING SIGNAL")}
      </div>
      <div
        className="boot-progress"
        role="progressbar"
        aria-label="World reveal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <button
        className="boot-skip"
        ref={skipButton}
        onClick={onSkip}
        disabled={!ready}
      >
        SKIP INTRO <span>↗</span>
      </button>
    </section>,
    document.body,
  );
}
