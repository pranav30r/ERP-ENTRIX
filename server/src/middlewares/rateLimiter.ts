import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: process.env.NODE_ENV === 'test' ? 1000 : 15, // Max 15 login attempts per window per IP in production/development
  standardHeaders: true, // Return RateLimit-* headers (draft-6 / draft-7 RFC)
  legacyHeaders: false, // Disable X-RateLimit-* headers
  statusCode: 429,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1-minute window
  max: process.env.NODE_ENV === 'test' ? 5000 : 300, // 300 requests per minute general API limit
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    error: 'API rate limit exceeded. Please throttle your requests.'
  }
});
