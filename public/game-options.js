export const GAME_LENGTHS = [5, 10, 20, 30];
export function estimateMinutes(questions, players = 4) {
  return Math.round(questions * players * 0.7);
}
export function progressState(question, phase) {
  const completed =
    question.number - 1 + (["reveal", "story"].includes(phase) ? 1 : 0);
  return {
    completed,
    remaining: question.total - completed,
    total: question.total,
  };
}
