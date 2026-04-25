import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure one user can't add same property twice
wishlistSchema.index({ user: 1, property: 1 }, { unique: true });

export default mongoose.model('Wishlist', wishlistSchema);
