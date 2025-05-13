const mongoose = require('mongoose');

// Connection options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // Increase timeout for deployment
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 5,  // Minimum number of connections in the pool
  retryWrites: true,
  w: 'majority',
  heartbeatFrequencyMS: 2000, // Check server status every 2 seconds
  connectTimeoutMS: 30000, // Give up initial connection after 30 seconds
};

// Connection state
let isConnected = false;
let isConnecting = false;
let retryCount = 0;
const MAX_RETRIES = 10; // Increase max retries for deployment
const RETRY_DELAY = 5000; // 5 seconds between retries

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
    
    // Get MongoDB URI from environment
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Attempting to connect to MongoDB Atlas...');
    await mongoose.connect(mongoURI, options);
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    isConnecting = false;
    
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Retrying connection (${retryCount}/${MAX_RETRIES}) in ${RETRY_DELAY/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDB(); // Retry connection
    } else {
      console.error('Max retry attempts reached. Please check your database connection.');
      throw new Error('Failed to connect to MongoDB after multiple attempts');
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

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during MongoDB disconnection:', err);
    process.exit(1);
  }
});

module.exports = {
  connectDB,
  checkConnection,
  connection: mongoose.connection
}; 