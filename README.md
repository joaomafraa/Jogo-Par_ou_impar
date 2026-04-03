# Jogo-Par_ou_impar

Jogo online de Impar ou Par com React, Tailwind, Framer Motion e Socket.IO.

## Rodando localmente

```bash
npm install
npm run dev
```

- Frontend Vite: `http://localhost:5173`
- Servidor realtime: `http://localhost:3001`

## Build de producao

```bash
npm run build
npm start
```

Depois do build, o mesmo servidor Node entrega os arquivos do `dist` e o Socket.IO no mesmo dominio.

## Como hospedar

### Render / Railway / VPS

1. Configure o comando de build:

```bash
npm install && npm run build
```

2. Configure o comando de start:

```bash
npm start
```

3. Defina a porta pela variavel `PORT` da plataforma.

## Fluxo do jogo

- Ate 2 jogadores na sala.
- Os dois clicam em `Ready`.
- A rodada comeca com timer de 10 segundos.
- Cada jogador escolhe um numero de `0` a `5` e um lado: `Impar` ou `Par`.
- Se alguem nao enviar no tempo, o servidor gera uma jogada automatica.
- O resultado sai para os dois clientes ao mesmo tempo.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Express + Socket.IO
