import { ResultBanner } from "./ResultBanner";
import { StatusPill } from "./StatusPill";
import type { GameUiState, ParityChoice, ResultVisualState } from "./types";
import { formatParity } from "./utils";

interface StageVisualProps {
  uiState: GameUiState;
  timerSeconds: number;
  selectedNumber: number;
  selectedParity: ParityChoice;
  result?: ResultVisualState;
}

export function StageVisual({
  uiState,
  timerSeconds,
  selectedNumber,
  selectedParity,
  result,
}: StageVisualProps) {
  switch (uiState) {
    case "waiting":
      return (
        <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="relative overflow-hidden rounded-[28px] border border-secondary/20 bg-gradient-to-br from-secondary/12 via-transparent to-primary/10 p-6">
            <div className="relative flex min-h-[232px] flex-col justify-between gap-8">
              <div className="flex items-center justify-between">
                <StatusPill label="Matchmaking" variant="active" />
                <span className="eyebrow">single room</span>
              </div>

              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="signal-stack">
                  <span className="signal-ring" />
                  <span className="signal-ring" />
                  <span className="signal-ring" />
                  <div className="signal-core">
                    <span className="eyebrow">slots</span>
                    <span className="font-display text-3xl text-white">1/2</span>
                  </div>
                </div>

                <div className="max-w-sm space-y-3">
                  <h3 className="font-display text-3xl text-white">Aguardando oponente</h3>
                  <p className="panel-copy">
                    O painel central fica vivo mesmo antes da partida, com sinalização clara de
                    lobby e bloqueio do CTA principal.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Estado</p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                O segundo slot aparece como vazio e o botão ready só acende quando houver 2/2.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Feedback</p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                Glow ciano e radar circular indicam espera ativa sem parecer uma tela parada.
              </p>
            </div>
          </div>
        </div>
      );
    case "ready":
      return (
        <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="relative overflow-hidden rounded-[28px] border border-accent/20 bg-gradient-to-br from-accent/10 via-transparent to-secondary/10 p-6">
            <div className="flex min-h-[232px] flex-col justify-between gap-8">
              <div className="flex items-center justify-between">
                <StatusPill label="Todos prontos" variant="success" />
                <span className="eyebrow">pre round</span>
              </div>

              <div className="flex flex-col items-center gap-6 lg:flex-row">
                <div className="signal-stack">
                  <span className="signal-ring" />
                  <span className="signal-ring" />
                  <div className="signal-core animate-float">
                    <span className="eyebrow">sync</span>
                    <span className="font-display text-3xl text-white">READY</span>
                  </div>
                </div>

                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <p className="eyebrow">Pilotos</p>
                    <p className="mt-3 font-display text-3xl text-white">2/2</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <p className="eyebrow">Sala</p>
                    <p className="mt-3 font-display text-3xl text-accent">LOCK</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <p className="eyebrow">Timer</p>
                    <p className="mt-3 font-display text-3xl text-secondary">ARMED</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Transição</p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                O layout mantém estabilidade e apenas reforça o estado de sincronização com verde
                neon e elementos em posição.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Leitura rápida</p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                Mesmo em mobile, o usuário entende que falta apenas o gatilho da rodada.
              </p>
            </div>
          </div>
        </div>
      );
    case "playing":
      return (
        <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="overflow-hidden rounded-[28px] border border-secondary/20 bg-gradient-to-br from-secondary/10 via-transparent to-primary/10 p-6">
            <div className="flex min-h-[232px] flex-col justify-between gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusPill
                  label={timerSeconds <= 3 ? "Janela crítica" : "Jogada em aberto"}
                  variant={timerSeconds <= 3 ? "danger" : "active"}
                />
                <StatusPill label={formatParity(selectedParity)} variant="default" />
              </div>

              <div className="grid gap-4 sm:grid-cols-[auto,1fr] sm:items-end">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-secondary/35 bg-secondary/15 font-display text-5xl text-white shadow-neon">
                  {selectedNumber}
                </div>
                <div className="grid gap-3">
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <p className="eyebrow">Soma prevista</p>
                    <p className="mt-3 font-display text-4xl text-white">{selectedNumber} + ?</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <p className="eyebrow">Pressão visual</p>
                    <p className="mt-3 text-sm leading-6 text-white/72">
                      Quando o timer cai para 3 segundos, o estado troca para vermelho e empurra
                      o foco para a confirmação.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Sua leitura</p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                Número grande, toggle lateral e CTA direto mantêm a tarefa principal visível em um
                único bloco.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Oponente</p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                O cartão lateral continua mostrando presença, mas sem revelar a jogada antes do
                resultado.
              </p>
            </div>
          </div>
        </div>
      );
    case "result":
      return result ? (
        <div className="grid gap-4">
          <ResultBanner result={result} playerParity={selectedParity} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Soma final</p>
              <p className="mt-3 font-display text-4xl text-white">{result.sum}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Paridade</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {formatParity(result.parity)}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Direção</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {result.outcome === "win"
                  ? "Vitória"
                  : result.outcome === "lose"
                    ? "Derrota"
                    : "Showcase"}
              </p>
            </div>
          </div>
        </div>
      ) : null;
    case "disconnected":
      return (
        <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[28px] border border-danger/30 bg-gradient-to-br from-danger/12 via-transparent to-transparent p-6">
            <div className="flex min-h-[232px] flex-col justify-between gap-6">
              <div className="flex items-center justify-between">
                <StatusPill label="Pausa forçada" variant="danger" />
                <span className="eyebrow">connection drop</span>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-danger/30 bg-danger/12 font-display text-3xl text-danger">
                  !
                </div>
                <div className="max-w-md">
                  <h3 className="font-display text-3xl text-white">Partida pausada</h3>
                  <p className="mt-3 text-sm leading-6 text-white/72">
                    O oponente saiu da sala no meio da rodada. O HUD reduz o brilho de jogo e
                    promove a camada de aviso.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Persistência local</p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                A jogada do jogador atual permanece visível para evitar sensação de perda.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Tom visual</p>
              <p className="mt-3 text-sm leading-6 text-white/72">
                O vermelho substitui o brilho ciano e deixa claro que não é mais um estado ativo
                de rodada.
              </p>
            </div>
          </div>
        </div>
      );
  }
}
