import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  ChevronRight,
  Crosshair,
  Expand,
  Gauge,
  Keyboard,
  Maximize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  Shield,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { GameEngine } from "./game/engine";
import {
  LEVELS,
  WEAPONS,
  initialSnapshot,
  type Settings,
  type Snapshot,
  type Weapon,
} from "./game/types";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Compass } from "./components/Compass";
import { Radar } from "./components/Radar";
import { GameDialog } from "./components/GameDialog";

const controls = [
  ["W A S D", "Drive / steer"],
  ["↑ ← ↓ →", "Alternative steering"],
  ["SHIFT", "Boost"],
  ["SPACE", "Drift brake"],
  ["CTRL", "Jump"],
  ["J / F / CLICK", "Fire weapon"],
  ["1 2 3", "Select weapon"],
  ["Q / E", "Cycle weapons"],
  ["R", "Recover vehicle"],
  ["ESC", "Pause / resume"],
];
function loadSettings(): Settings {
  try {
    const value = JSON.parse(
      localStorage.getItem("vector-wars-settings") ?? "{}",
    );
    return {
      sound: value.sound ?? true,
      music: value.music ?? true,
      effects:
        value.effects ??
        !matchMedia("(prefers-reduced-motion: reduce)").matches,
      quality: value.quality === "balanced" ? "balanced" : "high",
    };
  } catch {
    return { sound: true, music: true, effects: true, quality: "high" };
  }
}
function formatTime(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
}
function WeaponIcon({ weapon }: { weapon: Weapon }) {
  return (
    <svg viewBox="0 0 72 34" fill="none" aria-hidden="true">
      {weapon === "laser" ? (
        <>
          <path
            d="M8 15h32l8-5h15v5H49l-8 5H8Z"
            fill="currentColor"
            fillOpacity=".16"
            stroke="currentColor"
          />
          <path
            d="M20 15v-4h16v4M20 20l-4 10h7l5-10M50 21h15M57 25h10"
            stroke="currentColor"
          />
          <path d="M2 9h6M4 5v8" stroke="currentColor" opacity=".5" />
        </>
      ) : weapon === "missile" ? (
        <>
          <path
            d="m12 24 8-12 32-6 9 3-6 8-32 6-11 1Z"
            fill="currentColor"
            fillOpacity=".12"
            stroke="currentColor"
          />
          <path
            d="m21 14-7-6-6 1 8 10M25 23l-1 8 5-1 7-10M47 7l6 11M4 25l9-3M5 29l10-4"
            stroke="currentColor"
          />
        </>
      ) : (
        <>
          <path
            d="m22 12 14-5 14 5v11l-14 5-14-5Z"
            fill="currentColor"
            fillOpacity=".14"
            stroke="currentColor"
          />
          <path
            d="m22 12 14 5 14-5M36 17v11M36 7V2M18 18h-8M54 18h8M18 6l5 5M49 25l5 5"
            stroke="currentColor"
          />
          <circle cx="36" cy="12" r="2" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
export default function App() {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<GameEngine | null>(null);
  const [state, setState] = useState<Snapshot>(initialSnapshot);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [dialog, setDialog] = useState<"controls" | "settings" | null>(null);
  const [error, setError] = useState("");
  const [engineReady, setEngineReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const menu = state.phase === "ready",
    active = state.phase === "playing" || state.phase === "aftermath",
    level = LEVELS[state.level];
  useEffect(() => {
    if (!host.current) return;
    try {
      engine.current = new GameEngine(host.current, setState, settings);
      setEngineReady(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to start the 3D renderer.",
      );
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
    // The engine owns the animation loop. Settings update through its explicit API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    engine.current?.updateSettings(settings);
    try {
      localStorage.setItem("vector-wars-settings", JSON.stringify(settings));
    } catch {
      /* Settings still work for this session. */
    }
  }, [settings]);
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const openDialog = (name: "controls" | "settings") => {
    if (active) engine.current?.pause();
    setDialog(name);
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError(
        "Fullscreen is unavailable in this browser. You can keep playing in this window.",
      );
    }
  };
  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => setSettings((previous) => ({ ...previous, [key]: value }));
  return (
    <main
      className={`game-shell ${menu ? "is-menu" : "is-game"} ${settings.effects ? "crt-enabled" : ""}`}
    >
      <div className="world" ref={host} />
      <div className="world-vignette" aria-hidden="true" />
      {settings.effects && <div className="scanlines" aria-hidden="true" />}
      <header className="topbar">
        <a
          className="brand"
          href="#"
          aria-label="Vector Wars main menu"
          onClick={(e) => {
            e.preventDefault();
            if (active) engine.current?.pause();
            else if (state.phase !== "paused") engine.current?.returnToMenu();
          }}
        >
          <svg viewBox="0 0 34 30" aria-hidden="true">
            <path d="M1 2h8l8 19L25 2h8L20 29h-6Z" fill="currentColor" />
            <path d="m14 2 3 8 3-8Z" fill="#ff5b82" />
          </svg>
          <span>
            VECTOR<span className="brand-wars">WARS</span>
            <small>HOVER COMBAT SYSTEM</small>
          </span>
        </a>
        <div className="topbar-center">
          <i className="led" />
          <span>CONNECTION ESTABLISHED</span>
          <span className="divider">/</span>
          <span>SYS.1986</span>
        </div>
        <nav className="toolbar" aria-label="Game settings">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDialog("controls")}
            className="controls-button"
          >
            <Keyboard />
            <span>CONTROLS</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              settings.sound || settings.music
                ? "Mute all audio"
                : "Enable audio"
            }
            aria-pressed={settings.sound || settings.music}
            onClick={() =>
              setSettings((previous) => ({
                ...previous,
                sound: !(previous.sound || previous.music),
                music: !(previous.sound || previous.music),
              }))
            }
          >
            {settings.sound || settings.music ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Game settings"
            onClick={() => openDialog("settings")}
          >
            <Settings2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Maximize2 /> : <Expand />}
          </Button>
          {!menu && (
            <Button
              variant="outline"
              size="sm"
              aria-label={active ? "Pause game" : "Resume game"}
              onClick={() =>
                active ? engine.current?.pause() : engine.current?.resume()
              }
            >
              {active ? <Pause /> : <Play />}
              <span>ESC</span>
            </Button>
          )}
        </nav>
      </header>

      <div className="sector-strip">
        <span>
          <span className="signal-dot" />
          SECTOR {String(state.level + 1).padStart(2, "0")}{" "}
          <span className="strip-slash">/</span> {level.name}
        </span>
        <span className="sector-coordinates">
          {menu
            ? "34° 07′ N / 118° 19′ W"
            : `X ${state.x.toFixed(0).padStart(4, "0")} / Z ${state.z.toFixed(0).padStart(4, "0")}`}
        </span>
      </div>

      {menu ? (
        <section className="intro" aria-labelledby="game-title">
          <div className="eyebrow">
            <span className="mini-line" /> THE SIGNAL IS HOSTILE.
          </div>
          <h1 id="game-title">
            VECTOR
            <br />
            <span>WARS</span>
            <span className="title-period">.</span>
          </h1>
          <p className="intro-tagline">
            Into the afterglow.
            <br />
            Armed to the teeth.
          </p>
          <p className="intro-copy">
            A hovercraft. A neon wasteland.
            <br />
            Everything out there wants you gone.
          </p>
          <div className="launch-actions">
            <Button
              variant="primary"
              size="lg"
              className="deploy-button"
              disabled={!engineReady}
              onClick={() => engine.current?.start()}
            >
              DEPLOY HOVERCRAFT
              <ArrowRight />
            </Button>
            <span className="enter-hint">[ ENTER ]</span>
          </div>
          <button
            className="manual-link"
            onClick={() => openDialog("controls")}
          >
            <Keyboard size={14} /> FLIGHT MANUAL <ChevronRight size={13} />
          </button>
          <div className="intro-meta">
            <span>
              <i className="led" />
              SINGLE PLAYER
            </span>
            <span>03 SECTORS</span>
          </div>
        </section>
      ) : (
        <section className="telemetry" aria-label="Vehicle telemetry">
          <div className="telemetry-title">
            <span>
              <i className="led" />
              VXR–01 // ONLINE
            </span>
            <span>{formatTime(state.elapsed)}</span>
          </div>
          <div className="speed">
            <span>{state.speed.toString().padStart(3, "0")}</span>
            <div>
              KM/H
              <small>{state.altitude > 2 ? "AIRBORNE" : "GROUND SPEED"}</small>
            </div>
          </div>
          <div className="speed-scale" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => (
              <i key={i} className={i < state.speed / 12 ? "lit" : ""} />
            ))}
          </div>
          <div className="meter-label">
            <span>
              <Shield size={12} />
              HULL INTEGRITY
            </span>
            <strong className={state.health < 30 ? "text-signal" : ""}>
              {Math.ceil(state.health)}
              <small> / 100</small>
            </strong>
          </div>
          <Progress
            value={state.health}
            cells={22}
            aria-label="Hull integrity"
            className={state.health < 30 ? "hull-critical" : ""}
          />
          <div className="meter-label boost-label">
            <span>
              <Zap size={12} />
              BOOST CAPACITOR
            </span>
            <strong>
              {Math.round(state.boost)}
              <small>%</small>
            </strong>
          </div>
          <Progress
            value={state.boost}
            cells={22}
            aria-label="Boost capacitor"
            className="boost-progress"
          />
          <div className="score-line">
            <span>SCORE</span>
            <strong>{state.score.toString().padStart(6, "0")}</strong>
          </div>
        </section>
      )}

      <aside className="mission-panel" aria-label="Mission objectives">
        <div className="panel-topline">
          <span>
            <Target size={13} />
            MISSION BRIEF
          </span>
          <Badge variant="signal">
            {menu
              ? "AWAITING PILOT"
              : state.phase === "won"
                ? "COMPLETE"
                : "LIVE"}
          </Badge>
        </div>
        <div className="mission-number">
          0{state.level + 1}
          <span>/ 03</span>
          <div className="mission-number-lines" aria-hidden="true" />
        </div>
        <h2>{level.name}</h2>
        <p className="mission-description">{level.description}</p>
        <div className="objective-row">
          <span
            className={
              state.relays === 3 ? "objective-done" : "objective-square"
            }
          >
            {state.relays === 3 ? "✓" : "01"}
          </span>
          <span>Breach & destroy outposts</span>
          <b>{state.relays}/3</b>
        </div>
        <div className="objective-row">
          <span
            className={
              state.enemies === 0 ? "objective-done" : "objective-square"
            }
          >
            {state.enemies === 0 ? "✓" : "02"}
          </span>
          <span>Escorts (bonus)</span>
          <b>
            {LEVELS[state.level].drones - state.enemies}/
            {LEVELS[state.level].drones}
          </b>
        </div>
        <div className="objective-row">
          <span
            className={
              state.bossHealth === 0 ? "objective-done" : "objective-square"
            }
          >
            {state.bossHealth === 0 ? "✓" : "03"}
          </span>
          <span>Destroy {level.boss.replace("THE ", "").toLowerCase()}</span>
          <Shield
            size={12}
            className={state.bossShielded ? "shield-icon" : ""}
          />
        </div>
        {!menu && (
          <div className="breach-summary">
            {state.breached}/3 SHIELDS BREACHED <span>2.1 KM SECTOR</span>
          </div>
        )}
        <div className="mission-footer">
          <span className="signal-dot" />
          {state.bossShielded ? "CORE SHIELDED" : "CORE EXPOSED"}
          <span>{state.bossShielded ? "RELAYS ACTIVE" : "ENGAGE AT WILL"}</span>
        </div>
      </aside>

      {menu && (
        <div className="vehicle-label">
          <span className="vehicle-label-line" />
          <div>
            <span>YOUR RIDE</span>
            <strong>
              VXR–01 <span>“WRAITH”</span>
            </strong>
            <small>TWIN ION DRIVE / LIGHT ASSAULT</small>
          </div>
        </div>
      )}
      {!menu && (
        <>
          <div
            className={`crosshair ${state.targetLocked ? "locked" : ""}`}
            aria-hidden="true"
          >
            <span />
            <i />
            <span />
            <b>+</b>
            <span />
            <i />
            <span />
          </div>
          <div className="target-info">
            {state.targetLocked ? (
              <>
                <span>
                  <Crosshair size={12} />{" "}
                  {state.weapon === "missile"
                    ? "SEEKER LOCK"
                    : "TARGET ACQUIRED"}
                </span>
                <strong>
                  {state.target} <small>{state.targetDistance} M</small>
                </strong>
                <Progress
                  value={state.targetHealth}
                  aria-label="Target health"
                />
              </>
            ) : (
              <span>WEAPONS FREE</span>
            )}
          </div>
          <Compass heading={state.heading} />
          <div
            className={`navigation-cue ${state.breachTime > 0 ? "breaching" : ""}`}
          >
            <span
              className="navigation-arrow"
              style={{
                transform: `rotate(${Math.atan2(state.waypoint.x - state.x, -(state.waypoint.z - state.z)) + state.heading}rad)`,
              }}
            >
              ↑
            </span>
            <div>
              <small>{state.waypoint.detail}</small>
              <strong>
                {state.waypoint.name} <b>{state.waypoint.distance} M</b>
              </strong>
            </div>
            {state.breachTime > 0 && (
              <span className="breach-clock">
                {state.breachTime.toFixed(1)}
                <small>SEC / {state.breachGate + 1} OF 3</small>
              </span>
            )}
          </div>
          <div
            className="hull-impact"
            aria-hidden="true"
            style={{ opacity: state.hitPulse * (settings.effects ? 1 : 0.35) }}
          />
          <div
            className="damage-direction"
            aria-hidden="true"
            style={{
              opacity: state.hitPulse,
              transform: `translate(-50%,-50%) rotate(${state.hitDirection}rad)`,
            }}
          >
            <span />
          </div>
          <div
            className="hit-confirmation"
            aria-hidden="true"
            style={{ opacity: state.hitConfirm }}
          >
            ×
          </div>
          {state.killText && (
            <div className="kill-confirmation" role="status">
              {state.killText}
            </div>
          )}
          {state.phase === "aftermath" && (
            <div className="aftermath-banner" role="status">
              <span>
                {state.health > 0 ? "REACTOR MELTDOWN" : "SIGNAL LOST"}
              </span>
              <strong>
                {state.health > 0
                  ? state.aftermathTime < 3.5
                    ? "CORE DESTABILIZING"
                    : "SECTOR SECURED"
                  : "HULL DESTROYED"}
              </strong>
            </div>
          )}
          <div className="transmission" role="status">
            <Radio size={14} />
            <span>{state.message}</span>
          </div>
          {state.relays === 3 && state.bossHealth > 0 && (
            <div className="boss-health">
              <div>
                <span>{level.boss}</span>
                <span>
                  {Math.ceil((state.bossHealth / state.bossMaxHealth) * 100)}%
                </span>
              </div>
              <Progress
                value={(state.bossHealth / state.bossMaxHealth) * 100}
                aria-label="Boss health"
              />
            </div>
          )}
        </>
      )}
      <div className="radar-position">
        <Radar state={state} />
      </div>

      <footer className="bottom-deck">
        <div className="loadout-label">
          <span>LOADOUT</span>
          <strong>
            MAKE SOME
            <br />
            STATIC.
          </strong>
          <span className="loadout-key">[ 1 – 3 ] TO SWITCH</span>
        </div>
        <div className="weapon-rack" aria-label="Select weapon">
          {WEAPONS.map((w) => (
            <button
              key={w.id}
              className={`weapon-card ${state.weapon === w.id ? "selected" : ""}`}
              aria-pressed={state.weapon === w.id}
              onClick={() => engine.current?.setWeapon(w.id)}
            >
              <div className="weapon-top">
                <span className="weapon-key">{w.key}</span>
                <span>{state.weapon === w.id ? "EQUIPPED" : w.short}</span>
                <i />
              </div>
              <WeaponIcon weapon={w.id} />
              <div className="weapon-name">{w.name}</div>
              <div className="weapon-bottom">
                <span>
                  {w.id === "laser"
                    ? "ENERGY / UNLIMITED"
                    : w.id === "missile"
                      ? "HOMING / EXPLOSIVE"
                      : "PROXIMITY / EXPLOSIVE"}
                </span>
                <strong>
                  {w.id === "laser"
                    ? "∞"
                    : String(
                        w.id === "missile" ? state.missiles : state.mines,
                      ).padStart(2, "0")}
                </strong>
              </div>
            </button>
          ))}
        </div>
        <div className="deck-status">
          <div>
            <span className="led" /> {menu ? "VEHICLE READY" : "SYSTEMS ONLINE"}
          </div>
          <div className="deck-stat">
            <Gauge size={14} />
            <span>
              {menu
                ? "TWIN ION DRIVE"
                : state.altitude > 2
                  ? `ALT ${Math.round(state.altitude)} M`
                  : "HOVER STABILIZED"}
            </span>
          </div>
          <div className="deck-stat">
            <Shield size={14} />
            <span>
              {menu
                ? "HULL INTEGRITY 100%"
                : `BEST ${state.best.toString().padStart(6, "0")}`}
            </span>
          </div>
          <div className="deck-bars" aria-hidden="true">
            {Array.from({ length: 26 }, (_, i) => (
              <i
                key={i}
                style={{
                  height: `${8 + Math.sin(i * 2) * 5 + Math.cos(i * 4) * 4}px`,
                }}
              />
            ))}
          </div>
        </div>
      </footer>
      <div className="system-footer">
        <span>
          VECTOR WARS <span className="footer-dim">/</span>{" "}
          <a
            href="https://afterglow.thebuilder.dk/"
            target="_blank"
            rel="noreferrer"
          >
            AFTERGLOW UI
          </a>
        </span>
        <span className="footer-instruction">
          {menu
            ? "DESKTOP + KEYBOARD RECOMMENDED"
            : "WASD DRIVE · SHIFT BOOST · SPACE DRIFT · CTRL JUMP · J FIRE"}
        </span>
        <span>
          <i className="led" />
          {Math.min(999, Math.round(state.fps))} FPS{" "}
          <span className="footer-dim">/</span> WEBGL 2
        </span>
      </div>

      {state.phase === "paused" && !dialog && (
        <GameDialog
          title="Signal on hold."
          eyebrow="SYSTEM // PAUSED"
          onClose={() => engine.current?.resume()}
        >
          <p>The wasteland can wait.</p>
          <div className="dialog-actions">
            <Button
              variant="primary"
              size="lg"
              onClick={() => engine.current?.resume()}
            >
              <Play />
              RESUME MISSION
            </Button>
            <Button variant="outline" onClick={() => openDialog("controls")}>
              <Keyboard />
              FLIGHT MANUAL
            </Button>
            <Button variant="ghost" onClick={() => engine.current?.restart()}>
              <RotateCcw />
              RESTART SECTOR
            </Button>
            <Button
              variant="ghost"
              onClick={() => engine.current?.returnToMenu()}
            >
              RETURN TO HANGAR
            </Button>
          </div>
        </GameDialog>
      )}
      {(state.phase === "won" ||
        state.phase === "lost" ||
        state.phase === "complete") && (
        <GameDialog
          title={
            state.phase === "lost"
              ? "Signal lost."
              : state.phase === "complete"
                ? "The grid is yours."
                : "Signal silenced."
          }
          eyebrow={
            state.phase === "lost" ? "MISSION // FAILED" : "MISSION // COMPLETE"
          }
          onClose={() => engine.current?.returnToMenu()}
        >
          <div
            className={`result-symbol ${state.phase === "lost" ? "failed" : ""}`}
          >
            {state.phase === "lost" ? <X /> : <Target />}
          </div>
          <p>
            {state.phase === "lost"
              ? "The Wraith is down. Your next run starts here."
              : state.phase === "complete"
                ? "Three sectors liberated. The last transmission is yours."
                : `${level.boss} is offline. Sector secured.`}
          </p>
          <div className="result-stats">
            <div>
              <span>SCORE</span>
              <strong>{state.score.toLocaleString()}</strong>
            </div>
            <div>
              <span>TIME</span>
              <strong>{formatTime(state.elapsed)}</strong>
            </div>
            <div>
              <span>BEST</span>
              <strong>{state.best.toLocaleString()}</strong>
            </div>
          </div>
          <div className="dialog-actions">
            <Button
              variant="primary"
              size="lg"
              onClick={() =>
                state.phase === "lost"
                  ? engine.current?.restart()
                  : state.phase === "complete"
                    ? engine.current?.newCampaign()
                    : engine.current?.nextLevel()
              }
            >
              {state.phase === "lost"
                ? "TRY AGAIN"
                : state.phase === "complete"
                  ? "NEW CAMPAIGN"
                  : state.level === 2
                    ? "FINISH CAMPAIGN"
                    : "NEXT SECTOR"}
              <ArrowRight />
            </Button>
            <Button
              variant="ghost"
              onClick={() => engine.current?.returnToMenu()}
            >
              RETURN TO HANGAR
            </Button>
          </div>
        </GameDialog>
      )}
      {dialog === "controls" && (
        <GameDialog
          title="Know your Wraith."
          eyebrow="PILOT REFERENCE // 001"
          onClose={() => setDialog(null)}
        >
          <p>
            Keep moving. Face a target to aim. Hold fire and let the twin lasers
            do the talking.
          </p>
          <div className="control-list">
            {controls.map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <div className="manual-tip">
            <Sparkles size={17} />
            <p>
              Each outpost has an amber breach route. Pass gates 01 and 02, then
              take the ramp through the airborne JUMP coupler within 14 seconds.
              Keep at least 90 km/h through the jump. Boost between gates and
              drift through the turn. A breach permanently exposes that relay;
              destroy all three to unlock the reactor. Green caches repair and
              resupply. Break away at speed when surrounded, or leave mines for
              pursuers.
            </p>
          </div>
          <Button
            variant="primary"
            className="dialog-full"
            onClick={() => setDialog(null)}
          >
            READY TO FLY
            <ArrowRight />
          </Button>
        </GameDialog>
      )}
      {dialog === "settings" && (
        <GameDialog
          title="Tune the signal."
          eyebrow="SYSTEM CONFIGURATION"
          onClose={() => setDialog(null)}
        >
          <p>Your settings are saved on this device.</p>
          <div className="settings-list">
            {(
              [
                {
                  key: "sound",
                  name: "Sound effects",
                  detail: "Engines, weapons, and explosions",
                  icon: Volume2,
                },
                {
                  key: "music",
                  name: "Synth soundtrack",
                  detail: "An original, generated midnight transmission",
                  icon: AudioLines,
                },
                {
                  key: "effects",
                  name: "CRT & bloom",
                  detail: "Scanlines, neon glow, and camera shake",
                  icon: Sparkles,
                },
              ] as const
            ).map(({ key, name, detail, icon: Icon }) => (
              <div className="setting-row" key={key}>
                <Icon size={18} />
                <div>
                  <strong>{name}</strong>
                  <small>{detail}</small>
                </div>
                <button
                  role="switch"
                  aria-checked={settings[key]}
                  aria-label={name}
                  className="terminal-switch"
                  onClick={() => updateSetting(key, !settings[key])}
                >
                  <span />
                  {settings[key] ? "ON" : "OFF"}
                </button>
              </div>
            ))}
            <div className="setting-row">
              <Gauge size={18} />
              <div>
                <strong>Render quality</strong>
                <small>Balanced uses fewer pixels</small>
              </div>
              <select
                value={settings.quality}
                aria-label="Render quality"
                onChange={(e) =>
                  updateSetting(
                    "quality",
                    e.target.value as Settings["quality"],
                  )
                }
              >
                <option value="high">HIGH</option>
                <option value="balanced">BALANCED</option>
              </select>
            </div>
          </div>
          <Button
            variant="primary"
            className="dialog-full"
            onClick={() => setDialog(null)}
          >
            SAVE & CLOSE
            <ArrowRight />
          </Button>
        </GameDialog>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>
            {error}{" "}
            {!engine.current &&
              "This game requires a browser with WebGL 2 hardware acceleration."}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss message"
            onClick={() => setError("")}
          >
            <X />
          </Button>
        </div>
      )}
      <div className="mobile-note">
        <Keyboard />
        <strong>Bring a keyboard.</strong>
        <p>
          The Wraith was built for desktop. Open this game on a computer to
          drive and fight.
        </p>
        <span>WASD · SHIFT · J</span>
        <ArrowDown />
      </div>
    </main>
  );
}
