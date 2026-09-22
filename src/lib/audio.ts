let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  audioContext ??= new AudioContext();
  return audioContext;
}

function tone(
  ctx: AudioContext,
  start: number,
  frequency: number,
  duration: number,
  gain = 0.08
) {
  const oscillator = ctx.createOscillator();
  const amp = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(amp);
  amp.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export async function playCue(kind: "warn" | "end") {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const now = ctx.currentTime;
  if (kind === "warn") {
    tone(ctx, now, 880, 0.12);
    tone(ctx, now + 0.16, 880, 0.12);
    return;
  }
  tone(ctx, now, 523.25, 0.18);
  tone(ctx, now + 0.2, 392, 0.4, 0.1);
}
