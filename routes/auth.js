
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { storeTempUser, getTempUser, removeTempUser } = require('../utils/tempUsers');

// Middleware to redirect a user to the homepage if they are already logged in
function redirectIfLoggedIn(req, res, next) {
    if (req.session.user) {
        return res.redirect('/');
    }
    next();
}

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your email from .env
        pass: process.env.EMAIL_PASS  // Your app password from .env
    }
});

// GET /register - Display the registration page
router.get('/register', redirectIfLoggedIn, (req, res) => {
    res.render('register');
});

// POST /register - Handle new user registration
router.post('/register', redirectIfLoggedIn, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        return res.status(409).render('register', { error: 'A user with that email or username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const verificationToken = crypto.randomBytes(20).toString('hex');

    storeTempUser(verificationToken, {
        username,
        email,
        password: hashedPassword,
        verificationCode,
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Welcome! Please Verify Your Email',
        html: `
          <div style=\"font-family: sans-serif; text-align: center; color: #333;\">
            <h1 style=\"color: #007bff;\">Welcome to Our Community!</h1>
            <p>We're excited to have you on board. To complete your registration, please verify your email address using the code below.</p>
            <p style=\"font-size: 24px; font-weight: bold; color: #28a745;\">${verificationCode}</p>
            <p>This code will expire in <strong>1 minute</strong>.</p>
            <p>If you did not create an account, please disregard this email.</p>
            <hr>
            <p style=\"font-size: 0.8em; color: #666;\">Thank you for joining us!</p>
          </div>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending verification email:', error);
            return res.status(500).render('register', { error: 'An error occurred while sending the verification email.' });
        }
        res.redirect(`/verify?token=${verificationToken}`);
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).render('register', { error: 'An error occurred during registration.' });
  }
});

// GET /verify - Display the verification page
router.get('/verify', (req, res) => {
    const { token } = req.query;
    if (!token || !getTempUser(token)) {
        return res.redirect('/register');
    }
    res.render('verify', { token });
});

// POST /verify - Handle email verification
router.post('/verify', async (req, res) => {
    const { token, code } = req.body;
    const tempUser = getTempUser(token);

    if (!tempUser || (Date.now() - tempUser.timestamp) > 60000) {
        if(tempUser) removeTempUser(token);
        return res.render('verify', { error: 'Verification code has expired. Please register again.', token: null });
    }

    if (tempUser.verificationCode !== code.toUpperCase()) {
        return res.render('verify', { error: 'Invalid verification code.', token });
    }

    try {
        const { username, email, password } = tempUser;
        const user = new User({ username, email, password, isVerified: true });
        await user.save();
        removeTempUser(token);
        req.session.user = { id: user._id, username: user.username, profilePicture: user.profilePicture };
        res.redirect('/');
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).render('verify', { error: 'An error occurred during verification.', token });
    }
});


// GET /login - Display the login page
router.get('/login', redirectIfLoggedIn, (req, res) => {
    res.render('login');
});

// POST /login - Handle user login
router.post('/login', redirectIfLoggedIn, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
        if (!user.isVerified) {
            return res.status(401).render('login', { error: 'Please verify your email before logging in.' });
        }
      // Store user information in the session
      req.session.user = { id: user._id, username: user.username, profilePicture: user.profilePicture };
      res.redirect('/');
    } else {
      // Render login page again with an error message
      res.status(401).render('login', { error: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login', { error: 'An error occurred during login.' });
  }
});

// GET /logout - Handle user logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
        console.error("Logout error:", err);
        return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;
