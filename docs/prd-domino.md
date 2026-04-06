
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

MOVIMENTO DAS PEÇAS + MESA


Perfeito — agora você chegou na parte mais crítica do visual:
👉 movimentação das peças + comportamento dinâmico da mesa (layout vivo)

Isso aqui é literalmente o que faz o jogo parecer igual ao Dominoes 365 ou parecer “bugado”.

Vou te entregar um PRD técnico específico só dessa parte, no nível que o Codex consegue implementar sem inventar.

⸻

📄 PRD TÉCNICO — MOVIMENTAÇÃO DAS PEÇAS E COMPORTAMENTO DA MESA

⸻

1) 🎯 OBJETIVO

Definir:
	•	como as peças se movem
	•	como a mesa cresce
	•	como evitar sair da tela
	•	como manter aparência natural (vida real)
	•	como sincronizar animação com estado

👉 Resultado esperado: comportamento idêntico ao Dominoes 365

⸻

2) 🧠 PRINCÍPIOS FUNDAMENTAIS

P1 — A mesa é viva (dinâmica)
	•	não é fixa
	•	recalcula layout sempre que muda

⸻

P2 — Layout é derivado do estado
	•	posição NUNCA é salva
	•	sempre recalculada

⸻

P3 — Movimento = interpolação entre estados

estado antigo → estado novo → animação


⸻

P4 — Continuidade visual obrigatória
	•	peças sempre conectadas
	•	sem espaços quebrados
	•	sem sobreposição

⸻

3) 🧱 MODELO DE MOVIMENTAÇÃO

3.1 Pipeline completo

1. estado muda (nova peça)
2. recalcular layout completo
3. comparar com layout anterior
4. animar diferenças


⸻

3.2 Estrutura base

type RenderPiece = {
  id: string
  x: number
  y: number
  rotation: number
}


⸻

4) 📐 SISTEMA DE LAYOUT DA MESA (CORE)

4.1 Conceito (EXATO DO DOMINO 365)

A mesa cresce como uma cobra (snake layout):

→ → → ↓ ← ← ← ↑ → →


⸻

4.2 Separação da cadeia
	•	índice 0 = centro
	•	direita cresce pra frente
	•	esquerda cresce pra trás

⸻

4.3 Inicialização

centerX = largura / 2
centerY = altura / 2


⸻

4.4 Dois cursores independentes

leftCursor
rightCursor

Cada lado cresce separadamente

⸻

5) 🔄 ALGORITMO DE POSICIONAMENTO

5.1 Passo a passo

Para cada lado:

cursor = posição inicial
direction = "right" (ou "left")

for cada peça:

  if vai sair da tela:
    direction = rotacionar(direction)

  posicionar peça

  avançar cursor


⸻

5.2 Rotação de direção

Direita:

right → down → left → up → right

Esquerda:

left → up → right → down → left


⸻

5.3 Avanço do cursor

switch(direction):
  right → x += largura
  left → x -= largura
  down → y += altura
  up → y -= altura


⸻

5.4 Rotação visual

right → 0°
down → 90°
left → 180°
up → 270°


⸻

6) ⚠️ CONTROLE DE LIMITE (ANTI-BUG CRÍTICO)

6.1 Bounding box da mesa

bounds = {
  minX,
  maxX,
  minY,
  maxY
}


⸻

6.2 Verificação

function willOverflow(nextX, nextY):
  return fora dos bounds


⸻

6.3 Regra

if overflow:
  mudar direção antes de posicionar


⸻

7) 🧩 COMPORTAMENTO DAS PEÇAS

7.1 Encaixe visual
	•	lado conectado sempre encosta perfeitamente
	•	sem gap visível

⸻

7.2 Peças normais
	•	seguem direção da mesa

⸻

7.3 Peças duplas (CRÍTICO)

if a == b:
  rotation += 90°

👉 sempre perpendicular

⸻

7.4 Continuidade

Cada peça:

deve alinhar exatamente com a anterior


⸻

8) 🎬 SISTEMA DE ANIMAÇÃO (MOVIMENTO REAL)

8.1 Regra principal

animação NÃO altera estado


⸻

8.2 Detecção de mudança

diff = comparar posições antigas vs novas


⸻

8.3 Tipos de movimento

1. Nova peça
	•	sai da mão
	•	vai até mesa

⸻

2. Reflow da mesa (CRÍTICO)

Quando a mesa cresce:

👉 TODAS as peças podem se mover levemente

Isso é EXATAMENTE o que o Domino 365 faz

⸻

8.4 Interpolação

for cada peça:
  animar de posição antiga → nova


⸻

8.5 Propriedades

transform: translate(x, y) rotate()


⸻

8.6 Tempo
	•	200–300ms
	•	easing suave

⸻

8.7 Ordem de animação
	1.	nova peça entra
	2.	mesa ajusta (reflow)

⸻

9) 🧠 REFLOW DA MESA (SEGREDO DO 365)

9.1 O que é

Quando uma nova peça entra:

👉 a mesa inteira pode “respirar” e ajustar posição

⸻

9.2 Regra
	•	recalcular layout completo
	•	animar TODAS as peças

⸻

9.3 Benefício
	•	evita sair da tela
	•	mantém centralizado
	•	deixa natural

⸻

10) 🎯 CENTRALIZAÇÃO DINÂMICA

10.1 Problema

Mesa cresce para um lado → fica torta

⸻

10.2 Solução

Após layout:

calcular bounding da cadeia
centralizar no viewport


⸻

10.3 Aplicação

offsetX = center - bounding.centerX
offsetY = center - bounding.centerY

Aplicar em TODAS as peças

⸻

11) ⚠️ ERROS CRÍTICOS (PROIBIDOS)

❌ posicionar peça incremental sem recalcular tudo
❌ não tratar overflow
❌ não animar reflow
❌ não separar esquerda/direita
❌ não rotacionar peças
❌ usar posição fixa

⸻

12) 🧪 TESTES OBRIGATÓRIOS
	•	50 peças na mesa
	•	múltiplas curvas
	•	crescimento dos dois lados
	•	peças duplas em curvas
	•	tela pequena (mobile)

⸻

13) 🚀 ORDEM DE IMPLEMENTAÇÃO

1. layout engine puro
2. teste com 100 peças
3. adicionar render
4. adicionar animação
5. adicionar reflow
6. integrar com engine


⸻

🧠 RESUMO FINAL (ESSÊNCIA DO DOMINO 365)

O que faz parecer profissional:

👉 layout dinâmico
👉 peças sempre conectadas
👉 reflow suave
👉 centralização constante
👉 animação leve

⸻

DESIGN DAS PEÇAS 

Perfeito — agora você está atacando o último ponto crítico que destrói a qualidade do jogo:
👉 design das peças (pip layout) + consistência visual perfeita

Vou te entregar um PRD técnico COMPLETO só de:
	•	🎬 movimentação da mesa (nível Domino 365)
	•	🧱 layout dinâmico
	•	🎨 design das peças (100% correto, sem erro de pontinhos)

