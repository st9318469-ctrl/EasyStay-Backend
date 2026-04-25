import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    default: null,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  role: {
    type: String,
    default: 'user',
  },

  // Email verification
  isEmailVerified: { type: Boolean, default: false },

  // Backwards-compat fields (some older controllers used these)
  isVerified: { type: Boolean, default: false },
  otpCode: String,
  otp: String,
  otpExpires: Date,
  otpAttempts: { type: Number, default: 0 },

  // Reset password (OTP / token)
  resetPasswordOTP: {
    code: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  createdAt: {
    type: Date,
    default: Date.now,
  },
    avatar: {
        type: String,
        default: ""
    },
    phone: {
        type: String,
        default: ""
    },
    bio: {
        type: String,
        maxlength: 200,
        default: ""
    },
    location: {
        type: String,
        default: ""
    },
    joinedDate: {
        type: Date,
        default: Date.now
    },

    // Account settings
    emailNotifications: {
        bookingConfirmation: { type: Boolean, default: true },
        promotionalEmails: { type: Boolean, default: false },
        bookingReminders: { type: Boolean, default: true }
    },
    privacySettings: {
        showEmail: { type: Boolean, default: false },
        showPhone: { type: Boolean, default: false },
        profileVisibility: {
            type: String,
            enum: ['public', 'private', 'hosts-only'],
            default: 'public'
        }
    },
    preferredLanguage: {
        type: String,
        default: 'en'
    },
    preferredCurrency: {
        type: String,
        default: 'INR'
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata'
    },
    isTwoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: String,
    deviceTokens: [String],
    lastActive: Date
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.generateToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

userSchema.methods.generateOTP = function () {
  const otpValue = Math.floor(100000 + Math.random() * 900000).toString();
  this.otpCode = otpValue;
  this.otp = otpValue;
  this.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  this.otpAttempts = 0;
  return otpValue;
};

userSchema.methods.verifyOTP = function (otpValue) {
  const stored = this.otpCode || this.otp;
  if (!stored) return false;
  if (!this.otpExpires || this.otpExpires < Date.now()) return false;
  if ((this.otpAttempts || 0) >= 3) return false;

  if (String(stored) !== String(otpValue)) {
    this.otpAttempts = (this.otpAttempts || 0) + 1;
    return false;
  }

  return true;
};

userSchema.methods.clearOTP = function () {
  this.otpCode = undefined;
  this.otp = undefined;
  this.otpExpires = undefined;
  this.otpAttempts = 0;
};

userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    isEmailVerified: Boolean(this.isEmailVerified || this.isVerified),
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);
export default User;
