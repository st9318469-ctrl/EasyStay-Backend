import express from 'express';
import {
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    checkWishlist
} from '../controllers/wishlistController.js';
import { protect } from '../middleware/auth_middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getWishlist);
router.post('/', addToWishlist);
router.get('/check/:propertyId', checkWishlist);
router.delete('/:propertyId', removeFromWishlist);

export default router;