Isso aqui é o que faz o jogo deixar de parecer “projeto de faculdade” e virar produto real.

⸻

📄 PRD TÉCNICO — MOVIMENTAÇÃO + DESIGN DAS PEÇAS (NÍVEL PROFISSIONAL)

⸻

1) 🎯 OBJETIVO

Garantir:
	•	mesa dinâmica e fluida (igual Domino 365)
	•	peças sempre bem posicionadas
	•	animação natural
	•	padrão visual real de dominó (pip layout correto)

⸻

2) 🧠 PRINCÍPIOS FUNDAMENTAIS

P1 — Layout sempre recalculado

Nunca armazenar posição fixa

⸻

P2 — Peça é vetor (não imagem)

Peça deve ser desenhada via código (SVG ou CSS)

⸻

P3 — Pip layout segue padrão mundial

Se errar isso → jogo parece falso

⸻

P4 — Animação baseada em diff

Nunca mover direto sem interpolação

⸻

3) 🧱 DESIGN DAS PEÇAS (CRÍTICO)

⸻

3.1 Estrutura visual da peça

Cada peça é composta por:

{
  container
  ladoA
  divisor
  ladoB
}


⸻

3.2 Proporção da peça

WIDTH = 60px
HEIGHT = 120px
RATIO = 1:2


⸻

3.3 Estilo base
	•	fundo: branco (#fff)
	•	borda: leve (#ccc)
	•	borda-radius: 8px
	•	divisor: linha central

⸻

3.4 Grid interno (ESSENCIAL)

Cada lado da peça é um grid 3x3

[1][2][3]
[4][5][6]
[7][8][9]


⸻

4) 🎯 POSICIONAMENTO DOS PONTOS (PIP SYSTEM)

⸻

4.1 Coordenadas padrão

Posição	Grid
topo-esq	1
topo-dir	3
meio-esq	4
centro	5
meio-dir	6
baixo-esq	7
baixo-dir	9


⸻

4.2 Definição EXATA dos valores

0
	•	nenhum ponto

⸻

1
	•	centro (5)

⸻

2
	•	topo-esq (1)
	•	baixo-dir (9)

⸻

3
	•	topo-esq (1)
	•	centro (5)
	•	baixo-dir (9)

⸻

4
	•	4 cantos:
	•	1, 3, 7, 9

⸻

5
	•	4 cantos + centro:
	•	1, 3, 5, 7, 9

⸻

6
	•	colunas laterais:
	•	1, 4, 7
	•	3, 6, 9

⸻

👉 ISSO É PADRÃO REAL DE DOMINÓ
👉 se errar isso, fica estranho (foi teu bug)

⸻

4.3 Tamanho dos pontos

DOT_SIZE = 6px a 8px

	•	cor: preto (#000)
	•	shape: círculo

⸻

4.4 Alinhamento
	•	centralizado no grid
	•	spacing uniforme
	•	nunca usar posição “manual”

⸻

5) 🧱 IMPLEMENTAÇÃO (RECOMENDADA)

5.1 Estrutura CSS Grid

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}


⸻

5.2 Renderização

function renderPips(value):
  return posições[value]


⸻

5.3 Evitar erro comum

❌ usar imagem pronta
❌ usar posição absoluta manual

⸻

6) 🔄 MOVIMENTAÇÃO DA MESA (ESTILO DOMINO 365)

⸻

6.1 Layout tipo “snake”

→ → → ↓ ← ← ← ↑ → →


⸻

6.2 Dois lados independentes
	•	esquerda
	•	direita

⸻

6.3 Reflow obrigatório

Sempre que uma peça entra:

👉 TODA a mesa recalcula

⸻

6.4 Centralização dinâmica

offset = centro da tela - centro da mesa

Aplicar em todas as peças

⸻

7) 🎬 ANIMAÇÃO

⸻

7.1 Tipos

A) Nova peça
	•	sai da mão → mesa

⸻

B) Reflow
	•	todas as peças ajustam posição

⸻

7.2 Pipeline

estado novo → layout novo → diff → animar


⸻

7.3 Propriedades

transform: translate + rotate


⸻

7.4 Tempo
	•	200–300ms
	•	easing suave

⸻

8) 🔁 ROTAÇÃO DAS PEÇAS

⸻

8.1 Baseado na direção

Direção	Rotação
direita	0°
baixo	90°
esquerda	180°
cima	270°


⸻

8.2 Peças duplas

if (a == b):
  rotation += 90°


⸻

9) ⚠️ ERROS QUE VOCÊ TEVE (E COMO EVITAR)

⸻

❌ Pontinhos errados

✔️ usar grid 3x3 fixo

⸻

❌ Peça feia

✔️ usar proporção correta

⸻

❌ desalinhamento

✔️ nunca usar position manual

⸻

❌ mesa quebrando

✔️ usar layout snake + bounds

⸻

❌ peça girando errado

✔️ separar orientação lógica e visual

⸻

10) 🧪 TESTES VISUAIS
	•	todas as peças (0–6)
	•	todas rotações
	•	sequência longa
	•	tela pequena
	•	peças duplas em curva

⸻

🧠 RESUMO FINAL

Se você seguir isso:

✅ pontinhos PERFEITOS
✅ peças com aparência real
✅ mesa fluida
✅ animação profissional
✅ nível Domino 365

⸻

🔥 RECOMENDAÇÃO FINAL

Agora sim você tem:
	•	engine ✔️
	•	movimentação ✔️
	•	design ✔️

DESIGN PEÇAS


Perfeito — agora sim você pediu o nível engenharia + design system completo.
Vou te entregar um documento que o Codex consegue seguir sem inventar nada, incluindo:
	•	mecânica de movimentação (igual Domino 365)
	•	comportamento da mesa
	•	DESENHO EXATO das peças (com grid, coordenadas, SVG/CSS)
	•	exemplo real de implementação

⸻

📄 PRD TÉCNICO DEFINITIVO — MESA + MOVIMENTAÇÃO + DESIGN DAS PEÇAS

⸻

1) 🎯 OBJETIVO

Implementar:
	1.	sistema de layout dinâmico da mesa (snake layout)
	2.	movimentação suave e consistente
	3.	renderização vetorial das peças
	4.	padrão visual real de dominó (igual Dominoes365)

⸻

2) 🧠 PRINCÍPIOS INEGOCIÁVEIS

P1 — Layout sempre recalculado

posição = função(chain)


⸻

P2 — Peças são vetoriais (SVG/CSS)

❌ proibido usar PNG/JPG

⸻

P3 — Pip layout padronizado mundialmente

❌ não inventar posições

⸻

P4 — Separação total
	•	lógica → engine
	•	visual → renderer

⸻

3) 🧱 DESIGN DAS PEÇAS (ESPECIFICAÇÃO EXATA)

⸻

3.1 Dimensões

WIDTH = 64px
HEIGHT = 128px
BORDER_RADIUS = 10px


⸻

3.2 Estrutura da peça

┌──────────────┐
│   lado A     │
│              │
├──── divider ─┤
│   lado B     │
│              │
└──────────────┘


