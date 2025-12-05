const express = require('express');
const { body, validationResult } = require('express-validator');
const Coordinator = require('../models/Coordinator');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware
const validateLogin = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const validateRegister = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('department')
    .notEmpty()
    .withMessage('Department is required')
    .trim()
];

// @desc    Login coordinator
// @route   POST /api/auth/login
// @access  Public
router.post('/login', validateLogin, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }

  const { username, password } = req.body;

  // Find coordinator
  const coordinator = await Coordinator.findOne({
    $or: [
      { username: username.toLowerCase() },
      { email: username.toLowerCase() }
    ]
  });

  if (!coordinator) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid username or password'
    });
  }

  // Check if account is active
  if (!coordinator.isActive) {
    return res.status(401).json({
      error: 'Account deactivated',
      message: 'Your account has been deactivated. Please contact admin.'
    });
  }

  // Verify password
  const isPasswordValid = await coordinator.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid username or password'
    });
  }

  // Update last login
  await coordinator.updateLastLogin();

  // Generate token
  const token = generateToken(coordinator._id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      coordinator: coordinator.toJSON(),
      token,
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  });
}));

// @desc    Register new coordinator
// @route   POST /api/auth/register
// @access  Public (can be restricted to admin only)
router.post('/register', validateRegister, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }

  const { username, email, password, firstName, lastName, department, phoneNumber } = req.body;

  // Check if coordinator already exists
  const existingCoordinator = await Coordinator.findOne({
    $or: [
      { username: username.toLowerCase() },
      { email: email.toLowerCase() }
    ]
  });

  if (existingCoordinator) {
    return res.status(400).json({
      error: 'Registration failed',
      message: 'Username or email already exists'
    });
  }

  // Create new coordinator
  const coordinator = new Coordinator({
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
    department,
    phoneNumber
  });

  await coordinator.save();

  // Generate token
  const token = generateToken(coordinator._id);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      coordinator: coordinator.toJSON(),
      token,
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  });
}));

// @desc    Get current coordinator profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      coordinator: req.user
    }
  });
}));

// @desc    Logout coordinator
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // In a real application, you might want to blacklist the token
  // For now, we'll just send a success response
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
}));

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Private
router.post('/refresh', authenticateToken, asyncHandler(async (req, res) => {
  // Generate new token
  const token = generateToken(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      token,
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  });
}));

module.exports = router;