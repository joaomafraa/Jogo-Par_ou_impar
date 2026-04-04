## PRD: Dominó Clássico Em Dupla (4 Jogadores) Com Denúncia Gato

### 1) Resumo Executivo
Produto: novo modo de jogo de Dominó clássico em dupla para o sistema de salas existente.

Objetivo: entregar uma experiência online em tempo real com 4 jogadores obrigatórios, duplas opostas, mesa animada, visual minimalista esportivo, mecânica de denúncia Gato e experiência de mão inspirada no fluxo do UNO, mantendo peças visuais de dominó, seguindo as regras clássicas definidas pelo cliente.

---

### 2) Problema
A aplicação atual precisa suportar apenas o modo de duplas com 4 jogadores, com gestão de times, estado de mão/mesa de dominó e regras especiais de batida, fechamento de jogo e denúncia.

---

### 3) Objetivos
- Permitir salas de dominó com 4 jogadores obrigatórios.
- Permitir formação de duas duplas, com parceiros sempre em frente.
- Implementar o fluxo completo do dominó clássico com pontuação por rodada.
- Implementar as regras especiais de abertura de mão:
	- 4 carroças
	- 5 carroças
	- 6 carroças
- Implementar a mecânica Gato.
- Exibir a mão com peças de dominó, com experiência de interação inspirada no UNO (seleção rápida, destaque visual e leitura clara do turno).
- Entregar UI com mesa de 4 assentos, animações e boa experiência mobile/desktop.
- Garantir estado autoritativo no servidor.

---

### 4) Fora de Escopo
- Partidas com bot.
- Início com menos de 4 jogadores.
- Torneio.
- Ranking global.
- Replay avançado.
- Regras configuráveis por usuário na primeira versão.
- Modo Burrinha.

---

### 5) Usuários
- Jogador casual que quer jogar dominó em dupla em sala privada.
- Grupo de 4 amigos que precisa de sincronização em tempo real e visual claro da mesa.

---

### 6) Regras do Jogo
Este PRD consolida o modo com as regras abaixo.

### 6.1 Estrutura da partida
- Jogam 2 duplas.
- O parceiro sempre fica em frente na mesa.
- A formação de duplas acontece na etapa de pronto.
- Após confirmar as duplas, o sistema posiciona os parceiros em assentos opostos automaticamente.
- A partida exige 4 jogadores ativos.
- Cada jogador começa com 6 peças.
- 4 peças ficam fora do jogo, chamadas de dorme.
- O jogo começa com a peça 6:6 (dozão).
- Quem tiver o 6:6 inicia a partida.
- Não existe compra de peças neste modo.
- As regras são fixas.

### 6.2 Ordem das jogadas
- A ordem de jogo é determinística e obrigatória.
- O turno segue no sentido horário da mesa.
- O jogador inicial da rodada é sempre quem possuir o 6:6 na distribuição válida da rodada.
- A partir desse jogador, os próximos turnos seguem estritamente a ordem dos assentos.

### 6.3 Pontuação da partida
- O jogo é disputado por rodadas.
- A partida termina quando uma dupla alcançar 6 pontos ou mais.
- Cada rodada vencida soma pontos para a dupla vencedora, conforme o tipo de batida ou fechamento.
- Se houver empate de fechamento, a próxima rodada vale em dobro.
- O valor em dobro pode acumular em empates consecutivos (2x, 4x, 8x...).

### 6.4 Tipos de batida
As batidas podem acontecer em qualquer rodada e o sistema deve notificá-las em tempo real.

#### Tipos e valores
- Batida simples = 1 ponto
- Batida com carroça = 2 pontos
- Batida lá-e-lô = 3 pontos
- Batida cruzada = 4 pontos

#### Definições
- Carroça: peça com os dois números iguais.
- Lá-e-lô: batida nos dois lados da mesa sem ser carroça.
- Batida cruzada: batida nos dois lados da mesa com carroça.

### 6.5 Fechamento do jogo
- Quando o jogo fecha, faz-se a contagem de pontos.
- Vence o jogador com menos pontos na mão, independentemente da dupla.
- A dupla do jogador vencedor recebe 1 ponto base de fechamento, multiplicado pelo fator da rodada (1x, 2x, 4x, 8x...).
- Se após adicionar a pontuação da rodada a dupla chegar a 6 pontos ou mais, a partida encerra com vitória da dupla.
- Se não chegar a 6 pontos, soma a pontuação da rodada e redistribui para a próxima rodada.
- Se houver empate no fechamento:
	- aplica rodada em dobro para a próxima rodada
	- o fator de rodada em dobro pode acumular
	- no empate, o dozão continua sendo a peça de saída.