⸻

3.3 Estilo visual (igual Domino 365)

background: #ffffff;
border: 2px solid #e5e5e5;
border-radius: 10px;
box-shadow: 0 2px 4px rgba(0,0,0,0.1);


⸻

3.4 Divisor central

height: 2px;
background: #ddd;


⸻

4) 🎯 SISTEMA DE PONTOS (PIPS) — ESPECIFICAÇÃO MATEMÁTICA

⸻

4.1 Grid lógico 3x3

Cada metade da peça usa:

[0][1][2]
[3][4][5]
[6][7][8]


⸻

4.2 Coordenadas reais (percentual)

positions = {
  0: (25%, 25%)
  1: (50%, 25%)
  2: (75%, 25%)

  3: (25%, 50%)
  4: (50%, 50%)
  5: (75%, 50%)

  6: (25%, 75%)
  7: (50%, 75%)
  8: (75%, 75%)
}


⸻

4.3 Definição EXATA dos valores

PIPS = {
  0: [],

  1: [4],

  2: [0, 8],

  3: [0, 4, 8],

  4: [0, 2, 6, 8],

  5: [0, 2, 4, 6, 8],

  6: [0, 2, 3, 5, 6, 8]
}


⸻

4.4 Tamanho do ponto

DOT_RADIUS = 6px


⸻

4.5 Regra de renderização

Para cada valor:

renderDots(value):
  for cada posição em PIPS[value]:
    desenhar círculo


⸻

5) 🧱 EXEMPLO REAL (SVG IMPLEMENTAÇÃO)

👉 ISSO É O QUE O CODEX PRECISA

<svg width="64" height="128" viewBox="0 0 64 128">
  <!-- fundo -->
  <rect x="0" y="0" width="64" height="128" rx="10" fill="#fff" stroke="#ddd"/>

  <!-- divisor -->
  <line x1="0" y1="64" x2="64" y2="64" stroke="#ddd" stroke-width="2"/>

  <!-- lado A (valor 3) -->
  <circle cx="16" cy="16" r="5" fill="black"/>
  <circle cx="32" cy="32" r="5" fill="black"/>
  <circle cx="48" cy="48" r="5" fill="black"/>

  <!-- lado B (valor 5) -->
  <circle cx="16" cy="80" r="5" fill="black"/>
  <circle cx="48" cy="80" r="5" fill="black"/>
  <circle cx="32" cy="96" r="5" fill="black"/>
  <circle cx="16" cy="112" r="5" fill="black"/>
  <circle cx="48" cy="112" r="5" fill="black"/>
</svg>


⸻

6) 🔄 MOVIMENTAÇÃO DA MESA (DOMINO 365)

⸻

6.1 Estrutura
	•	cadeia linear
	•	cresce para ambos lados

⸻

6.2 Caminho

→ → → ↓ ← ← ← ↑


⸻

6.3 Cursor

cursor = {
  x,
  y,
  direction
}


⸻

6.4 Avanço

RIGHT → x += WIDTH
LEFT → x -= WIDTH
DOWN → y += HEIGHT/2
UP → y -= HEIGHT/2


⸻

6.5 Rotação

RIGHT → 0°
DOWN → 90°
LEFT → 180°
UP → 270°


⸻

7) 🎬 SISTEMA DE MOVIMENTO

⸻

7.1 Pipeline

estado antigo
→ novo estado
→ recalcular layout
→ animar diferenças


⸻

7.2 Nova peça

from = posição da mão
to = posição calculada


⸻

7.3 Reflow (IGUAL DOMINO 365)

👉 TODAS as peças se movem levemente

⸻

7.4 CSS correto

transform: translate(x, y) rotate(deg);
transition: transform 250ms ease-out;


⸻

8) 🧠 CENTRALIZAÇÃO DINÂMICA

⸻

8.1 Bounding box

minX, maxX, minY, maxY


⸻

8.2 Offset

offsetX = centerX - (minX + maxX)/2
offsetY = centerY - (minY + maxY)/2


⸻

8.3 Aplicação

todas as peças += offset


⸻

9) ⚠️ ERROS PROIBIDOS

⸻

❌ usar imagem de peça
❌ posicionar manualmente pontos
❌ não usar grid 3x3
❌ não recalcular layout
❌ não animar reflow
❌ não centralizar

⸻

10) 🧪 TESTES OBRIGATÓRIOS
	•	todas peças 0–6
	•	todas rotações
	•	sequência longa
	•	múltiplas curvas
	•	tela pequena

⸻

🧠 CONCLUSÃO

Agora você tem:

✅ design PERFEITO das peças
✅ pip layout correto
✅ mesa estilo Domino 365
✅ movimento natural
✅ especificação que IA consegue seguir

⸻

 📄 PRD TÉCNICO DEFINITIVO — MOTOR DE REGRAS E MÁQUINA DE ESTADOS (DOMINÓ 2v2)

⸻

## 1) 🎯 OBJETIVO FORMAL E ESCOPO

Implementar o núcleo lógico (`GameManager` / `State Reducer`) de um jogo de dominó multiplayer 2v2 (Duplas). O escopo exige:
1. Controle de fluxo e turnos baseados em parceiros sentados frente a frente.
2. Tratamento matemático de pontuação com regras brasileiras avançadas: Batida Simples, Carroça, Lá-e-lô e Cruzada.
3. Resolução de exceções de mão na distribuição (4, 5 ou 6 carroças).
4. Cálculo individual (por jogador) de pips para resolução de Jogo Trancado (Fechado).
5. Gerenciamento do "Dorme" (4 peças sobressalentes, com controle de visibilidade estrito).
6. A partida não tem "teto cravado" de 6 pontos; ganha quem atingir `>= 6` pontos.

⸻

## 2) 🧠 ESTRUTURA GLOBAL DE ESTADO (STATE TYPES)

O motor deve ser puramente funcional e derivar do seguinte estado (Tipagem TypeScript estrita):

```typescript
type Team = "TEAM_A" | "TEAM_B";
type PlayerId = string;

type Piece = {
  id: string;
  a: number; // 0-6
  b: number; // 0-6
}

type Player = {
  id: PlayerId;
  team: Team;
  hand: Piece[];
  position: 0 | 1 | 2 | 3; // Parceiros sentam frente a frente: A(0), B(1), A(2), B(3)
}

type DormeState = {
  pieces: Piece[]; // SEMPRE contém exatamente 4 peças
  isVisible: boolean; // false = viradas para baixo; true = 4 carroças expostas para todos verem
}

type GameState = {
  status: "DEALING" | "PLAYING" | "FINISHED_ROUND" | "FINISHED_MATCH";
  players: Player[];
  dorme: DormeState;
  board: {
    chain: any[]; // (Gerenciado pela Engine Visual do PRD anterior)
    leftValue: number | null;
    rightValue: number | null;
  };
  turnIndex: number; // Quem joga agora (0 a 3)
  
  scores: {
    TEAM_A: number; // Vence o Match quem atingir >= 6
    TEAM_B: number;
  };
  
  matchConfig: {
    targetScore: number; // Padrão: 6
    tieMultiplier: number; // Multiplicador de pontos da rodada (1 normal, 2 ou mais se houve empates anteriores)
    forceStarterPiece: Piece | null; // Se for a primeira rodada ou pós-empate, [6|6] começa
  };
}
```

