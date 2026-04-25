import User from '../models/user_model.js';
import { sendOTPEmail } from '../services/emailService.js';

// Register
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Create user
        const user = new User({ name, email, password });
        
        // Generate OTP
        const otp = user.generateOTP();
        await user.save();

        // Send OTP email
        await sendOTPEmail(email, otp, name);

        res.status(201).json({
            success: true,
            message: 'Registration successful! Please verify OTP.',
            email: user.email,
            otpForTesting: otp // Remove this in production, but useful for college demo
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Verify OTP
export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Already verified' });
        }

        // Check OTP
        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Verify user
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        // Generate token
        const token = user.generateToken();

        res.json({
            success: true,
            message: 'Email verified successfully!',
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select('+password');
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        if (!user.isVerified) {
            // Generate and send new OTP
            const otp = user.generateOTP();
            await user.save();
            await sendOTPEmail(email, otp, user.name);
            
            return res.status(403).json({
                success: false,
                message: 'Please verify your email first. New OTP sent.',
                requiresVerification: true,
                email: user.email
            });
        }

        const token = user.generateToken();
        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Resend OTP
export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Already verified' });
        }

        const otp = user.generateOTP();
        await user.save();
        await sendOTPEmail(email, otp, user.name);

        res.json({ success: true, message: 'New OTP sent to your email' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
