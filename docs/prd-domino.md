
📄 PRD TÉCNICO DEFINITIVO — ENGINE DE DOMINÓ (NÍVEL IMPLEMENTAÇÃO)

⸻

1) 🎯 OBJETIVO FORMAL

Implementar um sistema de dominó multiplayer em tempo real com:
	•	estado determinístico
	•	consistência absoluta entre clientes
	•	renderização baseada em cadeia
	•	ausência total de inconsistências de encaixe

⸻

2) 🧠 DEFINIÇÕES FORMAIS

2.1 Peça

type Piece = {
  id: string
  a: number // 0–6
  b: number // 0–6
}


⸻

2.2 Extremidade da mesa

type End = number


⸻

2.3 Estado da mesa

type Board = {
  chain: PlacedPiece[]
  leftValue: End
  rightValue: End
}


⸻

2.4 Peça posicionada

type PlacedPiece = {
  pieceId: string
  orientation: "normal" | "inverted"
}


⸻

3) ⚠️ INVARIANTES (NUNCA PODEM QUEBRAR)

Essas regras são obrigatórias em TODO momento:

I1

chain.length >= 1 ⇒ leftValue e rightValue definidos

I2

Para todo i:
chain[i] conecta corretamente com chain[i+1]

I3

Toda peça existe em apenas um lugar:
- mão OU
- mesa

I4

Nenhuma peça pode ser duplicada

I5

leftValue e rightValue refletem exatamente as pontas da cadeia


⸻

4) 🔥 FUNÇÃO CENTRAL (APPLY MOVE)

4.1 Assinatura

function applyMove(
  state: GameState,
  playerId: string,
  pieceId: string,
  side: "left" | "right"
): GameState


⸻

4.2 Algoritmo COMPLETO

1. validar turno
2. validar posse da peça
3. obter peça

4. se mesa vazia:
    - inserir peça
    - leftValue = piece.a
    - rightValue = piece.b
    - return

5. se lado == right:
    se piece.a == rightValue:
        orientation = normal
        newRight = piece.b
    senão se piece.b == rightValue:
        orientation = inverted
        newRight = piece.a
    senão:
        erro

    push peça
    rightValue = newRight

6. se lado == left:
    se piece.b == leftValue:
        orientation = normal
        newLeft = piece.a
    senão se piece.a == leftValue:
        orientation = inverted
        newLeft = piece.b
    senão:
        erro

    unshift peça
    leftValue = newLeft

7. remover peça da mão

8. avançar turno

9. retornar novo estado


⸻

5) 🧱 LAYOUT ENGINE (ALGORITMO COMPLETO)

5.1 Entrada

PlacedPiece[]


⸻

5.2 Saída

RenderPiece[]

type RenderPiece = {
  x: number
  y: number
  rotation: number
}


⸻

5.3 Parâmetros fixos

PIECE_WIDTH = 60
PIECE_HEIGHT = 120
GAP = 4


⸻

5.4 Cursor inicial

cursor = {
  x: centerX,
  y: centerY,
  direction: "right"
}


⸻

5.5 Função de avanço

function advance(cursor):
  switch(direction):
    right → x += width + gap
    left → x -= width + gap
    down → y += height + gap
    up → y -= height + gap


⸻

5.6 Detecção de limite

function willOverflow(cursor, bounds):
  return cursor.x fora OU cursor.y fora


⸻

5.7 Mudança de direção

function rotateDirection(dir):
  right → down
  down → left
  left → up
  up → right


⸻

5.8 Algoritmo principal

for each piece in chain:

  if willOverflow(nextPosition):
      direction = rotateDirection(direction)

  posicionar peça:
    x = cursor.x
    y = cursor.y
    rotation = mapDirection(direction)

  advance(cursor)


⸻

5.9 Regra de peça dupla

if piece.a == piece.b:
  rotation += 90


⸻

6) 🎬 ANIMAÇÃO (PIPELINE EXATO)

6.1 Detecção de mudança

diff = oldState.chain vs newState.chain


⸻

6.2 Nova peça

nova peça = último elemento adicionado


⸻

6.3 Origem

from = posição da mão do jogador


⸻

6.4 Destino

to = posição calculada no layout


⸻

6.5 Execução

transform: translate + rotate
duration: 250ms
easing: ease-out


⸻

7) 🌐 MULTIPLAYER (PROTOCOLO EXATO)

7.1 Cliente envia

{
  "type": "PLAY_MOVE",
  "pieceId": "...",
  "side": "right"
}


⸻

7.2 Servidor

try:
  newState = applyMove(...)
  broadcast(newState)
catch:
  ignore


⸻

7.3 Cliente recebe

render(newState)
animate(diff)


⸻

8) ⚠️ EDGE CASES (OBRIGATÓRIOS)

E1 — peça inválida

→ rejeitar silenciosamente

⸻

E2 — duas jogadas simultâneas

→ aceitar apenas primeira

⸻

E3 — reconexão

→ enviar estado completo

⸻

E4 — cadeia longa

→ layout deve continuar funcionando

⸻

9) 🧪 TESTES OBRIGATÓRIOS

Engine
	•	1000 jogadas random
	•	validação de invariantes

Layout
	•	100 peças
	•	múltiplas curvas

Multiplayer
	•	latência simulada
	•	reorder de mensagens

⸻

10) 🚀 ORDEM DE IMPLEMENTAÇÃO

1. Engine pura
2. Testes
3. Layout
4. Render
5. Animação
6. Multiplayer


⸻