⸻

## 3) 🎲 DISTRIBUIÇÃO (DEALING) E ÁREA DO "DORME"

### 3.1 Regra de Distribuição Matemática
1. Instanciar as 28 peças do jogo (`[0|0]` a `[6|6]`).
2. Embaralhar usando algoritmo seguro (Fisher-Yates).
3. Distribuir exatamente **6 peças** para `Player[0]`, `Player[1]`, `Player[2]` e `Player[3]`.
4. As **4 peças restantes** vão obrigatoriamente para `gameState.dorme.pieces`.
5. `gameState.dorme.isVisible` é setado para `false`.

### 3.2 Validador de Exceções de Mão (CRÍTICO)
Antes de liberar o `turnIndex` 1, o motor deve varrer a mão de cada jogador.

```typescript
function validateStartingHands(state: GameState): "CONTINUE" | "RESHUFFLE" | "INSTANT_WIN" {
  for (let player of state.players) {
    const doubles = player.hand.filter(p => p.a === p.b);
    const count = doubles.length;

    // REGRA DE 4 CARROÇAS: O jogador é forçado a pegar o dorme
    if (count === 4) {
      const oldDorme = [...state.dorme.pieces];
      
      // As 4 carroças vão para o dorme e ficam visíveis
      state.dorme.pieces = [...doubles];
      state.dorme.isVisible = true; 
      
      // Retira as carroças da mão e injeta o dorme antigo
      player.hand = player.hand.filter(p => p.a !== p.b);
      player.hand.push(...oldDorme);
      
      return "CONTINUE"; 
    }
    
    // REGRA DE 5 CARROÇAS: Jogo anulado, re-embaralha
    if (count === 5) {
      return "RESHUFFLE";
    }
    
    // REGRA DE 6 CARROÇAS: Vitória instantânea (Batida Simples)
    if (count === 6) {
      awardPoints(state, player.team, 1 * state.matchConfig.tieMultiplier);
      return "INSTANT_WIN";
    }
  }
  return "CONTINUE";
}
```

⸻

## 4) 🚀 REGRA DE INÍCIO E CONTROLE DE TURNOS

### 4.1 Quem começa?
*   **Primeira rodada do Match OU após um jogo trancado que empatou:** O jogador que tiver o `[6|6]` (Dozão) em sua mão começa obrigatoriamente. O motor não deve permitir que ele jogue outra peça em seu primeiro turno.
*   **Rodadas normais:** Começa o jogador da dupla que venceu a rodada anterior. (A dupla escolhe quem sai, ou adota-se a regra de rodízio: "o parceiro à direita do último que bateu começa").

### 4.2 Skip de Turno Automático
Se chegar a vez do `Player[i]` e ele não possuir nenhuma peça na mão que combine com `leftValue` ou `rightValue`, o motor deve pular automaticamente o turno (`turnIndex = (turnIndex + 1) % 4`), emitindo um evento `PLAYER_PASSED`.

⸻

## 5) 🏆 MÁQUINA DE PONTUAÇÃO (CÁLCULO DE BATIDA)

Um jogador "Bate" (vence a rodada) no momento exato em que seu array de mão fica vazio (`hand.length === 0`). O motor precisa inspecionar a peça que causou a vitória e o estado da mesa antes do encaixe.

### 5.1 Algoritmo Exato (Lá-e-Lô e Cruzada)
Atenção Codex: Não trate pontuação com `if/else` solto. Use esta lógica matemática estrita:

```typescript
function calculateWinScore(playedPiece: Piece, stateBeforePlay: GameState): number {
  const isDouble = (playedPiece.a === playedPiece.b);
  const leftValue = stateBeforePlay.board.leftValue;
  const rightValue = stateBeforePlay.board.rightValue;
  
  // Verifica se a peça é útil SIMULTANEAMENTE nos dois lados da mesa
  const fitsLeft = (playedPiece.a === leftValue || playedPiece.b === leftValue);
  const fitsRight = (playedPiece.a === rightValue || playedPiece.b === rightValue);
  
  const matchesBothEnds = fitsLeft && fitsRight;

  if (matchesBothEnds) {
    if (isDouble) {
      return 4; // BATIDA CRUZADA: Carroça fechando os dois lados
    } else {
      return 3; // BATIDA LÁ-E-LÔ: Peça comum fechando os dois lados
    }
  } else {
    if (isDouble) {
      return 2; // BATIDA DE CARROÇA (Em apenas um lado)
    } else {
      return 1; // BATIDA SIMPLES
    }
  }
}
```

⸻

## 6) 🔒 JOGO TRANCADO (BLOCKED) E CONTAGEM INDIVIDUAL

O jogo tranca (fecha) se o turno pular 4 vezes consecutivas (os 4 jogadores não têm peça válida). 

### 6.1 Regra de Contagem Inegociável
A vitória de um jogo trancado **NÃO É** da equipe que somar menos pontos. A vitória pertence ao **JOGADOR INDIVIDUAL** que possuir a menor quantidade absoluta de pips em sua própria mão. A dupla dele ganha a rodada (1 ponto).

### 6.2 Algoritmo de Resolução de Empate

```typescript
function resolveBlockedGame(state: GameState) {
  // 1. Calcula a soma de pips (pontos) INDIVIDUALMENTE
  const playerScores = state.players.map(player => {
    const sum = player.hand.reduce((acc, piece) => acc + piece.a + piece.b, 0);
    return { id: player.id, team: player.team, score: sum };
  });

  // 2. Acha a menor nota da mesa (Ex: J1=10, J2=5, J3=15, J4=5 -> minScore = 5)
  const minScore = Math.min(...playerScores.map(p => p.score));

  // 3. Filtra quem bateu a menor nota
  const winners = playerScores.filter(p => p.score === minScore);

  // 4. Se houver vencedores de times DIFERENTES, é Empate Global.
  const isTie = winners.some(w => w.team !== winners[0].team);

  if (isTie) {
    // EMPATE GLOBAL: Ninguém ganha pontos.
    // Próxima rodada deve recomeçar do [6|6]
    state.matchConfig.forceStarterPiece = { a: 6, b: 6 };
    // OPCIONAL DE REGRA LOCAL: state.matchConfig.tieMultiplier = 2;
  } else {
    // VITÓRIA LIMPA: Um jogador ganhou, ou dois da mesma dupla empataram na menor nota
    const winningTeam = winners[0].team;
    awardPoints(state, winningTeam, 1 * state.matchConfig.tieMultiplier);
    
    // Reseta o multiplicador
    state.matchConfig.tieMultiplier = 1; 
  }
  
  state.status = "FINISHED_ROUND";
}
```

⸻

