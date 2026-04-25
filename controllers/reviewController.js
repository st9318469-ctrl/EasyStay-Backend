import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Property from '../models/property.js';
import mongoose from 'mongoose';

// Create a review (only after completed stay)
export const createReview = async (req, res) => {
    try {
        const { propertyId, rating, comment } = req.body;
        const userId = req.user.id;

        // Check if user has completed a booking for this property
        const hasCompletedBooking = await Booking.findOne({
            property: propertyId,
            user: userId,
            status: 'completed',
            checkOut: { $lt: new Date() }
        });

        if (!hasCompletedBooking) {
            return res.status(403).json({
                success: false,
                message: 'You can only review properties you have stayed at'
            });
        }

        // Check if already reviewed
        const existingReview = await Review.findOne({
            property: propertyId,
            user: userId
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this property'
            });
        }

        // Create review
        const review = new Review({
            property: propertyId,
            user: userId,
            booking: hasCompletedBooking._id,
            rating,
            comment
        });

        await review.save();

        // Update property rating
        const allReviews = await Review.find({ property: propertyId });
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = totalRating / allReviews.length;

        await Property.findByIdAndUpdate(propertyId, {
            rating: averageRating,
            totalReviews: allReviews.length
        });

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully!',
            review
        });

    } catch (error) {
        console.error('Review error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get reviews for a property
export const getPropertyReviews = async (req, res) => {
    try {
        const { propertyId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(propertyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid property id'
            });
        }
        
        const reviews = await Review.find({ property: propertyId })
            .populate('user', 'name avatar')
            .sort('-createdAt');
        
        const ratingStats = await Review.aggregate([
            { $match: { property: new mongoose.Types.ObjectId(propertyId) } },
            { $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
            }}
        ]);
        
        res.json({
            success: true,
            reviews,
            stats: ratingStats[0] || {
                averageRating: 0,
                totalReviews: 0,
                fiveStar: 0,
                fourStar: 0,
                threeStar: 0,
                twoStar: 0,
                oneStar: 0
            }
        });
        
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Check if user can review
export const canReview = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const userId = req.user.id;
        
        const hasCompletedBooking = await Booking.findOne({
            property: propertyId,
            user: userId,
            status: 'completed',
            checkOut: { $lt: new Date() }
        });
        
        const alreadyReviewed = await Review.findOne({
            property: propertyId,
            user: userId
        });
        
        res.json({
            success: true,
            canReview: !!hasCompletedBooking && !alreadyReviewed,
            hasCompletedBooking: !!hasCompletedBooking,
            alreadyReviewed: !!alreadyReviewed
        });
        
    } catch (error) {
        console.error('Error checking review eligibility:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
