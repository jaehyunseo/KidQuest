// ─── Web Audio API Sound Synthesizer ────────────────────────────
// All sounds are generated programmatically — zero network requests,
// zero external dependencies. Each sound is designed for a specific
// in-app context so the user always gets clear audio feedback.

let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();
  }
  // Safari / mobile: resume after user gesture.
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Primitives ──────────────────────────────────────────────────

type OscType = OscillatorType;

interface ToneOpts {
  freq: number;
  type?: OscType;
  duration?: number;   // seconds
  volume?: number;     // 0-1
  delay?: number;      // seconds from "now"
  ramp?: number;       // fade-out start (0-1 of duration)
  detune?: number;
}

function tone(ac: AudioContext, t0: number, opts: ToneOpts) {
  const {
    freq,
    type = 'sine',
    duration = 0.15,
    volume = 0.25,
    delay = 0,
    ramp = 0.6,
    detune = 0,
  } = opts;
  const start = t0 + delay;
  const end = start + duration;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  if (detune) osc.detune.value = detune;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.setValueAtTime(volume, start + duration * ramp);
  gain.gain.linearRampToValueAtTime(0, end);

  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

function noise(
  ac: AudioContext,
  t0: number,
  duration: number,
  volume: number,
  filterFreq: number,
) {
  const len = ac.sampleRate * duration;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buf;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.5;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.linearRampToValueAtTime(0, t0 + duration);

  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// ── Sound catalogue ─────────────────────────────────────────────
// Every export is a cheap function that fires a short synth phrase.

/** Bright rising two-note chime — quest completed */
export function questComplete() {
  const ac = ctx();
  const t = ac.currentTime;
  tone(ac, t, { freq: 784,  type: 'triangle', duration: 0.12, volume: 0.22 }); // G5
  tone(ac, t, { freq: 1047, type: 'triangle', duration: 0.22, volume: 0.25, delay: 0.09 }); // C6
}

/** Soft descending tone — quest unchecked */
export function questUncheck() {
  const ac = ctx();
  const t = ac.currentTime;
  tone(ac, t, { freq: 587, type: 'sine', duration: 0.12, volume: 0.15 }); // D5
  tone(ac, t, { freq: 440, type: 'sine', duration: 0.18, volume: 0.12, delay: 0.08 }); // A4
}

/** Triumphant fanfare — group bonus awarded */
export function bonus() {
  const ac = ctx();
  const t = ac.currentTime;
  // C5 → E5 → G5 → C6 fast arpeggio
  tone(ac, t, { freq: 523,  type: 'triangle', duration: 0.12, volume: 0.2 });
  tone(ac, t, { freq: 659,  type: 'triangle', duration: 0.12, volume: 0.22, delay: 0.08 });
  tone(ac, t, { freq: 784,  type: 'triangle', duration: 0.14, volume: 0.24, delay: 0.16 });
  tone(ac, t, { freq: 1047, type: 'triangle', duration: 0.35, volume: 0.28, delay: 0.24 });
  // Sparkle overtone
  tone(ac, t, { freq: 2093, type: 'sine', duration: 0.25, volume: 0.06, delay: 0.28 });
}

/** Magical sparkle — reward redeemed */
export function rewardClaim() {
  const ac = ctx();
  const t = ac.currentTime;
  // Descending sparkle cascade
  tone(ac, t, { freq: 1319, type: 'sine', duration: 0.1,  volume: 0.18 });             // E6
  tone(ac, t, { freq: 1568, type: 'sine', duration: 0.1,  volume: 0.15, delay: 0.06 }); // G6
  tone(ac, t, { freq: 1047, type: 'sine', duration: 0.12, volume: 0.18, delay: 0.12 }); // C6
  tone(ac, t, { freq: 1319, type: 'sine', duration: 0.25, volume: 0.2,  delay: 0.18 }); // E6
  noise(ac, t + 0.05, 0.15, 0.03, 6000); // shimmer
}

/** Achievement jingle — new badge unlocked */
export function badgeUnlock() {
  const ac = ctx();
  const t = ac.currentTime;
  // G4 → B4 → D5 → G5 heroic arpeggio
  tone(ac, t, { freq: 392, type: 'square', duration: 0.1,  volume: 0.12 });
  tone(ac, t, { freq: 494, type: 'square', duration: 0.1,  volume: 0.13, delay: 0.08 });
  tone(ac, t, { freq: 587, type: 'square', duration: 0.12, volume: 0.14, delay: 0.16 });
  tone(ac, t, { freq: 784, type: 'triangle', duration: 0.4, volume: 0.22, delay: 0.24 });
  // Octave shimmer on top
  tone(ac, t, { freq: 1568, type: 'sine', duration: 0.3, volume: 0.05, delay: 0.26 });
}

/** Epic ascending arpeggio — level up */
export function levelUp() {
  const ac = ctx();
  const t = ac.currentTime;
  // C4 → E4 → G4 → C5 → E5 → G5 → C6
  const notes = [262, 330, 392, 523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    tone(ac, t, {
      freq,
      type: i < 4 ? 'square' : 'triangle',
      duration: i === notes.length - 1 ? 0.45 : 0.08,
      volume: 0.1 + i * 0.025,
      delay: i * 0.06,
    });
  });
  // Bright shimmer on final note
  tone(ac, t, { freq: 2093, type: 'sine', duration: 0.35, volume: 0.06, delay: 0.38 });
}

/** Quick coin collect — points gained */
export function coinCollect() {
  const ac = ctx();
  const t = ac.currentTime;
  tone(ac, t, { freq: 988,  type: 'square', duration: 0.06, volume: 0.12 }); // B5
  tone(ac, t, { freq: 1319, type: 'square', duration: 0.1,  volume: 0.15, delay: 0.05 }); // E6
}

/** Deflating — points deducted (penalty) */
export function pointsLose() {
  const ac = ctx();
  const t = ac.currentTime;
  tone(ac, t, { freq: 440, type: 'sawtooth', duration: 0.15, volume: 0.1 });
  tone(ac, t, { freq: 330, type: 'sawtooth', duration: 0.2,  volume: 0.08, delay: 0.1 });
  tone(ac, t, { freq: 220, type: 'sawtooth', duration: 0.25, volume: 0.06, delay: 0.2 });
}

/** Soft pop — button tap */
export function tap() {
  const ac = ctx();
  const t = ac.currentTime;
  tone(ac, t, { freq: 600, type: 'sine', duration: 0.06, volume: 0.12, ramp: 0.3 });
}

/** Subtle swoosh — tab / navigation switch */
export function nav() {
  const ac = ctx();
  const t = ac.currentTime;
  tone(ac, t, { freq: 400, type: 'sine', duration: 0.08, volume: 0.08, ramp: 0.2 });
  tone(ac, t, { freq: 700, type: 'sine', duration: 0.06, volume: 0.06, delay: 0.03 });
}

/** Gentle buzz — error / validation failure */
export function error() {
  const ac = ctx();
  const t = ac.currentTime;
  tone(ac, t, { freq: 200, type: 'square', duration: 0.12, volume: 0.12 });
  tone(ac, t, { freq: 180, type: 'square', duration: 0.12, volume: 0.1, delay: 0.14 });
}

/** Party celebration — big achievement / confetti moment */
export function celebrate() {
  const ac = ctx();
  const t = ac.currentTime;
  // Quick fanfare + noise burst
  tone(ac, t, { freq: 523,  type: 'triangle', duration: 0.1,  volume: 0.18 });
  tone(ac, t, { freq: 659,  type: 'triangle', duration: 0.08, volume: 0.2,  delay: 0.06 });
  tone(ac, t, { freq: 784,  type: 'triangle', duration: 0.08, volume: 0.22, delay: 0.12 });
  tone(ac, t, { freq: 1047, type: 'triangle', duration: 0.5,  volume: 0.28, delay: 0.18 });
  // High sparkle
  tone(ac, t, { freq: 2093, type: 'sine', duration: 0.35, volume: 0.07, delay: 0.22 });
  tone(ac, t, { freq: 2637, type: 'sine', duration: 0.3,  volume: 0.04, delay: 0.28 });
  // Percussive burst
  noise(ac, t + 0.18, 0.2, 0.04, 4000);
}

/** Streak milestone — daily streak continues */
export function streak() {
  const ac = ctx();
  const t = ac.currentTime;
  // Warm ascending thirds
  tone(ac, t, { freq: 440,  type: 'triangle', duration: 0.1,  volume: 0.15 }); // A4
  tone(ac, t, { freq: 554,  type: 'triangle', duration: 0.12, volume: 0.18, delay: 0.07 }); // C#5
  tone(ac, t, { freq: 659,  type: 'triangle', duration: 0.2,  volume: 0.2,  delay: 0.14 }); // E5
}

// ── Legacy compat layer ─────────────────────────────────────────
// Keeps old `SOUNDS` / `playSound` references working until all
// call-sites migrate to the new named exports.
export const SOUNDS = {
  SUCCESS: 'quest_complete',
  CLICK: 'tap',
  CELEBRATE: 'celebrate',
  ERROR: 'error',
} as const;

const _legacyMap: Record<string, () => void> = {
  quest_complete: questComplete,
  tap,
  celebrate,
  error,
};

export function playSound(key: string) {
  const fn = _legacyMap[key];
  if (fn) {
    fn();
  } else {
    // Unknown key — silent fallback instead of crashing.
    console.warn(`[sound] unknown sound key: ${key}`);
  }
}
