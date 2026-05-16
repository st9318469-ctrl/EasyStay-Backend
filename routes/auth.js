import express from 'express';
import {
  register,
  login,
  getMe,
  logout,
  verifyEmail,
  resendOTP,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  resendResetOTP,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth_middleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);
router.post('/resend-reset-otp', resendResetOTP);

// Backward-compatible aliases (frontend/deploy mismatch safety)
router.post('/forgotpassword', forgotPassword);
router.post('/verify-resetotp', verifyResetOTP);
router.post('/resetpassword', resetPassword);
router.post('/resend-resetotp', resendResetOTP);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

export default router;
