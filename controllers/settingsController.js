import bcrypt from 'bcryptjs';
import User from '../models/user_model.js';
import Booking from '../models/Booking.js';
import Property from '../models/property.js';
import Review from '../models/Review.js';
import Wishlist from '../models/Wishlist.js';

// Get account settings
export const getSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            settings: {
                profile: {
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    bio: user.bio,
                    location: user.location,
                    avatar: user.avatar
                },
                notifications: user.emailNotifications,
                privacy: user.privacySettings,
                preferences: {
                    language: user.preferredLanguage,
                    currency: user.preferredCurrency,
                    timezone: user.timezone
                },
                security: {
                    isTwoFactorEnabled: user.isTwoFactorEnabled,
                    lastLogin: user.lastActive || null
                },
                memberSince: user.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update profile settings
export const updateProfileSettings = async (req, res) => {
    try {
        const { name, phone, bio, location, avatar } = req.body || {};

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (name !== undefined) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (bio !== undefined) user.bio = bio;
        if (location !== undefined) user.location = location;
        if (avatar !== undefined) user.avatar = avatar;
        user.lastActive = new Date();

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                bio: user.bio,
                location: user.location,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update notification settings
export const updateNotificationSettings = async (req, res) => {
    try {
        const { bookingConfirmation, promotionalEmails, bookingReminders } = req.body || {};

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.emailNotifications = {
            bookingConfirmation: bookingConfirmation ?? user.emailNotifications?.bookingConfirmation ?? true,
            promotionalEmails: promotionalEmails ?? user.emailNotifications?.promotionalEmails ?? false,
            bookingReminders: bookingReminders ?? user.emailNotifications?.bookingReminders ?? true
        };
        user.lastActive = new Date();

        await user.save();

        res.json({
            success: true,
            message: 'Notification settings updated',
            settings: user.emailNotifications
        });
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update privacy settings
export const updatePrivacySettings = async (req, res) => {
    try {
        const { showEmail, showPhone, profileVisibility } = req.body || {};

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.privacySettings = {
            showEmail: showEmail ?? user.privacySettings?.showEmail ?? false,
            showPhone: showPhone ?? user.privacySettings?.showPhone ?? false,
            profileVisibility: profileVisibility || user.privacySettings?.profileVisibility || 'public'
        };
        user.lastActive = new Date();

        await user.save();

        res.json({
            success: true,
            message: 'Privacy settings updated',
            settings: user.privacySettings
        });
    } catch (error) {
        console.error('Error updating privacy settings:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update preferences
export const updatePreferences = async (req, res) => {
    try {
        const { language, currency, timezone } = req.body || {};

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (language) user.preferredLanguage = language;
        if (currency) user.preferredCurrency = currency;
        if (timezone) user.timezone = timezone;
        user.lastActive = new Date();

        await user.save();

        res.json({
            success: true,
            message: 'Preferences updated',
            preferences: {
                language: user.preferredLanguage,
                currency: user.preferredCurrency,
                timezone: user.timezone
            }
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete account
export const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body || {};

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required'
            });
        }

        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect password'
            });
        }

        await Booking.deleteMany({ user: user._id });
        await Property.deleteMany({ host: user._id });
        await Review.deleteMany({ user: user._id });
        await Wishlist.deleteMany({ user: user._id });
        await user.deleteOne();

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get account activity
export const getAccountActivity = async (req, res) => {
    try {
        const userId = req.user.id;

        const recentBookings = await Booking.find({ user: userId })
            .populate('property', 'title images')
            .sort('-createdAt')
            .limit(5);

        const recentReviews = await Review.find({ user: userId })
            .populate('property', 'title')
            .sort('-createdAt')
            .limit(5);

        const totalBookings = await Booking.countDocuments({ user: userId });
        const totalReviews = await Review.countDocuments({ user: userId });
        const loginHistory = [
            { date: new Date(), ip: req.ip, device: req.headers['user-agent'] }
        ];

        res.json({
            success: true,
            activity: {
                recentBookings,
                recentReviews,
                loginHistory,
                totalBookings,
                totalReviews
            }
        });
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
