"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  History,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
type MobilePane = "practice" | "history";

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

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

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
  const [mobilePane, setMobilePane] = useState<MobilePane>("practice");
  const pool = useMemo(
    () =>
      difficulty === "all"
        ? topicBank
        : topicBank.filter((topic) => topic.difficulty === difficulty),
    [difficulty]
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader
        mobilePane={mobilePane}
        onToggleMobilePane={() =>
          setMobilePane((pane) =>
            pane === "practice" ? "history" : "practice"
          )
        }
      />
      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-4 px-4 py-3 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-6 md:px-8 md:py-5">
        {isClient ? (
          <PracticeSession
            key={difficulty}
            pool={pool}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            className={mobilePane === "history" ? "hidden md:flex" : "flex"}
          />
        ) : (
          <section className="grid min-h-0 place-items-center">
            <p className="text-sm text-muted-foreground">Drawing a topic…</p>
          </section>
        )}
        <HistoryPanel
          className={mobilePane === "practice" ? "hidden md:flex" : "flex"}
        />
      </main>
    </div>
  );
}

function AppHeader({
  mobilePane,
  onToggleMobilePane,
}: {
  mobilePane: MobilePane;
  onToggleMobilePane: () => void;
}) {
  const history = usePracticeHistory();
  const { muted, toggleMuted } = useSound();
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-foreground/8 px-4 py-3 md:px-8">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-[oklch(0.78_0.08_70)] text-sm font-semibold text-[oklch(0.22_0.02_90)]">
          1m
        </span>
        <div>
          <p className="font-heading text-lg leading-none tracking-tight">
            Kickoff
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            1-minute football speaking
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Trophy className="hidden size-4 sm:block" />
        <span className="mr-1 hidden sm:inline">
          {history.average
            ? `Avg ${history.average.toFixed(1)} / 5`
            : "No ratings yet"}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full md:hidden"
          aria-label={
            mobilePane === "practice" ? "Show topic history" : "Back to practice"
          }
          aria-pressed={mobilePane === "history"}
          onClick={onToggleMobilePane}
        >
          <History />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label={muted ? "Unmute timer sounds" : "Mute timer sounds"}
          aria-pressed={!muted}
          onClick={toggleMuted}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </div>
    </header>
  );
}

function PracticeSession({
  pool,
  difficulty,
  onDifficultyChange,
  className,
}: {
  pool: Topic[];
  difficulty: DifficultyFilter;
  onDifficultyChange: (value: DifficultyFilter) => void;
  className?: string;
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
    <section
      className={cn(
        "min-h-0 flex-col items-center justify-center gap-[clamp(0.5rem,1.6vh,1.25rem)] overflow-y-auto text-center",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Select
          value={difficulty}
          onValueChange={(value) => {
            if (!value) return;
            onDifficultyChange(value as DifficultyFilter);
          }}
        >
          <SelectTrigger className="min-w-40 rounded-full border-foreground/15 bg-foreground/5 px-4">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="all">All difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {remainingCount} left in this shuffle
        </p>
      </div>

      {current ? (
        <div className="flex flex-col items-center gap-[clamp(0.35rem,1vh,0.75rem)]">
          <div className="flex items-center justify-center gap-2">
            <Badge
              variant={current.type === "debate" ? "default" : "outline"}
              className={
                current.type === "debate"
                  ? "border-transparent bg-[oklch(0.78_0.08_70)] text-[oklch(0.22_0.02_90)]"
                  : ""
              }
            >
              {typeCopy[current.type].label}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {current.difficulty}
            </Badge>
          </div>
          <h1 className="font-heading max-w-3xl text-[clamp(1.5rem,4.4vh,2.75rem)] leading-tight text-balance">
            {displayedPrompt}
          </h1>
          <p className="hidden max-w-lg text-sm text-muted-foreground sm:block">
            {typeCopy[current.type].hint}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground">No topics in this filter.</p>
      )}

      <div className="flex flex-col items-center gap-1">
        <TimerRing
          progress={timer.progress}
          secondsLeft={timer.secondsLeft}
          urgency={urgent}
        />
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {timer.status === "idle" && "Ready when you are"}
          {timer.status === "running" &&
            (urgent ? "Ten seconds — wrap it up" : "Keep talking")}
          {timer.status === "paused" && "Paused"}
          {timer.status === "finished" && "Time"}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          size="lg"
          className="h-11 rounded-full bg-[oklch(0.78_0.08_70)] px-5 text-[oklch(0.22_0.02_90)] hover:bg-[oklch(0.74_0.08_70)]"
          onClick={handleDrawAnother}
          disabled={!current || spinning}
        >
          <Shuffle data-icon="inline-start" />
          Draw another
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-11 rounded-full px-5"
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
          className="h-11 rounded-full px-4"
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
        <div className="flex items-center gap-3 rounded-full border border-foreground/10 bg-foreground/4 px-4 py-2">
          <p className="text-sm font-medium">How did that round feel?</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((score) => (
              <Button
                key={score}
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                onClick={() => handleRate(score)}
              >
                {score}
              </Button>
            ))}
          </div>
        </div>
      )}

      {timer.status === "finished" && !pendingRating && (
        <p className="text-sm text-muted-foreground">
          Rated. Draw another topic whenever you&apos;re ready.
        </p>
      )}
    </section>
  );
}

function HistoryPanel({ className }: { className?: string }) {
  const history = usePracticeHistory();
  return (
    <aside className={cn("min-h-0 flex-col", className)}>
      <Card className="flex min-h-0 flex-1 flex-col bg-card/60">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="size-4" />
            Topic history
          </CardTitle>
          {history.entries.length > 0 && (
            <Button variant="ghost" size="xs" onClick={history.clear}>
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
          {history.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Finished rounds land here with a timestamp. Ratings stick in this
              browser.
            </p>
          ) : (
            history.entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-foreground/8 bg-background/40 p-3 text-left"
              >
                <p className="text-sm leading-snug">{entry.prompt}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatWhen(entry.startedAt)}</span>
                  <span className="capitalize">{entry.type}</span>
                  {typeof entry.rating === "number" && (
                    <span>{entry.rating}/5</span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
