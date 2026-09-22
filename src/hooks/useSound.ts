"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getServerSoundMuted,
  getSoundMuted,
  playTopicLanded,
  setSoundMuted,
  subscribeSound,
  unlockSound,
} from "@/lib/audio";

export function useSound() {
  const muted = useSyncExternalStore(
    subscribeSound,
    getSoundMuted,
    getServerSoundMuted
  );

  const toggleMuted = useCallback(() => {
    const next = !getSoundMuted();
    setSoundMuted(next);
    if (!next) {
      unlockSound();
      playTopicLanded();
    }
  }, []);

  return { muted, toggleMuted, unlockSound };
}
