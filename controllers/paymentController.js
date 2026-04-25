import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import Property from '../models/property.js';
import User from '../models/user_model.js';
import {
    sendBookingConfirmationEmail,
    sendHostNotificationEmail
} from '../services/emailService.js';

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay Order
export const createOrder = async (req, res) => {
    try {
        const { bookingId } = req.body;
        
        // Find booking
        const booking = await Booking.findById(bookingId).populate('property');
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check if booking belongs to user
        if (booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        // Check if payment already exists
        const existingPayment = await Payment.findOne({ booking: bookingId });
        if (existingPayment && existingPayment.status === 'success') {
            return res.status(400).json({
                success: false,
                message: 'Payment already completed for this booking'
            });
        }
        
        // Create Razorpay order
        const options = {
            amount: booking.totalPrice * 100, // Convert to paise
            currency: 'INR',
            receipt: `booking_${bookingId}`,
            notes: {
                bookingId: bookingId.toString(),
                propertyTitle: booking.property.title,
                guestName: req.user.name
            }
        };
        
        const order = await razorpay.orders.create(options);
        
        // Save payment record
        const payment = new Payment({
            booking: bookingId,
            user: req.user.id,
            razorpayOrderId: order.id,
            amount: booking.totalPrice,
            currency: 'INR',
            status: 'created'
        });
        
        await payment.save();
        
        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Verify Payment
export const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            bookingId
        } = req.body;
        
        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');
        
        const isAuthentic = expectedSignature === razorpay_signature;
        
        if (!isAuthentic) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }
        
        // Update payment record
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found'
            });
        }
        
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        payment.status = 'success';
        await payment.save();
        
        // Update booking status
        const booking = await Booking.findById(payment.booking);
        booking.paymentStatus = 'paid';
        booking.status = 'confirmed';
        await booking.save();
        
        res.json({
            success: true,
            message: 'Payment successful!',
            bookingId: booking._id
        });
        
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Verify UPI Payment
export const verifyUPIPayment = async (req, res) => {
    try {
        const { bookingId, transactionId, amount } = req.body || {};

        if (!bookingId || !transactionId) {
            return res.status(400).json({
                success: false,
                message: 'bookingId and transactionId are required'
            });
        }

        const booking = await Booking.findById(bookingId)
            .populate('property', 'title images location price bedrooms bathrooms host')
            .populate('user', 'name email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot verify payment for a cancelled booking'
            });
        }

        if (amount && Number(amount) !== Number(booking.totalPrice)) {
            return res.status(400).json({
                success: false,
                message: 'Payment amount does not match booking total'
            });
        }

        booking.paymentMethod = 'upi';
        booking.paymentStatus = 'paid';
        booking.status = 'confirmed';
        booking.paymentReference = String(transactionId).trim();
        booking.paidAt = booking.paidAt || new Date();
        await booking.save();

        const property = await Property.findById(booking.property._id || booking.property);
        if (property) {
            await property.blockDates(booking.checkIn, booking.checkOut, booking._id);
        }

        await sendBookingConfirmationEmail(booking, booking.property, booking.user);

        if (booking.property.host) {
            const host = await User.findById(booking.property.host).select('name email');

            if (host?.email) {
                await sendHostNotificationEmail(booking, booking.property, booking.user, host);
            }
        }

        res.json({
            success: true,
            message: 'Payment verified successfully! Confirmation email sent.',
            booking
        });
    } catch (error) {
        console.error('UPI verification error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get payment status
export const getPaymentStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        const payment = await Payment.findOne({ booking: bookingId });
        
        if (!payment) {
            return res.json({
                success: true,
                status: 'pending'
            });
        }
        
        res.json({
            success: true,
            status: payment.status,
            paymentId: payment.razorpayPaymentId,
            amount: payment.amount
        });
        
    } catch (error) {
        console.error('Get payment status error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
