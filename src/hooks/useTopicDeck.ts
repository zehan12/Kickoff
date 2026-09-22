"use client";

import { useCallback, useState } from "react";
import { shuffle } from "@/lib/shuffle";
import type { Topic } from "@/lib/types";

type Deck = {
  current: Topic | null;
  remaining: Topic[];
};

export function useTopicDeck(pool: Topic[]) {
  const [deck, setDeck] = useState<Deck>(() => {
    const shuffled = shuffle(pool);
    return {
      current: shuffled[0] ?? null,
      remaining: shuffled.slice(1),
    };
  });

  const drawNext = useCallback(() => {
    if (pool.length === 0) return;

    setDeck((prev) => {
      let nextQueue = prev.remaining;
      if (nextQueue.length === 0) {
        nextQueue = shuffle(pool);
        if (
          prev.current &&
          nextQueue.length > 1 &&
          nextQueue[0].id === prev.current.id
        ) {
          const swap = nextQueue.findIndex(
            (topic) => topic.id !== prev.current?.id
          );
          if (swap > 0) {
            [nextQueue[0], nextQueue[swap]] = [nextQueue[swap], nextQueue[0]];
          }
        }
      }
      const [next, ...rest] = nextQueue;
      return { current: next ?? prev.current, remaining: rest };
    });
  }, [pool]);

  return {
    current: deck.current,
    remainingCount: deck.remaining.length,
    drawNext,
  };
}