## 7) 🛑 CONDIÇÃO DE MATCH WIN (FIM DO JOGO GERAL)

A partida vai até 6 pontos. Porém, não deve existir trava que impeça de passar de 6.

### 7.1 Atribuição de Pontos
```typescript
function awardPoints(state: GameState, team: Team, points: number) {
  state.scores[team] += points;

  // A condição deve ser >= alvo, pois uma equipe com 5 pts pode dar uma Cruzada(4) e ir a 9.
  if (state.scores[team] >= state.matchConfig.targetScore) {
    state.status = "FINISHED_MATCH";
    // Dispara evento de Fim de Jogo
  } else {
    state.status = "FINISHED_ROUND";
    // Prepara próximo Round
  }
}
```

⸻

## 8) ⚠️ PREVENÇÃO DE EDGE CASES (INVARIANTES)

Esses fluxos não podem quebrar:
*   **E1:** Se um jogador tiver a peça `[3|4]` e a mesa estiver `left=3, right=5`, o `fitsRight` será falso. A peça serve apenas na esquerda. O código **NÃO DEVE** classificar como Lá-e-lô, deve ser batida simples.
*   **E2:** Quando a regra das 4 carroças for ativada e o dorme ficar `isVisible: true`, o Front-End é que consumirá esse dado para renderizar as peças com a face para cima. O motor só cuida da boolean.
*   **E3:** Jogadores nunca somam seus pontos na hora de resolver jogo trancado. Um parceiro com 2 pontos e outro com 50 pontos: a equipe **GANHA** se o inimigo A tiver 3 e o inimigo B tiver 4. A nota 2 vence todas individualmente.

⸻

## 9) 🧪 SUÍTE DE TESTES OBRIGATÓRIOS (PARA A IA GERAR)

O desenvolvedor/IA deve providenciar testes Jest/Vitest cobrindo:
1.  `calculateWinScore`: Mockar uma mesa `[4 ... 5]`. Jogar `[4|5]`. Afirmar retorno `= 3`.
2.  `calculateWinScore`: Mockar uma mesa `[6 ... 6]`. Jogar `[6|6]`. Afirmar retorno `= 4`.
3.  `resolveBlockedGame`: Mockar mãos `J1=3(A)`, `J2=4(B)`, `J3=100(A)`, `J4=5(B)`. Afirmar vitória do Team A.
4.  `resolveBlockedGame`: Mockar mãos `J1=5(A)`, `J2=5(B)`. Afirmar empate, com `forceStarterPiece = [6|6]`.
5.  `validateStartingHands`: Mockar mão com `[0|0], [1|1], [2|2], [3|3]`. Afirmar que a mão foi modificada, que `dorme` foi sobrescrito e que `dorme.isVisible = true`.

⸻

### 🧠 INSTRUÇÃO DIRETA PARA O CODEX/COPILOT:
*Aja como um Senior Software Engineer. Implemente a classe GameEngine/Reducer exatamente como descrito neste PRD. O código não deve possuir ambiguidade na detecção de Lá-e-Lô e Cruzada, e a rotina de Jogo Trancado deve ser puramente individual (linha 6.2). Escreva funções puras e separadas. Priorize legibilidade e tipagem forte.*

MECANICAS

# 📄 PRD TÉCNICO — MECÂNICAS, REGRAS DE NEGÓCIO E MÁQUINA DE ESTADOS (DOMINÓ 2v2)

⸻

## 1) 🎯 OBJETIVO DO MÓDULO

Implementar o `GameManager` (ou Reducer de Estado) de um dominó multiplayer 2v2. 
O sistema deve garantir a aplicação estrita das regras customizadas de pontuação (Lá-e-lô, Cruzada), resolução de empate com contagem individual de pips e o gerenciamento da área do "Dorme", tudo isso integrado à fluidez visual (estilo Dominoes 365) especificada no motor de renderização.

⸻

## 2) 🧠 ESTADO GLOBAL E TIPAGEM (TYPESCRIPT)

O motor lógico é a fonte da verdade. O layout visual apenas reage a este estado.

```typescript
type Team = "TEAM_A" | "TEAM_B";
type PlayerId = string;

type Piece = {
  id: string;
  a: number; // 0-6
  b: number; // 0-6
}

type Player = {
  id: PlayerId;
  team: Team;
  hand: Piece[];
  position: 0 | 1 | 2 | 3; // Ordem na mesa: J1(A), J2(B), J3(A), J4(B)
}

type DormeState = {
  pieces: Piece[]; // SEMPRE contém 4 peças
  isVisible: boolean; // false = costas para cima; true = carroças expostas
}

type GameState = {
  status: "DEALING" | "PLAYING" | "FINISHED_ROUND" | "FINISHED_MATCH";
  players: Player[];
  dorme: DormeState;
  board: {
    chain: any[]; // (Gerenciado pela Engine Visual - Snake Layout)
    leftValue: number | null;
    rightValue: number | null;
  };
  turnIndex: number; // 0 a 3
  
  scores: {
    TEAM_A: number; // Vence o jogo quem atingir >= 6 pontos
    TEAM_B: number;
  };
  
  matchConfig: {
    targetScore: number; // Padrão: 6
    tieMultiplier: number; // Multiplicador pós-empate (1 normal, ou +1 dependendo da config)
    forceStarterPiece: Piece | null; // Se não for null, obriga o portador desta peça a iniciar
  };
}
```

⸻

## 3) 🎲 DISTRIBUIÇÃO E EXCEÇÕES (DEALING PHASE)

### 3.1 Distribuição Base
1. Embaralhar as 28 peças do dominó.
2. Distribuir exatamente **6 peças** para cada jogador (Total: 24 peças).
3. As **4 peças restantes** vão para `gameState.dorme.pieces`.
4. O estado inicial do Dorme é `isVisible: false`.

### 3.2 Validação de Mão (Regra das Carroças/Dorme)
Antes do primeiro turno, o motor avalia a mão de cada jogador.

*   **4 Carroças:** O jogador troca automaticamente as 4 carroças pelas 4 peças ocultas no `dorme`. As 4 carroças vão para o `dorme` e `isVisible` vira `true`. 
    * *Integração Visual:* O front-end (estilo 365) deve animar essas peças saindo do jogador, indo para a área do dorme e virando para cima.
*   **5 Carroças:** A mão é invalidada. O estado volta para `DEALING` e as 28 peças são re-embaralhadas.
*   **6 Carroças:** Vitória instantânea. A equipe do jogador ganha 1 ponto (Batida simples) e a rodada encerra.

⸻

## 4) 🚀 FLUXO DE TURNOS E INÍCIO DE RODADA

### 4.1 Quem começa a jogar?
*   **Início de Jogo (Placar 0x0) ou Após Empate:** O motor varre as mãos e encontra quem possui o `[6|6]` (Dozão). Este jogador é o `turnIndex` inicial e é **obrigado** a jogar o `[6|6]` no turno 1.
*   **Rodadas normais:** A equipe que venceu a rodada anterior começa.

