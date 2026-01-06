# Particle Synth

Interactive particle synth toy. Click/tap and drag to spawn particles and make sounds. (triggers something in me idk if it does for you)


- **X axis** → pitch
- **Y axis** → filter/detune

## Run with Docker

```bash
cp .env.example .env
#edit .env if you want a different port
docker compose up -d --build
```

Default port is 3000. Set `PORT` in your `.env` to change it.

## Development

```bash
npm install
npm run dev
```

## Build manually

```bash
npm run build
```

Output goes to `dist/`.