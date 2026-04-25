import express from 'express';
import {
    createBooking,
    getUserBookings,
    getBookingDetails,
    cancelBooking,
    confirmBookingPayment,
    updateBookingPayment
} from '../controllers/bookingController.js';
import { protect } from '../middleware/auth_middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create booking
router.post('/', createBooking);

// Get user's bookings
router.get('/my-bookings', getUserBookings);

// Get single booking
router.get('/:id', getBookingDetails);

// Cancel booking
router.put('/:id/cancel', cancelBooking);

// Confirm payment for pending booking
router.put('/:id/confirm-payment', confirmBookingPayment);

// Update payment method/status and confirm booking
router.put('/:id/payment', updateBookingPayment);

export default router;