### 4.2 Turno Passado (Skip Automático)
Se for a vez de um jogador e ele não possuir peças que encaixem em `leftValue` ou `rightValue`, o motor avança o turno automaticamente, emitindo evento visual (ex: um balão "Passou").

⸻

## 5) 🏆 MÁQUINA DE PONTUAÇÃO (CÁLCULO DE BATIDA)

A rodada acaba quando a mão de um jogador chega a `0`. O motor analisa a peça final para calcular a pontuação.
O jogo permite ultrapassar os 6 pontos (ex: ter 5 pontos, fazer uma batida de 4 e acabar com 9 pontos).

### 5.1 Algoritmo de Classificação
```typescript
function calculateWinScore(playedPiece: Piece, stateBeforePlay: GameState): number {
  const isDouble = (playedPiece.a === playedPiece.b);
  const left = stateBeforePlay.board.leftValue;
  const right = stateBeforePlay.board.rightValue;
  
  // A peça atende aos DOIS lados da mesa ao mesmo tempo?
  const fitsLeft = (playedPiece.a === left || playedPiece.b === left);
  const fitsRight = (playedPiece.a === right || playedPiece.b === right);
  const fitsBoth = fitsLeft && fitsRight;

  if (fitsBoth) {
    return isDouble ? 4 : 3; 
    // 4 = CRUZADA (Carroça)
    // 3 = LÁ-E-LÔ (Peça comum)
  } else {
    return isDouble ? 2 : 1; 
    // 2 = BATIDA DE CARROÇA
    // 1 = BATIDA SIMPLES
  }
}
```

⸻

## 6) 🔒 JOGO TRANCADO E CONTAGEM INDIVIDUAL (CRÍTICO)

O jogo "Tranca" se os 4 jogadores passarem a vez sequencialmente.

### 6.1 A Regra de Ouro da Contagem
Em jogo trancado, a vitória NÃO é decidida pela soma da dupla. **Vence a rodada o jogador que possuir individualmente o MENOR número de pontos (pips) na mão.**

### 6.2 Algoritmo de Resolução
```typescript
function resolveBlockedGame(state: GameState) {
  // 1. Mapeia a soma individual de cada um
  const playerScores = state.players.map(p => ({
    team: p.team,
    score: p.hand.reduce((sum, piece) => sum + piece.a + piece.b, 0)
  }));

  // 2. Encontra a menor nota absoluta da mesa
  const minScore = Math.min(...playerScores.map(p => p.score));

  // 3. Encontra quem possui a menor nota
  const winners = playerScores.filter(p => p.score === minScore);

  // 4. Verifica empate entre equipes diferentes
  const isTie = winners.some(w => w.team !== winners[0].team);

  if (isTie) {
    // EMPATE: Ninguém pontua. Próxima rodada DEVE começar com o [6|6].
    state.matchConfig.forceStarterPiece = { a: 6, b: 6 };
  } else {
    // VITÓRIA: A equipe do dono da menor nota ganha 1 ponto.
    awardPoints(state, winners[0].team, 1 * state.matchConfig.tieMultiplier);
    state.matchConfig.tieMultiplier = 1; // Reseta o multiplicador
  }
  
  state.status = "FINISHED_ROUND";
}
```

⸻

## 7) ⚠️ EDGE CASES E PREVENÇÃO DE BUGS (PARA O CODEX)

*   **Falso Lá-e-Lô:** Se a peça do jogador é `[2|5]` e a mesa pede `[2 ... 4]`, a peça encaixa apenas de um lado. O código deve classificar isso como Batida Simples (1 ponto), nunca como Lá-e-lô, mesmo que a peça tenha 2 números diferentes.
*   **Contagem de Jogo Trancado:** O Codex NUNCA deve somar os pips de J1 + J3 para comparar com J2 + J4. A comparação (`Math.min`) é sempre baseada em 4 inteiros separados.
*   **Dorme Intocável:** As 4 peças do dorme NUNCA são compradas. O jogo de 4 pessoas não tem "compra". As peças só saem do dorme no momento inicial se a regra das 4 carroças for engatilhada.

⸻

### 🧠 INSTRUÇÃO PARA A IA (CODEX / COPILOT)
*Aja como um Senior Game Developer. Implemente o state manager utilizando as assinaturas e algoritmos descritos acima. Este módulo deve ser agnóstico em relação à UI, expondo apenas o `GameState` e aceitando intenções de jogada (`playPiece(playerId, pieceId, side)`). Gere testes unitários (Jest/Vitest) obrigatórios para as lógicas de `calculateWinScore`, `validateStartingHands` e `resolveBlockedGame`.*

Perfeito — vou transformar tudo que falei em um PRD técnico focado em QUALIDADE AAA (nível Dominoes 365), feito especificamente para o Codex evitar os erros que deixam o jogo “amador”.

Esse documento NÃO repete o que você já fez — ele complementa com o que falta pra ficar profissional.

⸻

📄 PRD TÉCNICO — QUALIDADE VISUAL, ANIMAÇÃO E PERCEPÇÃO (ANTI-BUG / NÍVEL 365)

⸻

1) 🎯 OBJETIVO

Garantir que o jogo:
	•	tenha sensação de fluidez real
	•	pareça polido (não acadêmico)
	•	mantenha consistência visual absoluta
	•	replique a experiência de jogos online modernos de dominó  ￼

⸻

2) 🧠 PRINCÍPIO CENTRAL

❗ O usuário NÃO percebe código — ele percebe MOVIMENTO

⸻

REGRA GLOBAL

Estado → Layout → Diferença → Animação → Percepção

Se qualquer etapa falhar → jogo parece bugado

⸻

3) 🎬 SISTEMA DE ANIMAÇÃO (CRÍTICO)

⸻

3.1 Pipeline obrigatório

oldLayout
newLayout

diff = calcular diferença

animar(diff)


⸻

3.2 PROIBIDO

❌ atualizar posição direto
❌ “teleportar” peça
❌ animar só peça nova

⸻

3.3 TIPOS DE ANIMAÇÃO

A) Entrada de peça
	•	origem: mão do jogador
	•	destino: posição final da mesa

⸻

B) REFLOW GLOBAL (OBRIGATÓRIO)

👉 TODAS as peças se movem

for piece in ALL:
  animate(old → new)


⸻

3.4 CONFIGURAÇÃO

duration: 220–280ms
easing: cubic-bezier(0.25, 0.8, 0.25, 1)


⸻

3.5 MICRO-FÍSICA (OPCIONAL — NÍVEL AAA)

Adicionar leve “peso”:

scale: 1 → 1.05 → 1

ou

translateY: +2px → 0


⸻

4) 🧱 SISTEMA DE CONTINUIDADE VISUAL

⸻

4.1 REGRA ABSOLUTA

👉 Peças DEVEM parecer conectadas fisicamente

⸻

4.2 VALIDAÇÕES
	•	sem gap visível
	•	sem sobreposição
	•	alinhamento perfeito eixo X/Y

⸻

4.3 TESTE

distância entre peças == 0 visualmente


⸻