### 6.6 Regras especiais de mão inicial
#### 4 carroças
- Se um jogador começar com exatamente 4 carroças:
	- ele entrega as 4 carroças ao dorme
	- e recebe as 4 peças do dorme em troca
	- o dorme fica aberto/visível para todos.

#### 5 carroças
- Se um jogador começar com 5 carroças:
	- o jogo deve ser misturado novamente
	- e a distribuição deve ser refeita.

#### 6 carroças
- Se um jogador começar com 6 carroças:
	- isso equivale a uma batida simples.

### 6.7 Denúncia Gato
- O botão Gato deve ficar disponível conforme a regra definida para o modo.
- Somente o jogador que vai jogar naquele turno pode denunciar.
- A mecânica de denúncia continua ativa.
- Se a denúncia for correta:
	- a dupla acusadora vence imediatamente.
- Se a denúncia for incorreta:
	- apenas o acusador perde o próprio turno.

### 6.8 Notificações de mesa e rodada
- O sistema deve notificar cada batida.
- Toda batida deve ser enviada em tempo real para todos os jogadores da sala.
- As notificações devem identificar claramente o tipo:
	- batida simples
	- batida com carroça
	- lá-e-lô
	- batida cruzada
- O sistema deve notificar eventos especiais de abertura da rodada:
	- troca com dorme por 4 carroças
	- embaralhamento e redistribuição por 5 carroças
	- acionamento de 6 carroças como batida simples
- Ao final de cada rodada, o sistema deve mostrar um resumo para toda a mesa com:
	- jogador vencedor da rodada
	- dupla que recebeu a pontuação
	- tipo de batida ou fechamento
	- pontos aplicados na rodada
	- fator da rodada (1x, 2x, 4x...)
	- indicação se a próxima rodada será em dobro

---

### 7) Requisitos Funcionais

### RF-01
O sistema deve permitir criar e entrar em sala com capacidade de 4 jogadores ativos no modo dominó.

### RF-02
O jogo só pode iniciar quando houver 4 jogadores conectados e 2 duplas confirmadas na etapa de pronto.

### RF-03
Cada jogador deve receber 6 pedras no início de cada rodada.

### RF-04
O jogador deve ver a frente das próprias pedras; as pedras dos outros jogadores devem aparecer apenas com verso + contador.

### RF-04.1
A exibição da mão deve manter peças visuais de dominó e seguir a ergonomia de interação do UNO: mão do jogador em leque na base da tela, com destaque visual na peça selecionada.

### RF-04.2
As mãos dos demais jogadores devem exibir apenas o verso das peças de dominó, organizadas em leque/linha por assento, sem revelar valores, mantendo experiência de leitura semelhante ao UNO.

### RF-05
A mesa central deve mostrar a sequência de pedras jogadas com indicação de lado esquerdo/direito.

### RF-06
O servidor deve validar toda jogada quanto à compatibilidade com as extremidades da mesa.

### RF-07
O fluxo de turno deve suportar avanço de turnos, validação de jogadas e resolução de situações especiais do jogo.

### RF-08
O sistema deve manter pontuação acumulada por dupla ao fim de cada rodada.

### RF-09
O botão Gato deve ficar disponível e funcional durante a partida, conforme a regra do modo.

### RF-10
Se a denúncia Gato estiver correta, a vitória deve ser imediata para a dupla acusadora.

### RF-11
Se a denúncia Gato estiver incorreta, apenas o acusador perde o próprio turno.

### RF-12
O estado da partida deve permanecer consistente entre todos os clientes em reconexão.

### RF-13
O sistema deve notificar cada batida em tempo real para todos os jogadores.

### RF-14
O sistema deve aplicar a regra de 4 carroças com troca pelo dorme e abertura do dorme para visualização.

### RF-15
O sistema deve aplicar a regra de 5 carroças com embaralhamento e redistribuição da partida.

### RF-16
O sistema deve aplicar a regra de 6 carroças como equivalente a batida simples.

### RF-17
O sistema deve iniciar sempre com o jogador que possuir a peça 6:6.

### RF-18
Não deve existir mecânica de compra de peças neste modo.

### RF-19
A partida deve encerrar quando uma dupla atingir 6 pontos ou mais.

### RF-20
Em caso de empate de fechamento, a próxima rodada deve valer em dobro e o multiplicador deve poder acumular em empates consecutivos.

### RF-21
No fechamento, a vitória da rodada deve ser definida pelo jogador com menor pontuação individual na mão, independentemente da dupla.

