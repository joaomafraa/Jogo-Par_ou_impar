
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

