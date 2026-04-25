import express from 'express';
import {
    createOrder,
    verifyPayment,
    getPaymentStatus,
    verifyUPIPayment
} from '../controllers/paymentController.js';
import { protect } from '../middleware/auth_middleware.js';

const router = express.Router();

router.use(protect);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.get('/status/:bookingId', getPaymentStatus);
router.post('/verify-upi', verifyUPIPayment);

export default router;
