const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { connectDB, checkConnection } = require('./config/database');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Make io accessible to our router
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Set proper MIME types
app.use((req, res, next) => {
  if (req.url.endsWith('.js')) {
    res.type('application/javascript');
  } else if (req.url.endsWith('.mjs')) {
    res.type('application/javascript');
  } else if (req.url.endsWith('.jsx')) {
    res.type('application/javascript');
  }
  next();
});

// Serve static files from the client build directory if in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath, {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.jsx')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
    }
  }));

  // Handle client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    checkConnection();
    next();
  } catch (error) {
    console.error('Database connection check failed:', error);
    res.status(503).json({ message: 'Database connection not available' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });

  // Handle order status updates
  socket.on('orderStatusUpdate', (data) => {
    io.emit('orderStatusChanged', data);
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/users', require('./routes/users'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server function
const startServer = async () => {
  try {
    // First connect to database
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    // Then start the server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();