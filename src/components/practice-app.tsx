"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, RotateCcw, Shuffle, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimerRing } from "@/components/timer-ring";
import { topics as topicBank } from "@/data/topics";
import {
  playSpinTick,
  playTimerCompleted,
  playTopicLanded,
  playWarnCue,
  unlockSound,
} from "@/lib/audio";
import type { Difficulty, Topic, TopicType } from "@/lib/types";
import { useCountdown } from "@/hooks/useCountdown";
import { usePracticeHistory } from "@/hooks/usePracticeHistory";
import { useSound } from "@/hooks/useSound";
import { useTopicDeck } from "@/hooks/useTopicDeck";

const DURATION = 60;

type DifficultyFilter = "all" | Difficulty;

const typeCopy: Record<TopicType, { label: string; hint: string }> = {
  explainer: {
    label: "Explainer",
    hint: "Teach the idea as if a new fan just asked you.",
  },
  trivia: {
    label: "Trivia",
    hint: "Recall the facts, then colour in the story around them.",
  },
  debate: {
    label: "Debate",
    hint: "Pick a side and argue it — opinion over a quiz answer.",
  },
};

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function PracticeApp() {
  const isClient = useIsClient();
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const pool = useMemo(
    () =>
      difficulty === "all"
        ? topicBank
        : topicBank.filter((topic) => topic.difficulty === difficulty),
    [difficulty]
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader />
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center px-5 py-4 md:px-10">
        {isClient ? (
          <PracticeSession
            key={difficulty}
            pool={pool}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
          />
        ) : (
          <p className="text-muted-foreground">Drawing a topic…</p>
        )}
      </main>
    </div>
  );
}

function AppHeader() {
  const { muted, toggleMuted } = useSound();
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 px-5 py-4 md:px-10">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-[oklch(0.78_0.08_70)] text-sm font-semibold text-[oklch(0.22_0.02_90)]">
          1m
        </span>
        <div>
          <p className="font-heading text-xl leading-none tracking-tight">
            Kickoff
          </p>
          <p className="text-xs text-muted-foreground">
            1-minute football speaking
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="icon-lg"
        className="rounded-full"
        aria-label={muted ? "Unmute timer sounds" : "Mute timer sounds"}
        aria-pressed={!muted}
        onClick={toggleMuted}
      >
        {muted ? <VolumeX /> : <Volume2 />}
      </Button>
    </header>
  );
}

