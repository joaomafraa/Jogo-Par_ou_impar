## PRD: Dominó Clássico Em Dupla (4 Jogadores) Com Denúncia Gato

### 1) Resumo Executivo
Produto: novo modo de jogo Dominó clássico em dupla para o sistema de salas existente.
Objetivo: entregar uma experiência online em tempo real com 4 jogadores obrigatórios, times escolhidos na sala, mesa animada, visual minimalista esportivo e mecânica de denúncia Gato.

### 2) Problema
A aplicação atual é otimizada para partidas de 2 jogadores e não atende partidas em dupla com 4 jogadores, gestão de times, estado de mão/mesa de dominó e regras de denúncia de jogada inválida.

### 3) Objetivos
- Permitir salas de dominó com limite e início obrigatórios em 4 jogadores.
- Permitir formação de duas duplas escolhidas pelos jogadores.
- Implementar fluxo completo de dominó clássico com pontuação acumulada.
- Implementar mecânica Gato com regras definidas.
- Entregar UI com mesa 4 assentos, animações e boa experiência mobile/desktop.

### 4) Fora De Escopo
- Modo Burrinha.
- Partidas com bot.
- Início com menos de 4 jogadores.
- Torneio, ranking global, replay avançado.

### 5) Usuários
- Jogador casual que quer jogar dominó em dupla em sala privada.
- Grupo de 4 amigos que precisa de sincronização em tempo real e visual claro da mesa.

### 6) Requisitos Funcionais
RF-01: O sistema deve permitir criar/entrar em sala com capacidade de 4 jogadores ativos no modo dominó.
RF-02: O jogo só pode iniciar quando houver 4 jogadores conectados e 2 duplas confirmadas.
RF-03: Cada jogador deve receber 6 pedras no início de cada rodada.
RF-04: O jogador deve ver a frente das próprias pedras; os outros devem aparecer apenas com verso + contador.
RF-05: A mesa central deve mostrar a sequência de pedras jogadas com lado esquerdo/direito.
RF-06: O servidor deve validar toda jogada quanto à compatibilidade com as extremidades da mesa.
RF-07: O fluxo de turno deve suportar jogar, comprar e passar (quando aplicável pelas regras).
RF-08: O sistema deve manter pontuação acumulada por dupla ao fim de cada rodada.
RF-09: O botão Gato deve ficar disponível após a jogada inicial e durante a partida.
RF-10: Se denúncia Gato estiver correta, vitória imediata da dupla acusadora.
RF-11: Se denúncia Gato estiver incorreta, apenas o acusador perde o próprio turno.
RF-12: O estado da partida deve permanecer consistente entre todos os clientes em reconexão.

### 7) Requisitos Não Funcionais
RNF-01: Sincronização em tempo real via Socket.IO com latência perceptiva baixa.
RNF-02: UI responsiva para desktop e mobile.
RNF-03: Animações com fallback para reduced-motion.
RNF-04: Estado autoritativo no servidor para evitar divergência de regras.
RNF-05: Compatibilidade retroativa dos modos existentes.

### 8) Regras De Negócio (Definidas)
- Variante: Dominó clássico em dupla.
- Jogadores por partida: 4 obrigatórios.
- Formação de dupla: escolhida pelos jogadores.
- Mão inicial: 6 pedras por jogador.
- Gato correto: vitória imediata da dupla acusadora.
- Gato incorreto: acusador perde somente o próprio turno.
- Burrinha: removida do escopo.

### 9) Parâmetros Editáveis (Para Alteração Rápida)
Use esta seção como "painel de configuração de produto". Alterar aqui deve atualizar regra/UX sem reescrever o PRD.

P-01 capacidade_sala_domino
- Valor atual: 4
- Opções futuras: 2, 3, 4
- Impacto: backend de assentos, ready-check, layout de mesa.

P-02 mao_inicial_por_jogador
- Valor atual: 6
- Opções futuras: 7
- Impacto: distribuição, duração média de rodada, UI da mão.

P-03 formacao_de_duplas
- Valor atual: escolhida pelos jogadores
- Opções futuras: fixa por assento
- Impacto: lobby, estado de time, UX de confirmação.

P-04 inicio_minimo
- Valor atual: 4 obrigatórios
- Opções futuras: iniciar com menos / completar com bot
- Impacto: regras de partida, fairness, testes.

