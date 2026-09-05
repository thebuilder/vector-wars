import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/space-grotesk/latin-500.css";
import "../src/afterglow.css";
import "../src/style.css";
import { DrivingHUD } from "../src/components/DrivingHUD";
import { initialSnapshot } from "../src/game/types";

// Actual HUD and stylesheet, exercised at digit and airborne label boundaries.
const root = createRoot(document.querySelector("#fixture")!);
const render = (speed: number) =>
  flushSync(() =>
    root.render(
      <DrivingHUD
        state={{
          ...initialSnapshot,
          phase: "playing",
          speed,
          altitude: speed > 100 ? 12 : 0,
        }}
        onWeapon={() => {}}
      />,
    ),
  );
render(0);
document.querySelector("#run")!.addEventListener("click", async () => {
  await document.fonts.ready;
  const output = document.querySelector("#results")!;
  try {
    const sizes = [0, 9, 15, 99, 100, 320].map((speed) => {
      render(speed);
      const rect = document
        .querySelector(".drive-vitals")!
        .getBoundingClientRect();
      const tracks = [
        ...document.querySelectorAll(
          '.drive-meters [data-slot="progress-track"]',
        ),
      ];
      if (
        tracks.some(
          (track) =>
            !getComputedStyle(track).maskImage.includes(
              "repeating-linear-gradient",
            ),
        )
      )
        throw new Error("Meter segmentation is missing");
      return { speed, width: rect.width, height: rect.height };
    });
    if (
      sizes.some(
        (size) =>
          size.width !== sizes[0].width || size.height !== sizes[0].height,
      )
    )
      throw new Error(JSON.stringify(sizes));
    output.textContent = `PASS: segmented meters. Fixed ${sizes[0].width} × ${sizes[0].height} card at 0, 9, 15, 99, 100, and 320 km/h, including airborne state.`;
  } catch (error) {
    output.textContent = `FAIL: ${error}`;
  }
});
