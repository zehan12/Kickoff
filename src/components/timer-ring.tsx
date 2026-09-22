"use client";

import { cn } from "cn";

type TimerRingProps = {
  progress: number;
  secondsLeft: number;
  urgency?: boolean;
};

export function TimerRing({ progress, secondsLeft, urgency }: TimerRingProps) {
  const size = 220;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const whole = Math.max(0, Math.ceil(secondsLeft));
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;

  return (
    <div className="relative grid size-[clamp(7rem,20vh,12rem)] shrink-0 place-items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-75",
            urgency ? "text-destructive" : "text-[oklch(0.78_0.08_70)]"
          )}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <p
          className={cn(
            "font-heading text-[clamp(1.75rem,5vh,3rem)] tracking-tight tabular-nums",
            urgency && "text-destructive"
          )}
        >
          {minutes}:{secs.toString().padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}
