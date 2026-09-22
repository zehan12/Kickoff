"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  History,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Trophy,
} from "lucide-react";
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
import { playCue } from "@/lib/audio";
import type { Difficulty, Topic, TopicType } from "@/lib/types";
import { useCountdown } from "@/hooks/useCountdown";
import { usePracticeHistory } from "@/hooks/usePracticeHistory";
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
  const pool = useMemo(
    () =>
      difficulty === "all"
        ? topicBank
        : topicBank.filter((topic) => topic.difficulty === difficulty),
    [difficulty]
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-5 py-10 md:grid-cols-[minmax(0,1fr)_320px] md:px-8">
        {isClient ? (
          <PracticeSession
            key={difficulty}
            pool={pool}
            difficulty={difficulty}
            onDifficultyChange={(value) => setDifficulty(value)}
          />
        ) : (
          <section className="flex flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Drawing a topic…</p>
          </section>
        )}
        <HistoryPanel />
      </main>
    </div>
  );
}

function AppHeader() {
  const history = usePracticeHistory();
  return (
    <header className="flex items-center justify-between gap-4 border-b border-foreground/8 px-5 py-4 md:px-8">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-[oklch(0.78_0.08_70)] text-sm font-semibold text-[oklch(0.22_0.02_90)]">
          1m
        </span>
        <div>
          <p className="font-heading text-lg leading-none tracking-tight">
            Kickoff
          </p>
          <p className="text-xs text-muted-foreground">
            1-minute football speaking
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Trophy className="size-4" />
        <span>
          {history.average
            ? `Avg ${history.average.toFixed(1)} / 5`
            : "No ratings yet"}
        </span>
      </div>
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
  const { current, remainingCount, drawNext } = useTopicDeck(pool);
  const history = usePracticeHistory();
  const timer = useCountdown({
    duration: DURATION,
    onWarn: () => {
      void playCue("warn");
    },
    onComplete: () => {
      void playCue("end");
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

  function handleDrawAnother() {
    drawNext();
    timer.reset();
    setPendingRating(false);
    setRoundId(null);
  }

  function handleRate(rating: number) {
    if (!roundId) return;
    history.rateEntry(roundId, rating);
    setPendingRating(false);
  }

  return (
    <section className="flex flex-col items-center text-center">
      <p className="mb-4 max-w-md text-sm text-muted-foreground">
        Speak with no prep, or give yourself a short moment to think.
      </p>

      <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
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
        <>
          <p className="mb-3 text-[11px] font-semibold tracking-[0.22em] text-[oklch(0.78_0.08_70)] uppercase">
            Your topic
          </p>
          <div className="mb-4 flex items-center justify-center gap-2">
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
          <h1 className="font-heading max-w-3xl text-4xl leading-tight text-balance sm:text-5xl">
            {current.prompt}
          </h1>
          <p className="mt-4 max-w-lg text-sm text-muted-foreground">
            {typeCopy[current.type].hint}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">No topics in this filter.</p>
      )}

      <div className="mt-10">
        <TimerRing
          progress={timer.progress}
          secondsLeft={timer.secondsLeft}
          urgency={urgent}
        />
        <p className="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
          {timer.status === "idle" && "Ready when you are"}
          {timer.status === "running" &&
            (urgent ? "Ten seconds — wrap it up" : "Keep talking")}
          {timer.status === "paused" && "Paused"}
          {timer.status === "finished" && "Time"}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          className="h-11 rounded-full bg-[oklch(0.78_0.08_70)] px-5 text-[oklch(0.22_0.02_90)] hover:bg-[oklch(0.74_0.08_70)]"
          onClick={handleDrawAnother}
          disabled={!current}
        >
          <Shuffle data-icon="inline-start" />
          Draw another
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-11 rounded-full px-5"
          onClick={timer.toggle}
          disabled={!current || timer.status === "finished"}
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
        <div className="mt-8 rounded-2xl border border-foreground/10 bg-foreground/4 px-6 py-5">
          <p className="mb-3 text-sm font-medium">How did that round feel?</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <Button
                key={score}
                variant="outline"
                className="size-10 rounded-full"
                onClick={() => handleRate(score)}
              >
                {score}
              </Button>
            ))}
          </div>
        </div>
      )}

      {timer.status === "finished" && !pendingRating && (
        <p className="mt-6 text-sm text-muted-foreground">
          Rated. Draw another topic whenever you&apos;re ready.
        </p>
      )}
    </section>
  );
}

function HistoryPanel() {
  const history = usePracticeHistory();
  return (
    <aside>
      <Card className="bg-card/60">
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
        <CardContent className="max-h-[70vh] space-y-3 overflow-y-auto pb-4">
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