5) 📐 LAYOUT PROFISSIONAL (ANTI-BUG)

⸻

5.1 REGRAS CRÍTICAS

❌ nunca posicionar incrementalmente
✔️ sempre recalcular layout completo

⸻

5.2 CENTRALIZAÇÃO DINÂMICA (OBRIGATÓRIA)

bounding = calcular bounding da cadeia

offsetX = centerX - bounding.centerX
offsetY = centerY - bounding.centerY

aplicar offset em TODAS peças


⸻

5.3 RESULTADO ESPERADO
	•	mesa sempre centralizada
	•	crescimento equilibrado
	•	nunca “puxa” para um lado

⸻

6) ⚠️ CONTROLE DE OVERFLOW (ANTI-BUG REAL)

⸻

6.1 PROBLEMA

Sem isso:
	•	mesa sai da tela
	•	layout quebra

⸻

6.2 SOLUÇÃO

if willOverflow(nextPosition):
    direction = rotate(direction)

ANTES de posicionar

⸻

7) 🎯 FEEDBACK VISUAL (O QUE FALTA PRA FICAR AAA)

⸻

7.1 HIGHLIGHT DE JOGADA

Quando jogador seleciona peça:
	•	destacar lados válidos
	•	brilho leve

⸻

7.2 HOVER / TOUCH
	•	peça levanta levemente
	•	escala: 1 → 1.05

⸻

7.3 TURNO ATIVO
	•	glow no jogador atual
	•	indicador claro

⸻

7.4 PEÇA INVÁLIDA

👉 NÃO travar seco
	•	leve shake
	•	feedback visual

⸻

8) 🔊 SISTEMA DE SOM (IMPACTO REAL)

⸻

8.1 EVENTOS
	•	peça colocada → “toc”
	•	turno → clique leve
	•	vitória → som curto

⸻

8.2 REGRA

👉 som sincronizado com animação

⸻

9) 🧩 DESIGN DAS PEÇAS (PERCEPÇÃO)

⸻

9.1 DETALHES QUE IMPORTAM
	•	sombra leve
	•	borda suave
	•	contraste alto

⸻

9.2 DUPLAS

👉 devem “quebrar o padrão visual”
	•	rotação perpendicular
	•	destaque leve

⸻

10) ⚠️ ERROS CRÍTICOS (PROIBIDOS)

⸻

VISUAIS

❌ peça desalinhada
❌ pontinho fora do padrão
❌ gap entre peças
❌ curva bugada

⸻

ANIMAÇÃO

❌ peça teleportando
❌ só nova peça animando
❌ easing linear

⸻

UX

❌ sem feedback de turno
❌ clique sem resposta
❌ jogada inválida silenciosa

⸻

11) 🧪 TESTES DE QUALIDADE VISUAL

⸻

CENÁRIOS OBRIGATÓRIOS
	•	50+ peças na mesa
	•	múltiplas curvas
	•	tela mobile
	•	jogadas rápidas
	•	reflow contínuo

⸻

CHECKLIST FINAL

[ ] mesa sempre centralizada
[ ] nenhuma peça sobreposta
[ ] animação suave
[ ] reflow funcionando
[ ] peças sempre conectadas
[ ] nenhuma quebra visual


⸻

12) 🚀 INTEGRAÇÃO COM SUA ENGINE

⸻

REGRA DE OURO

👉 UI NUNCA altera estado

Engine → estado
UI → render(state)


⸻

PIPELINE FINAL

applyMove()
→ novo estado
→ layout()
→ diff()
→ animate()


⸻

🧠 RESUMO FINAL

Se o Codex seguir isso:

👉 o jogo vai parecer:
	•	fluido
	•	responsivo
	•	natural
	•	profissional

⸻

🔥 FRASE FINAL (PRO CODEX)

“Não basta funcionar. Cada transição deve parecer física, contínua e previsível. O usuário deve sentir que a mesa é um objeto real, não uma lista de elementos.”

⸻

Se quiser, posso agora juntar:

👉 TODOS os seus PRDs + esse aqui
e te entregar um PROMPT FINAL MONSTRO (nível produção real) pronto pro Codex gerar o jogo inteiro.

Perfeito — agora você vai adicionar uma melhoria de nível profissional no seu PRD, baseada nessa mecânica do Paciencia Domino Online, sem perder o estilo do Dominoes 365.

Vou te entregar isso no formato PRD pronto pra colar 👇

⸻

📄 🔥 ADIÇÃO AO PRD — SISTEMA DE REFLOW INTELIGENTE (HYBRID LAYOUT ENGINE)

⸻

14) 🧠 SISTEMA DE REFLOW INTELIGENTE (INSPIRAÇÃO PACIENCIA + DOMINO 365)

⸻

14.1 🎯 OBJETIVO

Aprimorar o layout da mesa para:
	•	evitar overflow da tela
	•	manter centralização constante
	•	melhorar uso do espaço
	•	preservar continuidade visual
	•	manter sensação física do dominó

⸻

14.2 🧠 PRINCÍPIO CENTRAL

layout = função(chain, viewport)

👉 O layout deve ser recalculado completamente a cada jogada
👉 Nunca armazenar posições fixas

⸻

14.3 🔄 REFLOW GLOBAL OBRIGATÓRIO

Sempre que o estado muda:
	1.	recalcular layout completo
	2.	recalcular bounding box
	3.	aplicar centralização
	4.	animar TODAS as peças

⸻

14.4 📐 CENTRALIZAÇÃO DINÂMICA AVANÇADA

Após gerar o layout:

offsetX = viewport.centerX - bounding.centerX
offsetY = viewport.centerY - bounding.centerY

Aplicar offset em TODAS as peças.

⸻

14.5 📦 CONTROLE DE BOUNDING (ANTI-OVERFLOW)

Antes de posicionar cada peça:

if (willOverflow(nextPosition, viewport)):
    direction = rotateDirection(direction)

⚠️ Deve ocorrer ANTES de posicionar a peça

⸻

14.6 🔥 COMPRESSÃO DINÂMICA (INSPIRAÇÃO PACIENCIA)

Objetivo:

Evitar que a mesa fique grande demais

⸻

Regra:

chainLength = number of pieces

if chainLength > 20:
    GAP = 3

if chainLength > 30:
    GAP = 2

if chainLength > 40:
    GAP = 1


⸻

Regras obrigatórias:
	•	compressão deve ser gradual
	•	nunca quebrar encaixe visual
	•	peças continuam conectadas
	•	não alterar largura/altura da peça

⸻

14.7 🧭 SMART OVERFLOW (CONTROLE INTELIGENTE)

Ao invés de esperar sair da tela:

threshold = 90% da largura/altura

if nextPosition aproxima do limite:
    direction = rotateDirection(direction)


⸻

14.8 🧩 PRESERVAÇÃO DE CONTINUIDADE (CRÍTICO)

Mesmo com reflow:
	•	peças devem permanecer conectadas
	•	distância visual = 0
	•	nenhuma sobreposição
	•	nenhuma quebra na cadeia

⸻

