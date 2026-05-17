const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { initSocket } = require('./socket');

const adminRoute = require('./routes/admin.route');
const residentRoute = require('./routes/resident.route');
const authRoute = require('./routes/auth.route');
const gateRoute = require('./routes/gate.route');

const app = express();  

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:5173', 
  'http://127.0.0.1:5073',
  process.env.FRONTEND_URL 
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS configuration'));
    }
  },
  credentials: true,               
  methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// API Routes routing mapping
app.use('/api', authRoute);
app.use('/resident', residentRoute);
app.use('/admin', adminRoute);
app.use('/gate', gateRoute);

// Pull parameters explicitly from environment variables
const DB_PATH = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

if (!DB_PATH) {
  console.error("FATAL INITIALIZATION ERROR: process.env.MONGO_URI is missing.");
  process.exit(1);
}

// Database connectivity and Server execution context
mongoose.connect(DB_PATH)
  .then(() => {
    console.log("Database connection established successfully.");

    const server = http.createServer(app);

    // Initialize Socket engine attachments
    initSocket(server);

    server.listen(PORT, "0.0.0.0", (err) => {
       if (err) {
         console.error("Failed to start server framework:", err);
         return;
       }
       console.log(`Application layer actively running on port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Critical infrastructure error during database bootstrap:", err);
  });