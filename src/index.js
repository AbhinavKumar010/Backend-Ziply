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

// Serve static files from the client build directory
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath, {
  setHeaders: (res, filePath) => {
    // Set proper MIME types based on file extension
    if (filePath.endsWith('.js')) {
      // Check if it's a module script
      if (filePath.includes('/assets/') || filePath.includes('/chunks/')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else {
        res.setHeader('Content-Type', 'text/javascript');
      }
    } else if (filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.jsx')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (filePath.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
    }
  },
  // Enable caching for static assets
  maxAge: '1y',
  // Don't send 304 responses
  etag: false,
  // Enable fallthrough to allow the catch-all route to handle 404s
  fallthrough: true
}));

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

// Handle client-side routing - serve index.html for all routes
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Check if the request is for a static file
  const staticFileExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.json'];
  const isStaticFile = staticFileExtensions.some(ext => req.path.endsWith(ext));
  
  if (isStaticFile) {
    // If it's a static file and we get here, it means the file wasn't found
    return res.status(404).json({ error: 'Static file not found' });
  }
  
  // For all other routes, serve the index.html
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).json({ error: 'Error serving index.html' });
    }
  });
});

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