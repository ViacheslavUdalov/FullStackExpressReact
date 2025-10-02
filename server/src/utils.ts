import { Request } from 'express';

export function getClientIp(req: Request): string {
    const xf = req.header('x-forwarded-for');
    if (xf) {
        const parts = xf.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length > 0) return parts[0];
    }
    const ra = req.socket.remoteAddress || '';
    return ra.replace(/^::ffff:/, '');
}
