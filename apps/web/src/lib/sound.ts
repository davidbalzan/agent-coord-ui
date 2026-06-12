// Subtle synthesized "blip" cues for inbox notifications — no audio assets, all
// Web Audio. Loudness/tone scale with the notification priority.

type Priority = "loud" | "dock" | "subtle";

const MUTE_KEY = "nexus.inboxSoundMuted";

let muted = readMuted();
let ctx: AudioContext | null = null;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isInboxSoundMuted(): boolean {
  return muted;
}

export function setInboxSoundMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

function getCtx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Browsers block audio until a user gesture — warm/resume the context on the
// first interaction so the first real notification can actually sound.
if (typeof window !== "undefined") {
  const warm = () => {
    getCtx();
    window.removeEventListener("pointerdown", warm);
    window.removeEventListener("keydown", warm);
  };
  window.addEventListener("pointerdown", warm, { once: true });
  window.addEventListener("keydown", warm, { once: true });
}

/** Play a short NEXUS blip for an inbox notification of the given priority. */
export function playInboxSound(priority: Priority): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;

  const tones =
    priority === "loud"
      ? [880, 1320]
      : priority === "dock"
        ? [660, 990]
        : [620];
  const peak = priority === "loud" ? 0.13 : priority === "dock" ? 0.085 : 0.05;

  const now = c.currentTime;
  tones.forEach((freq, i) => {
    const t = now + i * 0.085;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  });
}
