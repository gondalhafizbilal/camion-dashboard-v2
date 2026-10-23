This is an admin dashboard built with Next.js (App Router).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
For this project, the default app port is `3001`.

## Environment

Copy and adjust environment values:

```bash
cp .env.example .env.local
```

Required values:

- `API_URL`
- `NEXT_PUBLIC_API_URL`

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build -d
```

If you need custom backend URLs, export env vars before running:

```bash
export API_URL=http://localhost:3005
export NEXT_PUBLIC_API_URL=http://localhost:3005
docker compose up --build -d
```

For Git: keep real env values out of the repo and only commit template files (`.env.example`, `.env.docker.example`).

App will be available at:

- [http://localhost:3001](http://localhost:3001)

Stop:

```bash
docker compose down
```

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
