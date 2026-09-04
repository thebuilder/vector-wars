/** Small, entirely synthesized arcade soundtrack. No audio downloads. */
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private beat = 0;
  sound = true;
  music = true;
  active = false;
  start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.context.destination);
      this.engine = this.context.createOscillator();
      this.engine.type = "sawtooth";
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 170;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engine.start();
      this.timer = setInterval(() => this.tick(), 150);
    }
    void this.context.resume();
    this.active = true;
  }
  tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    endFrequency?: number,
  ) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        now + duration,
      );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  effect(
    kind:
      "laser" | "missile" | "mine" | "hit" | "explosion" | "pickup" | "jump",
  ) {
    if (!this.sound) return;
    const notes = {
      laser: [900, 0.1, 0.1, 130],
      missile: [150, 0.35, 0.22, 40],
      mine: [170, 0.15, 0.2, 60],
      hit: [120, 0.12, 0.15, 35],
      explosion: [80, 0.55, 0.4, 18],
      pickup: [660, 0.35, 0.18, 1320],
      jump: [180, 0.25, 0.12, 500],
    };
    const [f, d, v, end] = notes[kind];
    this.tone(f, d, v, kind === "pickup" ? "sine" : "sawtooth", end);
  }
  private tick() {
    if (!this.active || !this.music) return;
    const bass = [55, 55, 65.41, 49][Math.floor(this.beat / 16) % 4];
    if (this.beat % 2 === 0) this.tone(bass, 0.22, 0.17, "triangle");
    if (this.beat % 4 === 0) this.tone(100, 0.12, 0.2, "sine", 30);
    if (this.beat % 4 === 2) this.tone(180, 0.08, 0.055, "sawtooth", 75);
    const arp = [4, 6, 8, 12, 8, 6, 4, 3][this.beat % 8];
    this.tone(bass * arp, 0.23, 0.035, "triangle");
    this.beat++;
  }
  update(speed: number, boosting: boolean) {
    if (!this.context || !this.engine || !this.engineGain) return;
    this.engine.frequency.setTargetAtTime(
      35 + speed * 0.7 + (boosting ? 35 : 0),
      this.context.currentTime,
      0.1,
    );
    this.engineGain.gain.setTargetAtTime(
      this.sound && this.active ? 0.02 + speed * 0.0006 : 0,
      this.context.currentTime,
      0.1,
    );
  }
  pause() {
    this.active = false;
    this.update(0, false);
  }
  dispose() {
    clearInterval(this.timer);
    this.engine?.stop();
    void this.context?.close();
  }
}