### RF-22
Somente o jogador que está com o turno ativo pode acionar denúncia Gato.

### RF-23
Após a definição de duplas na etapa de pronto, o sistema deve posicionar automaticamente parceiros em assentos opostos e fixar a ordem de jogadas no sentido horário.

### RF-24
Quando ocorrer 4, 5 ou 6 carroças na abertura, o sistema deve notificar toda a mesa com o evento aplicado antes do primeiro turno válido.

### RF-25
Ao fim de cada rodada, o sistema deve exibir resumo de resultado para todos os jogadores contendo vencedor da rodada, tipo de batida ou fechamento, pontuação aplicada e fator da rodada.

### RF-26
Quando houver empate de fechamento, o sistema deve notificar explicitamente no fim da rodada que a próxima rodada será em dobro, com multiplicador acumulado atual.

---

### 8) Requisitos Não Funcionais

### RNF-01
Sincronização em tempo real via Socket.IO com latência perceptiva baixa.

### RNF-02
UI responsiva para desktop e mobile.

### RNF-03
Animações com fallback para reduced-motion.

### RNF-04
Estado autoritativo no servidor para evitar divergência de regras.

### RNF-05
Compatibilidade retroativa com os modos existentes.

### RNF-06
O sistema deve suportar reconexão sem perda de consistência de estado.

---

### 9) Estados da Partida
- lobby
- setup-duplas
- pronta
- em-rodada
- resultado-rodada
- fim-partida

---

### 10) Eventos do Jogador
- entrar sala
- confirmar dupla
- jogar pedra
- denunciar gato

> Observação: neste modo não existe comprar peça.

---

### 11) Eventos do Sistema
- sincronização de estado
- troca de turno
- validação de jogada
- resolução de batida
- notificação de batida
- notificação de evento especial de abertura (4/5/6 carroças)
- resolução de denúncia
- reconexão
- fechamento de rodada
- resumo de fim de rodada
- notificação de rodada em dobro acumulada
- fechamento de partida

---

### 12) Fluxos Principais

### Fluxo A: formação de sala e duplas
1. Jogadores entram na sala.
2. Jogadores escolhem e confirmam duplas na etapa de pronto.
3. O sistema posiciona automaticamente os parceiros em frente.
4. Com 4 jogadores e 2 duplas confirmadas, o jogo pode iniciar.

### Fluxo B: início de partida
1. O sistema distribui 6 pedras para cada jogador.
2. O sistema verifica as regras especiais de abertura:
	 - 4 carroças
	 - 5 carroças
	 - 6 carroças
3. Se ocorrer alguma regra especial, o sistema notifica toda a mesa com o motivo e a ação aplicada.
4. O jogo começa com quem tiver a peça 6:6.
5. A ordem de jogadas segue no sentido horário a partir do jogador inicial.

### Fluxo C: rodada padrão
1. Jogadores alternam turnos.
2. O servidor valida cada jogada.
3. Se a jogada gerar batida, o sistema notifica todos.
4. A rodada continua até fechamento ou até uma dupla alcançar pontuação de encerramento.

### Fluxo D: fechamento de jogo
1. A mesa fecha.
2. O sistema calcula a pontuação individual de cada jogador na mão.
3. O jogador com menor pontuação individual define a dupla vencedora da rodada.
4. A dupla vencedora recebe 1 ponto base, multiplicado pelo fator acumulado da rodada quando houver.
5. Se a dupla alcançar 6 pontos ou mais, encerra a partida.
6. Caso contrário, redistribui para nova rodada.
7. Em empate de fechamento, aplica rodada em dobro acumulável.
8. O sistema publica o resumo final da rodada para todos com vencedor, tipo de resultado, pontos aplicados e status de rodada em dobro.

### Fluxo E: denúncia Gato
1. Somente o jogador do turno atual pode acionar o botão Gato.
2. O servidor audita a jogada denunciada.
3. Se correta, a dupla acusadora vence imediatamente.
4. Se incorreta, o acusador perde o próprio turno.

---

### 13) UX/UI

- Mesa com 4 assentos posicionados em norte, leste, sul e oeste.
- Parceiro sempre em frente.
- A mão do próprio jogador fica visível com peças de dominó em leque horizontal na base da tela, com seleção por clique e destaque da peça ativa.
- Os outros jogadores veem apenas o verso das peças de dominó (sem valores), com contador de peças por assento, em organização inspirada no UNO.
- Destaque forte para o turno ativo.
- Barra de ação contextual.
- Animações de distribuição, jogada na mesa e notificação de batida.
- Direção visual: minimalista esportiva.
- O dorme deve aparecer visível quando a regra dos 4 carroças for acionada.

