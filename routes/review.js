import express from 'express';
import {
    createReview,
    getPropertyReviews,
    canReview
} from '../controllers/reviewController.js';
import { protect } from '../middleware/auth_middleware.js';

const router = express.Router();

// Public route
router.get('/property/:propertyId', getPropertyReviews);

// Protected routes
router.post('/', protect, createReview);
router.get('/can-review/:propertyId', protect, canReview);

export default router;