"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CountdownStatus = "idle" | "running" | "paused" | "finished";

type UseCountdownOptions = {
  duration?: number;
  onWarn?: () => void;
  onComplete?: () => void;
  warnAt?: number;
};

export function useCountdown({
  duration = 60,
  onWarn,
  onComplete,
  warnAt = 10,
}: UseCountdownOptions = {}) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [status, setStatus] = useState<CountdownStatus>("idle");

  const remainingRef = useRef(duration);
  const statusRef = useRef<CountdownStatus>("idle");
  const warnedRef = useRef(false);
  const completedRef = useRef(false);
  const onWarnRef = useRef(onWarn);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    onWarnRef.current = onWarn;
    onCompleteRef.current = onComplete;
  }, [onWarn, onComplete]);

  useEffect(() => {
    if (status !== "running") return;

    const startedAt = Date.now();
    const fromSeconds = remainingRef.current;

    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const next = Math.max(0, fromSeconds - elapsed);
      const whole = Math.ceil(next);
      remainingRef.current = next;

      if (!warnedRef.current && whole <= warnAt && next > 0) {
        warnedRef.current = true;
        onWarnRef.current?.();
      }

      if (next <= 0) {
        setSecondsLeft(0);
        if (!completedRef.current) {
          completedRef.current = true;
          setStatus("finished");
          onCompleteRef.current?.();
        }
        return;
      }

      setSecondsLeft(next);
    };

    tick();
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [status, warnAt]);

  const start = useCallback(() => {
    if (statusRef.current === "finished" || remainingRef.current <= 0) return;
    setStatus("running");
  }, []);

  const pause = useCallback(() => {
    if (statusRef.current !== "running") return;
    setSecondsLeft(remainingRef.current);
    setStatus("paused");
  }, []);

  const reset = useCallback(
    (nextDuration = duration) => {
      warnedRef.current = false;
      completedRef.current = false;
      remainingRef.current = nextDuration;
      setSecondsLeft(nextDuration);
      setStatus("idle");
    },
    [duration]
  );

  const toggle = useCallback(() => {
    if (statusRef.current === "running") {
      pause();
      return;
    }
    start();
  }, [pause, start]);

  return {
    secondsLeft,
    status,
    progress: Math.min(1, Math.max(0, secondsLeft / duration)),
    start,
    pause,
    reset,
    toggle,
  };
}
