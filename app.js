
require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');

// --- Route Imports ---
const mainRoutes = require('./routes/main');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurdforest', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Error connecting to MongoDB', err);
});

// --- App Configuration & Middleware ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Expose the 'public' directory for static files
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session management
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace_this_with_a_real_secret_key',
  resave: false,
  saveUninitialized: false, // Optimized to not save empty sessions
  cookie: { 
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      maxAge: 1000 * 60 * 60 * 24 * 7 // Cookie expires in 1 week
  }
}));

// Middleware to make user data available in all EJS templates
app.use((req, res, next) => {
  res.locals.websiteName = process.env.WEBSITE_NAME || 'KurdForest';
  res.locals.currentPath = req.path;
  res.locals.user = req.session.user; // Pass session user to all views
  next();
});

// --- Route Definitions ---
app.use('/', authRoutes);      // Handles /login, /register, /logout
app.use('/', userRoutes);      // Handles /profile, /watchlist
app.use('/', mainRoutes);      // Handles core routes like /
app.use('/api', apiRoutes);    // Handles all API-specific routes

// --- Error Handling ---
// 404 handler for routes not found
app.use((req, res) => {
  res.status(404).render('404'); // Assumes you have a 404.ejs view
});

// General error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong on our end!');
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
