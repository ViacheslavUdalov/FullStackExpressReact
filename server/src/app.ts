// src/app.ts
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import ideasRouter from './routes/main';
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' }));
if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
}

app.use('/api/ideas', ideasRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

export default app;
