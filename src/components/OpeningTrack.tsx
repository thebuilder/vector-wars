import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Pause, Play } from "lucide-react";

export function useOpeningTrack(active: boolean, enabled: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const track = new Audio("/audio/root-access-granted.mp3");
    track.preload = "none";
    track.loop = true;
    track.volume = 0;
    audio.current = track;
    const onPlay = () => {
      setPlaying(true);
      setBlocked(false);
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      setBlocked(true);
    };
    track.addEventListener("playing", onPlay);
    track.addEventListener("pause", onPause);
    track.addEventListener("error", onError);
    return () => {
      track.removeEventListener("playing", onPlay);
      track.removeEventListener("pause", onPause);
      track.removeEventListener("error", onError);
      track.pause();
      track.removeAttribute("src");
      track.load();
      audio.current = null;
    };
  }, []);
  const start = useCallback((withMusic = true) => {
    setUnlocked(true);
    // Called directly by a click/keypress so browsers can grant audio playback.
    if (withMusic && audio.current) {
      void audio.current.play().catch(() => setBlocked(true));
    }
  }, []);
  useEffect(() => {
    const track = audio.current;
    if (!track || !unlocked) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      const shouldPlay = active && enabled && !document.hidden;
      if (document.hidden) {
        track.pause();
        track.volume = 0;
        return;
      }
      if (shouldPlay && track.paused)
        void track.play().catch(() => setBlocked(true));
      const from = track.volume;
      const to = shouldPlay ? 0.42 : 0;
      const began = performance.now();
      const fade = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - began) / 650));
        track.volume = from + (to - from) * t;
        if (t < 1) frame = requestAnimationFrame(fade);
        else if (!shouldPlay) track.pause();
      };
      frame = requestAnimationFrame(fade);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [active, enabled, unlocked]);
  return { start, playing, blocked };
}

export function OpeningTrack({
  playing,
  blocked,
  onToggle,
}: {
  playing: boolean;
  blocked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="opening-track"
      onClick={onToggle}
      aria-label={
        playing ? "Pause opening soundtrack" : "Play opening soundtrack"
      }
    >
      <AudioLines size={15} />
      <span>
        <small>
          {blocked
            ? "PRESS PLAY TO CONNECT"
            : playing
              ? "NOW PLAYING"
              : "OPENING SOUNDTRACK"}
        </small>
        ROOT ACCESS GRANTED
      </span>
      {playing ? <Pause size={13} /> : <Play size={13} />}
    </button>
  );
}
