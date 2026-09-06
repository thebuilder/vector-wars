import { useLayoutEffect, type RefObject } from "react";

const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Assemble whole panels, preserving text and focus outlines without clipping masks. */
export function MenuReveal({
  shell,
  active,
  progress,
}: {
  shell: RefObject<HTMLElement | null>;
  active: boolean;
  progress: RefObject<number>;
}) {
  useLayoutEffect(() => {
    const source = shell.current;
    if (!active || !source) return;
    const elements = Array.from(source.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && !element.classList.contains("world"),
    );
    const wire = source.cloneNode(true) as HTMLElement;
    wire.className = "game-shell is-menu menu-wire-preview";
    wire.inert = true;
    wire.setAttribute("aria-hidden", "true");
    wire
      .querySelectorAll("[id]")
      .forEach((element) => element.removeAttribute("id"));
    const copies = Array.from(wire.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && !element.classList.contains("world"),
    );
    wire.querySelector(".world")?.remove();
    document.body.append(wire);
    const panels = elements.map((element, index) => {
      const computed = getComputedStyle(element);
      const decoration = element.matches(".world-vignette, .scanlines");
      const copy = copies[index];
      if (decoration) copy.remove();
      const paths = Array.from(copy.querySelectorAll("svg path")).map(
        (path) => ({
          path: path as SVGPathElement,
          length: (path as SVGPathElement).getTotalLength(),
        }),
      );
      for (const { path, length } of paths)
        path.style.strokeDasharray = `${length}`;
      return {
        element,
        copy,
        paths,
        decoration,
        delay: 0,
        baseOpacity: Number(computed.opacity),
        baseTransform: computed.transform === "none" ? "" : computed.transform,
        saved: {
          opacity: element.style.opacity,
          transform: element.style.transform,
          visibility: element.style.visibility,
        },
      };
    });
    const resize = () => {
      const bounds = source.getBoundingClientRect();
      wire.style.width = `${bounds.width}px`;
      wire.style.height = `${bounds.height}px`;
      for (const panel of panels) {
        const rect = panel.element.getBoundingClientRect();
        const x = (rect.left + rect.width / 2 - bounds.left) / bounds.width;
        const y = (rect.top + rect.height / 2 - bounds.top) / bounds.height;
        panel.delay = 0.04 + (x * 0.7 + (1 - y) * 0.3) * 0.24;
        panel.element.style.visibility = "visible";
      }
    };
    const update = (progress: number) => {
      for (const panel of panels) {
        if (panel.decoration) {
          panel.element.style.opacity = `${panel.baseOpacity * ease(progress / 0.4)}`;
          continue;
        }
        const local = progress - panel.delay;
        const assembly = ease(local / 0.22);
        const surface = ease((local - 0.14) / 0.42);
        const transform = `${panel.baseTransform} translateY(${(1 - assembly) * 9}px)`;
        panel.element.style.opacity = `${panel.baseOpacity * surface}`;
        panel.element.style.transform = transform;
        panel.copy.style.opacity = `${assembly * (1 - surface) * 0.8}`;
        panel.copy.style.transform = transform;
        for (const { path, length } of panel.paths)
          path.style.strokeDashoffset = `${length * (1 - assembly)}`;
      }
    };
    resize();
    update(0);
    let frame = 0;
    let previous = -1;
    const animate = () => {
      if (progress.current !== previous) {
        update(progress.current);
        previous = progress.current;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const observer = new ResizeObserver(resize);
    observer.observe(source);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      wire.remove();
      for (const { element, saved } of panels)
        Object.assign(element.style, saved);
    };
  }, [active, shell, progress]);
  return null;
}