---

### 14) Métricas de Sucesso
- Taxa de partidas iniciadas com 4 jogadores sem erro de sincronização.
- Taxa de reconexão bem-sucedida no meio da rodada.
- Tempo médio por rodada dentro da faixa aceitável.
- Baixa taxa de denúncias Gato com erro de sistema.
- Clareza visual da mesa em desktop e mobile.
- Notificações de batida percebidas corretamente por todos os clientes.

---

### 15) Critérios de Aceite

### CA-01
Não inicia sem 4 jogadores e 2 duplas confirmadas.

### CA-02
Distribui 6 pedras por jogador corretamente.

### CA-03
Ocultação da mão de terceiros funciona em todos os clientes.

### CA-03.1
A mão do jogador atual é renderizada em formato de leque com peças de dominó, com experiência de seleção inspirada no UNO e destaque visual da peça ativa.

### CA-03.2
As mãos dos demais jogadores são renderizadas apenas com verso das peças de dominó, mantendo sigilo total dos valores.

### CA-04
Jogada incompatível não é aceita pelo servidor.

### CA-05
Gato correto encerra com vitória imediata da dupla acusadora.

### CA-06
Gato incorreto aplica perda de turno só ao acusador.

### CA-07
Pontuação acumulada por dupla atualiza ao fim da rodada.

### CA-08
Responsividade e animações funcionam em desktop e mobile.

### CA-09
O sistema notifica corretamente cada batida.

### CA-10
A regra de 4 carroças troca a mão do jogador pelas 4 peças do dorme e deixa o dorme visível.

### CA-11
A regra de 5 carroças reinicia a distribuição.

### CA-12
A regra de 6 carroças é tratada como batida simples.

### CA-13
A partida começa com quem tiver o 6:6.

### CA-14
Não existe compra de peças neste modo.

### CA-15
Ao fechar o jogo, vence a rodada o jogador com menor pontuação individual na mão, independentemente da dupla, e a pontuação da rodada vai para a dupla desse jogador.

### CA-16
Em empate de fechamento, a próxima rodada vale em dobro e o multiplicador pode acumular em empates consecutivos.

### CA-17
No fechamento, a dupla vencedora soma 1 ponto base multiplicado pelo fator da rodada; se atingir 6 pontos ou mais, a partida encerra, caso contrário, redistribui.

### CA-18
Somente o jogador com turno ativo pode denunciar Gato.

### CA-19
As duplas são definidas na etapa de pronto, parceiros ficam em frente e a ordem de jogadas segue no sentido horário.

### CA-20
Quando ocorrer regra especial de 4, 5 ou 6 carroças na abertura, toda a mesa recebe notificação clara do evento e da ação aplicada.

### CA-21
No fim de cada rodada, toda a mesa recebe resumo contendo vencedor, tipo de batida ou fechamento, pontuação aplicada e fator da rodada.

### CA-22
Quando houver empate de fechamento, o fim da rodada informa explicitamente o multiplicador acumulado da próxima rodada em dobro.

---

### 16) Riscos
- Divergência de regras regionais de dominó clássico.
- Complexidade de sincronização em 4 clientes com reconexão.
- Ambiguidade residual em variantes locais fora do escopo definido.
- Dependência de notificação correta das batidas para boa UX.

---

### 17) Dependências Técnicas
- Refatorar servidor para engine por modo.
- Expandir contrato de eventos Socket.IO para dominó.
- Novos componentes de mesa e pedra no frontend React.
- Ajustes de estilos globais para tema e responsividade.
- Suporte a eventos de notificação de batida e estados especiais de abertura.

---

### 18) Parâmetros Fixos da Versão
Nesta versão, as regras abaixo são fixas e não configuráveis pelo usuário:

- 4 jogadores obrigatórios
- 2 duplas
- formação de duplas na etapa de pronto
- parceiro em frente
- experiência de mão inspirada no UNO, mantendo peças visuais de dominó
- 6 pedras por jogador
- 4 peças no dorme
- início com 6:6
- sem compra de peças
- ordem de jogadas no sentido horário
- batidas com pontuação fixa:
	- simples = 1
	- carroça = 2
	- lá-e-lô = 3
	- cruzada = 4
- 4 carroças = troca com dorme
- 5 carroças = reinicia distribuição
- 6 carroças = batida simples
- vitória por 6 pontos ou mais
- empate no fechamento = próxima rodada em dobro
- rodada em dobro acumulável
- denúncia Gato apenas pelo jogador do turno
- modo Burrinha fora do escopo
