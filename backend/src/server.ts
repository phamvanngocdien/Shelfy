import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';

dotenv.config();
connectDB();

import assetsRouter from './routes/assets.js';
import pfpRouter from './routes/pfp.js';
import contributeRouter from './routes/contribute.js';
import adminAssetsRouter from './routes/admin/assets.js';
import adminPfpRouter from './routes/admin/pfp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

// Trust proxy for rate limiter IP
app.set('trust proxy', 1);

/**
 * Recursively sanitize all string values in an object/array
 * to prevent XSS attacks on nested data structures.
 */
function deepSanitize(obj: any): any {
  if (typeof obj === 'string') return xss(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = deepSanitize(obj[key]);
    }
    return result;
  }
  return obj; // number, boolean, null → keep as-is
}

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());

// Deep XSS sanitization — handles nested objects and arrays
app.use((req, res, next) => {
  if (req.body) req.body = deepSanitize(req.body);
  next();
});

// Routes
app.use('/api/assets', assetsRouter);
app.use('/api/pfp', pfpRouter);
app.use('/api/contribute', contributeRouter);
app.use('/api/admin/assets', adminAssetsRouter);
app.use('/api/admin/pfp', adminPfpRouter);

// Global error handler — never leak internal details in production
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(500).json({ error: message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

io.on('connection', (socket) => {
  console.log('⚡ New client connected');
  socket.on('disconnect', () => console.log('⚡ Client disconnected'));
});