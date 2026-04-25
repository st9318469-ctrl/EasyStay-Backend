import User from '../models/user_model.js';
import { sendEmailOTP, sendWelcomeEmail, testEmailConnection } from '../services/emailService.js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const normalizeEmail = (email) => (email || '').toLowerCase().trim();
const isDevMode = process.env.NODE_ENV !== 'production';

const createTransporter = () => {
  const password = process.env.EMAIL_PASS?.replace(/\s/g, '');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: password,
    },
  });
};

const logOTP = (email, otp) => {
  console.log('\n===== EMAIL VERIFICATION OTP =====');
  console.log('Email:', email);
  console.log('OTP:  ', otp);
  console.log('==================================\n');
};

export const testEmail = async (req, res) => {
  const ok = await testEmailConnection();
  return res.json({
    success: ok,
    message: ok ? 'Email service is ready' : 'Email service failed',
    emailUser: process.env.EMAIL_USER,
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    const user = new User({
      name,
      email: normalizedEmail,
      password,
      phone: phone ? String(phone).trim() : null,
      role: role || 'user',
    });

    const otp = user.generateOTP();
    await user.save();

    // Always log OTP for development convenience.
    logOTP(normalizedEmail, otp);

    const emailResult = await sendEmailOTP(normalizedEmail, otp, name);
    if (!emailResult.success) {
      console.error('Email failed:', emailResult.error);
      return res.status(201).json({
        success: true,
        message:
          "Registration successful! But we couldn't send the OTP email. Please check your email settings or contact support.",
        requiresVerification: true,
        email: user.email,
        userId: user._id,
        emailSendError: emailResult.error,
        otpForDebug: isDevMode ? otp : undefined,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please verify your email.',
      requiresVerification: true,
      email: user.email,
      userId: user._id,
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isEmailVerified || user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified',
      });
    }

    const isValid = user.verifyOTP(otp);
    if (!isValid) {
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    user.isEmailVerified = true;
    user.isVerified = true;
    user.clearOTP();
    await user.save();

    const welcomeResult = await sendWelcomeEmail(normalizedEmail, user.name);
    if (welcomeResult && welcomeResult.success === false) {
      console.error('Welcome email failed:', welcomeResult.error);
    }

    const token = user.generateToken();
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Verification failed',
    });
  }
};

// Backwards-compatible alias (some clients call this verifyOTP)
export const verifyOTP = verifyEmail;

export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isEmailVerified || user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified',
      });
    }

    const otp = user.generateOTP();
    await user.save();
    logOTP(normalizedEmail, otp);

    const emailResult = await sendEmailOTP(normalizedEmail, otp, user.name);
    if (!emailResult.success) {
      console.error('Email failed:', emailResult.error);
      return res.status(200).json({
        success: true,
        message: 'OTP generated, but email delivery failed. Use debug OTP in development.',
        emailSendError: emailResult.error,
        otpForDebug: isDevMode ? otp : undefined,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'New OTP sent to your email',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend OTP',
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.isEmailVerified && !user.isVerified) {
      const otp = user.generateOTP();
      await user.save();
      logOTP(normalizedEmail, otp);

      const emailResult = await sendEmailOTP(normalizedEmail, otp, user.name);
      if (!emailResult.success) {
        console.error('Email failed:', emailResult.error);
      }

      return res.status(403).json({
        success: false,
        requiresVerification: true,
        message: 'Please verify your email first. A new OTP has been sent.',
        email: user.email,
        emailSendError: emailResult.success ? undefined : emailResult.error,
        otpForDebug: isDevMode ? otp : undefined,
      });
    }

    const token = user.generateToken();
    return res.status(200).json({
      success: true,
      token,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
};

export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    return res.status(200).json({ success: true, user: req.user });
  } catch {
    return res.status(500).json({ success: false, message: 'Error fetching user' });
  }
};

export const logout = async (req, res) => {
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// Forgot Password - Send OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email address',
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        message: 'Email service is not configured',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordOTP = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    };
    await user.save();

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"EasyStay" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: 'Reset Your Password - EasyStay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto;">
          <div style="background:#1A1A18;color:#FAFAF8;padding:24px 18px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-family:Georgia,serif;">EasyStay</h1>
            <p style="margin:6px 0 0;opacity:.85;">Password Reset Request</p>
          </div>
          <div style="background:#fff;padding:28px 20px;border:1px solid rgba(26,26,24,.12);border-top:none;border-radius:0 0 12px 12px;">
            <p>Hello ${user.name || 'User'},</p>
            <p>Use the OTP below to reset your password:</p>
            <div style="background:#F1EFE8;padding:18px;text-align:center;font-size:32px;font-weight:800;letter-spacing:6px;border-radius:10px;">
              ${otp}
            </div>
            <p style="margin-top:18px;">This OTP is valid for <strong>10 minutes</strong>.</p>
            <p style="font-size:12px;color:#666;margin-top:18px;">
              If you didn’t request this, you can ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: 'Password reset OTP sent to your email',
      email: user.email,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to send reset email',
    });
  }
};

// Verify Reset OTP
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const otpValue = String(otp || '').trim();

    if (!normalizedEmail || !otpValue) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.resetPasswordOTP || !user.resetPasswordOTP.code) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new one.',
      });
    }

    if (user.resetPasswordOTP.expiresAt && user.resetPasswordOTP.expiresAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    if ((user.resetPasswordOTP.attempts || 0) >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.',
      });
    }

    if (String(user.resetPasswordOTP.code) !== otpValue) {
      user.resetPasswordOTP.attempts = (user.resetPasswordOTP.attempts || 0) + 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }

    const resetToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '10m' }
    );

    user.resetPasswordOTP = undefined;
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    return res.json({
      success: true,
      message: 'OTP verified successfully',
      resetToken,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide token and new password',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Resend Reset OTP
export const resendResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        message: 'Email service is not configured',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordOTP = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    };
    await user.save();

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"EasyStay" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: 'New Password Reset OTP - EasyStay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Your new OTP is:</p>
          <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 28px; font-weight: bold;">
            ${otp}
          </div>
          <p>Valid for 10 minutes.</p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: 'New OTP sent to your email',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