14.9 🎬 ANIMAÇÃO DO REFLOW

Para TODAS as peças:

animate(from: oldPosition, to: newPosition)

Config:
	•	duration: 200–300ms
	•	easing: ease-out

⸻

14.10 ⚠️ REGRAS PROIBIDAS

❌ NÃO:
	•	teleportar peças
	•	quebrar snake layout
	•	reposicionar manualmente
	•	usar grid fixo
	•	pular animação

⸻

14.11 🧪 TESTES OBRIGATÓRIOS
	•	50+ peças
	•	múltiplas curvas
	•	crescimento dos dois lados
	•	tela pequena (mobile)
	•	mudanças rápidas de estado

⸻

14.12 🧠 RESULTADO ESPERADO
	•	mesa sempre centralizada
	•	nunca sai da tela
	•	uso eficiente do espaço
	•	movimento fluido
	•	aparência profissional
	•	comportamento híbrido (365 + Paciencia)

⸻

🧠 RESUMO DO QUE VOCÊ ACABOU DE ADICIONAR

👉 Você acabou de colocar no seu PRD:
	•	compressão inteligente
	•	centralização perfeita
	•	controle real de overflow
	•	reflow nível AAA

⸻

🚀 IMPACTO REAL

Com isso:

👉 seu jogo deixa de ser:
	•	“igual Domino 365”

👉 e passa a ser:
	•	melhor otimizado que muitos dominós online

⸻

Se quiser, próximo passo eu posso:

👉 integrar essa seção direto no seu PROMPT FINAL MONSTRO
👉 ou revisar teu PRD completo pra deixar nível produção real mesmo

Perfeito — agora vou te entregar um PRD de regra isolado, no nível técnico certo pra colar direto no teu documento, sem quebrar nada do que você já fez.

Isso aqui tá escrito no padrão que IA (Codex) entende sem ambiguidade.

⸻

📄 PRD — REGRA DE EMPATE COM MULTIPLICADOR (X2) E REINÍCIO COM [6|6]

⸻

1) 🎯 OBJETIVO

Definir o comportamento do sistema quando uma rodada termina em empate após jogo trancado (blocked game).

Essa regra introduz:
	•	multiplicador de pontuação para a próxima rodada
	•	redefinição do jogador inicial baseada na peça [6|6]

⸻

2) 🧠 DEFINIÇÃO DE EMPATE

Um empate ocorre quando:

Durante a resolução de um jogo trancado:
	•	dois ou mais jogadores possuem a menor soma de pips
	•	e esses jogadores pertencem a times diferentes

⸻

Formalização:

isTie = winners.some(w => w.team !== winners[0].team)


⸻

3) ⚠️ CONDIÇÃO DE ATIVAÇÃO

A regra deve ser ativada APENAS quando:
	•	o jogo está trancado (4 passes consecutivos)
	•	a menor pontuação individual está empatada entre equipes diferentes

⸻

4) 🔥 EFEITOS DO EMPATE

Quando ocorrer empate:

4.1 Nenhuma equipe pontua

// NÃO chamar awardPoints


⸻

4.2 Ativar multiplicador de pontuação

state.matchConfig.tieMultiplier = 2


⸻

4.3 Forçar início com peça específica

state.matchConfig.forceStarterPiece = {
  a: 6,
  b: 6
}


⸻

4.4 Encerrar rodada

state.status = "FINISHED_ROUND"


⸻

5) 🚀 INÍCIO DA PRÓXIMA RODADA

Na fase de distribuição (DEALING):

⸻

5.1 Regra obrigatória

Após distribuir as peças:

👉 O sistema deve procurar qual jogador possui [6|6]

⸻

5.2 Algoritmo

function findStarterPlayer(players: Player[]): PlayerId {
  for (const player of players) {
    const hasDoubleSix = player.hand.some(p => p.a === 6 && p.b === 6)
    
    if (hasDoubleSix) {
      return player.id
    }
  }

  throw new Error("Nenhum jogador possui [6|6] — estado inválido")
}


⸻

5.3 Aplicação

if (state.matchConfig.forceStarterPiece) {
  state.turnIndex = indexOfPlayerWith[6|6]
}


⸻

5.4 Restrição obrigatória

No primeiro turno:

👉 O jogador DEVE jogar [6|6]

if (firstMove && playerHas[6|6]) {
  allowOnly([6|6])
}


⸻

6) 💰 APLICAÇÃO DO MULTIPLICADOR

O multiplicador deve ser aplicado somente na próxima vitória válida.

⸻

6.1 Regra

finalPoints = basePoints * state.matchConfig.tieMultiplier


⸻

6.2 Exemplo

Tipo de vitória	Base	Multiplicador	Resultado
Simples	1	x2	2
Carroça	2	x2	4
Lá-e-lô	3	x2	6
Cruzada	4	x2	8


⸻

7) 🔄 RESET DO MULTIPLICADOR

Após uma rodada com vitória válida:

state.matchConfig.tieMultiplier = 1
state.matchConfig.forceStarterPiece = null


⸻

8) ⚠️ EDGE CASES (CRÍTICO)

⸻

E1 — Múltiplos empates consecutivos

Se ocorrer outro empate:

state.matchConfig.tieMultiplier *= 2

Exemplo:
	•	1º empate → x2
	•	2º empate → x4
	•	3º empate → x8

⸻

E2 — Jogador sem [6|6]

NUNCA deve acontecer.

Se acontecer:

throw Error("Estado inválido: peça [6|6] não encontrada")


⸻

E3 — Vitória após empate

Multiplicador deve ser aplicado ANTES do reset.

⸻

9) 🧪 TESTES OBRIGATÓRIOS

⸻

Teste 1 — Empate ativa regra

expect(state.matchConfig.tieMultiplier).toBe(2)
expect(state.matchConfig.forceStarterPiece).toEqual({6,6})


⸻

Teste 2 — Jogador correto inicia

expect(turnIndex).toBe(playerWithDoubleSix)


⸻

Teste 3 — Multiplicador aplicado

expect(finalScore).toBe(baseScore * 2)


⸻

Teste 4 — Reset após vitória

expect(tieMultiplier).toBe(1)
expect(forceStarterPiece).toBe(null)


⸻

10) 🧠 REGRA FINAL (RESUMO PARA O CODEX)

Se um jogo trancado terminar em empate entre equipes:
	•	ninguém pontua
	•	próxima rodada vale x2
	•	jogador com [6|6] inicia obrigatoriamente
	•	multiplicador aplica na próxima vitória
	•	após vitória → reset

⸻

🔥 IMPORTANTE (INTEGRAÇÃO COM SEU PRD)

Isso aqui você deve colar:

👉 logo após a seção de JOGO TRANCADO (BLOCKED GAME)
ou
👉 dentro de matchConfig / regras avançadas

⸻

Se quiser, no próximo passo eu posso:
	•	integrar ISSO direto no teu PRD gigante sem quebrar nada
	•	ou revisar tua lógica pra garantir que o Codex não bugue essa parte (essa aqui é uma das que mais dá erro)