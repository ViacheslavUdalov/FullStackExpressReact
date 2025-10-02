import express, { Request, Response } from 'express';
import {getClientIp} from "../utils";
import pool from "../db";

const router = express.Router();

const VOTE_LIMIT = 10;
const RETRY_ATTEMPTS = 5;

router.get('/', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    console.log(`ip`, ip)
console.log(`pool`, pool)
    const client = await pool.connect();
    try {
        const remRes = await client.query(
            'SELECT COUNT(DISTINCT idea_id) as cnt FROM votes WHERE ip_address = $1',
            [ip]
        );
        const used = Number(remRes.rows[0]?.cnt || 0);
        const remaining = Math.max(0, VOTE_LIMIT - used);

        const q = `
      SELECT i.id, i.title, i.description, COALESCE(vc.votes,0) as votes,
             CASE WHEN uv.ip_address IS NULL THEN false ELSE true END as voted
      FROM ideas i
      LEFT JOIN (
        SELECT idea_id, COUNT(*) as votes FROM votes GROUP BY idea_id
      ) vc ON vc.idea_id = i.id
      LEFT JOIN (
        SELECT idea_id, ip_address FROM votes WHERE ip_address = $1
      ) uv ON uv.idea_id = i.id
      ORDER BY votes DESC, i.id ASC
    `;
        const ideasRes = await client.query(q, [ip]);
        res.json({ remaining, ideas: ideasRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal error' });
    } finally {
        client.release();
    }
});

router.post('/:id/vote', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const ideaId = Number(req.params.id);
    if (!ideaId) return res.status(400).json({ message: 'Invalid idea id' });

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

            const dup = await client.query(
                'SELECT 1 FROM votes WHERE idea_id = $1 AND ip_address = $2 LIMIT 1',
                [ideaId, ip]
            );
            if (dup.rowCount && dup.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'Вы уже голосовали за эту идею' });
            }

            const cntRes = await client.query(
                'SELECT COUNT(DISTINCT idea_id) as cnt FROM votes WHERE ip_address = $1',
                [ip]
            );
            const used = Number(cntRes.rows[0]?.cnt || 0);
            if (used >= VOTE_LIMIT) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'Лимит голосов с этого IP исчерпан' });
            }

            await client.query(
                'INSERT INTO votes (idea_id, ip_address) VALUES ($1, $2)',
                [ideaId, ip]
            );

            await client.query('COMMIT');

            const votesRes = await pool.query('SELECT COUNT(*) as cnt FROM votes WHERE idea_id = $1', [ideaId]);
            const votes = Number(votesRes.rows[0]?.cnt || 0);
            return res.json({ message: 'Голос учтён', votes });
        } catch (err: any) {
            await client.query('ROLLBACK');
            if (err && (err.code === '40001' || err.code === '40P01')) {
                console.warn(`Serialization failure, attempt ${attempt} - retrying`);
                client.release();
                if (attempt === RETRY_ATTEMPTS) {
                    return res.status(500).json({ message: 'Попробуйте ещё раз (перегружено)' });
                }
                await new Promise(r => setTimeout(r, 50 * attempt));
                continue;
            }

            if (err && err.code === '23505') {
                return res.status(409).json({ message: 'Вы уже голосовали за эту идею' });
            }

            console.error(err);
            return res.status(500).json({ message: 'Internal error' });
        } finally {
            try { client.release(); } catch (e) {}
        }
    }
});

export default router;
