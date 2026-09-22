export type Difficulty = "easy" | "medium" | "hard";
export type TopicType = "explainer" | "debate" | "trivia";

export type Topic = {
  id: string;
  difficulty: Difficulty;
  type: TopicType;
  prompt: string;
};

export type HistoryEntry = {
  id: string;
  topicId: string;
  prompt: string;
  type: TopicType;
  difficulty: Difficulty;
  startedAt: string;
  rating?: number;
};
