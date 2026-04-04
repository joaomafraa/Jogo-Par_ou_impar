# Jogo-Par_ou_impar

Jogo online de Par ou Impar em tempo real para 2 jogadores, com interface animada e comunicacao via WebSocket.

https://impar-par.onrender.com

## Sobre o projeto

Este projeto foi construido para oferecer uma experiencia simples, rapida e divertida de Par ou Impar no navegador.
O frontend foi feito com React + Vite e o backend usa Express + Socket.IO para sincronizar os dois jogadores em tempo real.

## Funcionalidades principais

- Sala com ate 2 jogadores conectados ao mesmo tempo.
- Sistema de prontidao (Ready) para iniciar a rodada.
- Timer por rodada para manter o ritmo da partida.
- Escolha de numero (0 a 5) e lado (Par ou Impar).
- Jogada automatica caso um jogador nao responda no tempo.
- Resultado sincronizado para os dois clientes.
- Interface com componentes reutilizaveis e animacoes para feedback visual.

## Regras do jogo

1. Entram no maximo 2 jogadores por sala.
2. Os dois precisam marcar Ready para a rodada iniciar.
3. Cada jogador escolhe:
	 - Um numero de 0 a 5.
	 - Um lado: Par ou Impar.
4. Ao final do timer (ou quando ambos enviam), o servidor calcula o resultado.
5. Se alguem nao enviar a escolha a tempo, o servidor completa a jogada automaticamente.
6. O resultado final e exibido para todos ao mesmo tempo.

## Tecnologias

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Node.js + Express
- Socket.IO

## Como executar localmente

### Requisitos

- Node.js 18+ (recomendado)
- npm

### Instalar dependencias

```bash
npm install
```

### Rodar em desenvolvimento

```bash
npm run dev
```

Endpoints locais:

- Frontend (Vite): http://localhost:5173
- Servidor realtime: http://localhost:3001

## Scripts disponiveis

- npm run dev: sobe o ambiente de desenvolvimento.
- npm run build: gera os arquivos otimizados de producao.
- npm start: inicia o servidor Node para servir o build e o Socket.IO.

## Build e execucao em producao

```bash
npm run build
npm start
```

Depois do build, o servidor Node entrega os arquivos do dist e o Socket.IO no mesmo dominio.

## Estrutura do projeto

```
Jogo-Par_ou_impar/
	server/
		server.js              # Servidor HTTP + Socket.IO
	src/
		components/ui/         # Componentes visuais do jogo
		styles/                # Estilos globais
		App.tsx                # Fluxo principal da interface
		main.tsx               # Bootstrap da aplicacao React
```

## Deploy (Render, Railway, VPS)

1. Comando de build:

```bash
npm install && npm run build
```

2. Comando de start:

```bash
npm start
```

3. Configure a variavel de ambiente PORT na plataforma.

## Pontos de evolucao

- Historico de rodadas e placar acumulado.
- Salas privadas com codigo de convite.
- Reconexao de jogador apos queda de internet.
- Testes automatizados para regras de jogo e eventos Socket.IO.
- Observabilidade basica (logs estruturados e metricas).
