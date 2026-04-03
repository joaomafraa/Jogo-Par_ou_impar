export type GameUiState =
  | "waiting"
  | "ready"
  | "playing"
  | "result"
  | "disconnected";

export type ParityChoice = "odd" | "even";

export type ResultOutcome = "win" | "lose" | "draw";

export type UiVariant = "default" | "active" | "success" | "danger";

export type UiSize = "sm" | "md" | "lg";

export interface PlayerVisualState {
  name: string;
  connected: boolean;
  ready: boolean;
  selectedNumber?: number;
  selectedParity?: ParityChoice;
}

export interface ResultVisualState {
  sum: number;
  parity: ParityChoice;
  outcome: ResultOutcome;
}
