import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import whatsappRoutes from './whatsapp';
import healthRoutes from './health';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Static files
app.use('/public', express.static(path.join(__dirname, '../public')));

// Routes
app.get('/', (req: Request, res: Response) => {
  res.render('index', {
    title: 'ShardoX API',
    description: 'Professional WhatsApp Bot API Service',
    version: '1.0.0'
  });
});

app.get('/dashboard', (req: Request, res: Response) => {
  res.render('dashboard', {
    title: 'Dashboard - ShardoX API',
    user: { name: 'Admin' }
  });
});

app.get('/api-docs', (req: Request, res: Response) => {
  res.render('api', {
    title: 'API Documentation - ShardoX API',
    endpoints: [
      { method: 'POST', path: '/api/whatsapp/send', description: 'Send message' },
      { method: 'POST', path: '/api/whatsapp/send-bulk', description: 'Send bulk messages' },
      { method: 'GET', path: '/api/whatsapp/status', description: 'Check WhatsApp status' },
      { method: 'POST', path: '/api/whatsapp/group/create', description: 'Create group' },
      { method: 'GET', path: '/api/whatsapp/contacts', description: 'Get contacts' }
    ]
  });
});

// API Routes
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/health', healthRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).render('error', {
    title: '404 - Not Found',
    message: 'The requested resource was not found.'
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: '500 - Internal Server Error',
    message: 'An unexpected error occurred.'
  });
});

// Start server only if not in Vercel
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`ShardoX API running on http://localhost:${PORT}`);
  });
}

export default app;