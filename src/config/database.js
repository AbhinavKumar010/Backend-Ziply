const mongoose = require('mongoose');

// Connection options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  family: 4 // Use IPv4, skip trying IPv6
};

// Connection state
let isConnected = false;
let isConnecting = false;
let retryCount = 0;
const MAX_RETRIES = 5;

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
  isConnected = true;
  isConnecting = false;
  retryCount = 0;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  isConnected = false;
  isConnecting = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  isConnected = false;
  isConnecting = false;
});

// Function to establish database connection
const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  if (isConnecting) {
    console.log('Connection attempt already in progress');
    return;
  }

  try {
    isConnecting = true;
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ziply', options);
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    isConnecting = false;
    
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Retrying connection (${retryCount}/${MAX_RETRIES})...`);
      setTimeout(connectDB, 5000); // Retry after 5 seconds
    } else {
      console.error('Max retry attempts reached. Please check your database connection.');
      process.exit(1);
    }
  }
};

// Function to check database connection
const checkConnection = () => {
  if (!isConnected) {
    throw new Error('Database connection not established');
  }
  return true;
};

module.exports = {
  connectDB,
  checkConnection,
  connection: mongoose.connection
}; 