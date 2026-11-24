const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Error handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Initialize default categories
async function initializeCategories() {
  const categories = [
    { name: 'General', icon: '💬', description: 'General discussion' },
    { name: 'Support', icon: '🆘', description: 'Get help and support' },
    { name: 'Strategies', icon: '📊', description: 'Trading strategies discussion' }
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category
    });
  }
}

// Routes

// Get all categories
app.get('/api/categories', asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { messages: true }
      }
    }
  });
  
  res.json(categories);
}));

// Get messages by category
app.get('/api/messages/:categoryId', asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  
  const messages = await prisma.message.findMany({
    where: { categoryId: parseInt(categoryId) },
    include: {
      user: true,
      replyTo: {
        include: { user: true }
      },
      attachments: true
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  
  res.json(messages.reverse());
}));

// Create a new message
app.post('/api/messages', asyncHandler(async (req, res) => {
  const { userId, categoryId, content, replyToId, attachments } = req.body;
  
  const message = await prisma.message.create({
    data: {
      userId: parseInt(userId),
      categoryId: parseInt(categoryId),
      content,
      replyToId: replyToId ? parseInt(replyToId) : null,
      attachments: attachments ? {
        create: attachments.map(att => ({
          type: att.type,
          url: att.url,
          name: att.name
        }))
      } : undefined
    },
    include: {
      user: true,
      replyTo: {
        include: { user: true }
      },
      attachments: true
    }
  });
  
  res.json(message);
}));

// Get user by loginId
app.get('/api/users/by-login/:loginId', asyncHandler(async (req, res) => {
  const { loginId } = req.params;
  
  const user = await prisma.user.findUnique({
    where: { loginId }
  });
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
}));

// Register/Create a new user
app.post('/api/users', asyncHandler(async (req, res) => {
  const { loginId, username, email, avatar } = req.body;
  
  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { loginId }
  });
  
  if (user) {
    return res.json(user);
  }
  
  // Create new user
  user = await prisma.user.create({
    data: {
      loginId,
      username,
      email,
      avatar
    }
  });
  
  res.json(user);
}));

// Get user profile with stats
app.get('/api/users/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
    include: {
      _count: {
        select: { messages: true }
      }
    }
  });
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
const PORT = process.env.COMMUNITY_API_PORT || 3001;

async function startServer() {
  try {
    // Initialize categories on startup
    await initializeCategories();
    console.log('✓ Default categories initialized');
    
    app.listen(PORT, () => {
      console.log(`✓ Community API server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});