P-05 disponibilidade_botao_gato
- Valor atual: após jogada inicial, durante toda a partida
- Opções futuras: janelas restritas por turno
- Impacto: UX, validação de denúncia.

P-06 resultado_gato_correto
- Valor atual: vitória imediata da dupla acusadora
- Opções futuras: anula jogada e continua
- Impacto: duração da partida, estratégia, mensagens finais.

P-07 penalidade_gato_incorreto
- Valor atual: perder turno do acusador
- Opções futuras: perder turno da dupla / perda de pontos
- Impacto: balanceamento e comportamento de risco.

P-08 tema_visual
- Valor atual: minimalista esportivo
- Opções futuras: feltro clássico / arcade
- Impacto: tokens CSS, componentes visuais e animações.

P-09 criterio_fim_partida
- Valor atual: pontuação acumulada clássica (detalhe ainda pendente)
- Opções futuras: por número de rodadas / alvo de pontos
- Impacto: placar, tela de resultado e testes.

### 10) Fluxos Principais
Fluxo A: formação de sala e duplas
1. Jogadores entram na sala.
2. Jogadores escolhem/confirmam duplas.
3. Com 4 jogadores e 2 duplas, habilita início.

Fluxo B: rodada padrão
1. Distribui 6 pedras por jogador.
2. Alternância de turno com validação no servidor.
3. Jogador joga, compra ou passa conforme regra.
4. Encerramento da rodada e atualização de pontuação.

Fluxo C: denúncia Gato
1. Jogador aciona botão Gato.
2. Servidor audita jogada denunciada.
3. Se correta: encerra partida com vitória da dupla acusadora.
4. Se incorreta: acusador perde o próximo turno.

### 11) Estados E Eventos (Nível Produto)
Estados de partida: lobby, setup-duplas, pronta, em-rodada, resultado-rodada, fim-partida.
Eventos do jogador: entrar sala, confirmar dupla, jogar pedra, comprar, passar, denunciar gato.
Eventos de sistema: sincronização de estado, troca de turno, validação de jogada, resolução de denúncia, reconexão.

### 12) UX/UI
- Mesa com 4 assentos posicionados em norte/leste/sul/oeste.
- Mão do próprio jogador visível; terceiros apenas verso e contagem.
- Destaque forte de turno ativo.
- Barra de ação contextual (jogar/comprar/passar/gato).
- Animações de distribuição, jogada na mesa, compra e denúncia.
- Direção visual: minimalista esportiva.

### 13) Métricas De Sucesso
- Taxa de partidas iniciadas com 4 jogadores sem erro de sincronização.
- Taxa de reconexão bem-sucedida no meio da rodada.
- Tempo médio por rodada em faixa aceitável.
- Baixa taxa de denúncias Gato com erro de sistema.
- Satisfação de clareza visual da mesa em desktop/mobile.

### 14) Critérios De Aceite
CA-01: Não inicia sem 4 jogadores e 2 duplas confirmadas.
CA-02: Distribui 6 pedras por jogador corretamente.
CA-03: Ocultação de mão de terceiros funciona em todos os clientes.
CA-04: Jogada incompatível não é aceita pelo servidor.
CA-05: Gato correto encerra com vitória imediata da dupla acusadora.
CA-06: Gato incorreto aplica perda de turno só ao acusador.
CA-07: Pontuação acumulada por dupla atualiza no fim da rodada.
CA-08: Responsividade e animações funcionam em desktop e mobile.

### 15) Riscos
- Divergência de regras regionais de dominó clássico.
- Complexidade de sincronização em 4 clientes com reconexão.
- Ambiguidade do critério final de pontuação se não fechar definição.

### 16) Dependências Técnicas
- Refatorar servidor para engine por modo.
- Expandir contrato de eventos Socket.IO para dominó.
- Novos componentes de mesa e pedra no frontend React.
- Ajustes de estilos globais para tema e responsividade.

### 17) Pendência Aberta (Necessita Definição)
- Regra exata de encerramento da partida em pontuação acumulada: alvo de pontos ou condição alternativa.

### 18) Como Alterar Este PRD
1. Ajuste primeiro os itens P-01 a P-09 em "Parâmetros Editáveis".
2. Reflita as mudanças na seção "Regras De Negócio".
3. Revise "Critérios De Aceite" para manter testabilidade.
4. Se alteração impactar fluxo, atualize "Fluxos Principais" e "Riscos".