function PracticeSession({
  pool,
  difficulty,
  onDifficultyChange,
}: {
  pool: Topic[];
  difficulty: DifficultyFilter;
  onDifficultyChange: (value: DifficultyFilter) => void;
}) {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinPrompt, setSpinPrompt] = useState<string | null>(null);
  const spinToken = useRef(0);
  const { current, remainingCount, drawNext } = useTopicDeck(pool);
  const history = usePracticeHistory();
  const timer = useCountdown({
    duration: DURATION,
    onWarn: () => {
      playWarnCue();
    },
    onComplete: () => {
      playTimerCompleted();
      if (!current) return;
      const id = crypto.randomUUID();
      setRoundId(id);
      setPendingRating(true);
      history.addEntry({
        id,
        topicId: current.id,
        prompt: current.prompt,
        type: current.type,
        difficulty: current.difficulty,
        startedAt: new Date().toISOString(),
      });
    },
  });

  const urgent = timer.status === "running" && timer.secondsLeft <= 10;
  const displayedPrompt = spinPrompt ?? current?.prompt;

  function handleStart() {
    unlockSound();
    timer.toggle();
  }

  async function handleDrawAnother() {
    if (spinning || pool.length === 0) return;
    unlockSound();
    timer.reset();
    setPendingRating(false);
    setRoundId(null);

    const token = spinToken.current + 1;
    spinToken.current = token;
    setSpinning(true);

    const frames = 10;
    for (let i = 0; i < frames; i += 1) {
      if (spinToken.current !== token) return;
      const preview = pool[Math.floor(Math.random() * pool.length)];
      setSpinPrompt(preview.prompt);
      playSpinTick(1 - (i / frames) * 0.6);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 45 + i * 8);
      });
    }

    if (spinToken.current !== token) return;
    drawNext();
    setSpinPrompt(null);
    setSpinning(false);
    playTopicLanded();
  }

  function handleRate(rating: number) {
    if (!roundId) return;
    history.rateEntry(roundId, rating);
    setPendingRating(false);
  }

  return (
    <section className="flex min-h-0 w-full flex-col items-center justify-center gap-[clamp(0.75rem,2.4vh,1.75rem)] text-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Select
          value={difficulty}
          onValueChange={(value) => {
            if (!value) return;
            onDifficultyChange(value as DifficultyFilter);
          }}
        >
          <SelectTrigger className="h-10 min-w-44 rounded-full border-foreground/15 bg-foreground/5 px-4 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="all">All difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {remainingCount} left in this shuffle
        </p>
      </div>

      {current ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-[oklch(0.78_0.08_70)] uppercase">
            Your topic
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge
              variant={current.type === "debate" ? "default" : "outline"}
              className={
                current.type === "debate"
                  ? "h-6 border-transparent bg-[oklch(0.78_0.08_70)] px-2.5 text-sm text-[oklch(0.22_0.02_90)]"
                  : "h-6 px-2.5 text-sm"
              }
            >
              {typeCopy[current.type].label}
            </Badge>
            <Badge variant="secondary" className="h-6 px-2.5 text-sm capitalize">
              {current.difficulty}
            </Badge>
          </div>
          <h1 className="font-heading max-w-4xl text-[clamp(2.1rem,6.5vh,4.25rem)] leading-[1.12] text-balance">
            {displayedPrompt}
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            {typeCopy[current.type].hint}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground">No topics in this filter.</p>
      )}

      <div className="flex flex-col items-center gap-2">
        <TimerRing
          progress={timer.progress}
          secondsLeft={timer.secondsLeft}
          urgency={urgent}
        />
        <p className="text-sm tracking-wide text-muted-foreground uppercase">
          {timer.status === "idle" && "Ready when you are"}
          {timer.status === "running" &&
            (urgent ? "Ten seconds — wrap it up" : "Keep talking")}
          {timer.status === "paused" && "Paused"}
          {timer.status === "finished" && "Time"}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          className="h-12 rounded-full bg-[oklch(0.78_0.08_70)] px-6 text-base text-[oklch(0.22_0.02_90)] hover:bg-[oklch(0.74_0.08_70)]"
          onClick={handleDrawAnother}
          disabled={!current || spinning}
        >
          <Shuffle data-icon="inline-start" />
          Draw another
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 rounded-full px-6 text-base"
          onClick={handleStart}
          disabled={!current || timer.status === "finished" || spinning}
        >
          {timer.status === "running" ? (
            <Pause data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {timer.status === "running"
            ? "Pause"
            : timer.status === "paused"
              ? "Resume"
              : "Speak for 1 minute"}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="h-12 rounded-full px-5 text-base"
          onClick={() => {
            timer.reset();
            setPendingRating(false);
            setRoundId(null);
          }}
        >
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </div>

      {timer.status === "finished" && pendingRating && (
        <div className="flex items-center gap-3 rounded-full border border-foreground/10 bg-foreground/4 px-5 py-2.5">
          <p className="text-base font-medium">How did that round feel?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <Button
                key={score}
                variant="outline"
                size="icon"
                className="size-10 rounded-full text-base"
                onClick={() => handleRate(score)}
              >
                {score}
              </Button>
            ))}
          </div>
        </div>
      )}

      {timer.status === "finished" && !pendingRating && (
        <p className="text-base text-muted-foreground">
          Rated. Draw another topic whenever you&apos;re ready.
        </p>
      )}
    </section>
  );
}
