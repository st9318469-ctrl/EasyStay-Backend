import Wishlist from '../models/Wishlist.js';

// Add to wishlist
export const addToWishlist = async (req, res) => {
    try {
        const { propertyId } = req.body;
        
        // Check if already in wishlist
        const existing = await Wishlist.findOne({
            user: req.user.id,
            property: propertyId
        });
        
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Property already in wishlist'
            });
        }
        
        const wishlistItem = new Wishlist({
            user: req.user.id,
            property: propertyId
        });
        
        await wishlistItem.save();
        
        res.status(201).json({
            success: true,
            message: 'Added to wishlist',
            wishlistItem
        });
        
    } catch (error) {
        console.error('Add to wishlist error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Remove from wishlist
export const removeFromWishlist = async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        await Wishlist.findOneAndDelete({
            user: req.user.id,
            property: propertyId
        });
        
        res.json({
            success: true,
            message: 'Removed from wishlist'
        });
        
    } catch (error) {
        console.error('Remove from wishlist error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get user's wishlist
export const getWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.find({ user: req.user.id })
            .populate('property', 'title images location price rating')
            .sort('-addedAt');
        
        res.json({
            success: true,
            wishlist
        });
        
    } catch (error) {
        console.error('Get wishlist error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Check if property is in wishlist
export const checkWishlist = async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        const exists = await Wishlist.findOne({
            user: req.user.id,
            property: propertyId
        });
        
        res.json({
            success: true,
            isInWishlist: !!exists
        });
        
    } catch (error) {
        console.error('Check wishlist error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};