import rateLimit from 'express-rate-limit';

export const createRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 3,
  message: 'Too many requests from this IP, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
});

export const likeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 30,
  message: 'Too many likes, please try again later',
});

export const contributeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many asset uploads, please try again later',
});