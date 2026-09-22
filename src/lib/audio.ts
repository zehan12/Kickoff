const STORAGE_KEY = "kickoff.soundMuted";

let audioContext: AudioContext | null = null;
let muted = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeSound(listener: () => void) {
  if (listeners.size === 0) {
    loadMutedPreference();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSoundMuted() {
  return muted;
}

export function getServerSoundMuted() {
  return false;
}

export function loadMutedPreference() {
  if (typeof window === "undefined") return;
  muted = window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setSoundMuted(next: boolean) {
  muted = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }
  emit();
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  audioContext ??= new Ctor();
  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => undefined);
  }
  return audioContext;
}

export function unlockSound() {
  if (muted) return;
  getAudioContext();
}

function tone(
  ctx: AudioContext,
  destination: AudioNode,
  start: number,
  frequency: number,
  duration: number,
  type: OscillatorType,
  peak: number
) {
  const oscillator = ctx.createOscillator();
  const amp = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(amp);
  amp.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playSpinTick(intensity = 1) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const duration = 0.018;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800 + Math.random() * 900, now);
  filter.Q.value = 1.1;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(0.5 * intensity, now + 0.001);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  source.start(now);
  source.stop(now + duration + 0.01);
}

export function playTopicLanded() {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.42;
  master.connect(ctx.destination);
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    tone(ctx, master, now + index * 0.07, frequency, 0.45, "sine", 0.28);
  });
}

export function playTimerCompleted() {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.48;
  master.connect(ctx.destination);
  [392, 523.25, 659.25, 784].forEach((frequency, index) => {
    tone(ctx, master, now + index * 0.12, frequency, 0.55, "triangle", 0.32);
  });
  tone(ctx, master, now + 0.55, 1046.5, 0.9, "sine", 0.22);
}

export function playWarnCue() {
  if (muted) return;
  playSpinTick(0.7);
  window.setTimeout(() => playSpinTick(0.45), 140);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
