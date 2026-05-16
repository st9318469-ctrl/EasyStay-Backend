import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const createResendTransporter = () => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

    return {
        verify: async () => {
            if (!apiKey) throw new Error('RESEND_API_KEY is missing');
            if (!fromEmail) throw new Error('EMAIL_FROM or EMAIL_USER is required');
            return true;
        },
        sendMail: async ({ to, subject, html, text, from }) => {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: from || fromEmail,
                    to: Array.isArray(to) ? to : [to],
                    subject,
                    html,
                    text
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const reason = data?.message || data?.error || `Resend API failed with status ${response.status}`;
                throw new Error(reason);
            }

            return {
                messageId: data?.id,
                response: JSON.stringify(data)
            };
        }
    };
};

// Create email transporter
const createTransporter = () => {
    if (process.env.RESEND_API_KEY) {
        return createResendTransporter();
    }

    // Remove spaces from app password if present
    const password = process.env.EMAIL_PASS?.replace(/\s/g, '');
    
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        name: 'easystay.onrender.com',
        auth: {
            user: process.env.EMAIL_USER,
            pass: password
        },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000,
        tls: {
            servername: 'smtp.gmail.com',
            minVersion: 'TLSv1.2'
        }
    });
    
    return transporter;
};

// Test email connection
export const testEmailConnection = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        console.log('✅ Email service ready to send emails');
        console.log(`📧 Using email: ${process.env.EMAIL_USER}`);
        return true;
    } catch (error) {
        console.error('❌ Email service error:', error.message);
        console.log('\nPlease check:');
        console.log('1. EMAIL_USER is correct');
        console.log('2. EMAIL_PASS is the 16-character app password');
        console.log('3. 2-Step Verification is enabled on Gmail');
        return false;
    }
};

// Send OTP Email
export const sendOTPEmail = async (email, otp, name = '') => {
    try {
        console.log(`\n📧 Preparing to send OTP to ${email}...`);
        
        const transporter = createTransporter();
        
        const mailOptions = {
            from: `"EasyStay" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔐 Verify Your Email - EasyStay',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            margin: 0;
                            padding: 0;
                            background-color: #f5f5f5;
                        }
                        .container {
                            max-width: 550px;
                            margin: 20px auto;
                            background: #ffffff;
                            border-radius: 12px;
                            overflow: hidden;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        }
                        .header {
                            background: #1A1A18;
                            color: #FAFAF8;
                            padding: 30px 20px;
                            text-align: center;
                        }
                        .header h1 {
                            margin: 0;
                            font-family: Georgia, serif;
                            font-size: 28px;
                        }
                        .header p {
                            margin: 5px 0 0;
                            opacity: 0.8;
                        }
                        .content {
                            padding: 40px 30px;
                            text-align: center;
                        }
                        .greeting {
                            font-size: 18px;
                            margin-bottom: 20px;
                        }
                        .otp-box {
                            background: #F1EFE8;
                            padding: 20px;
                            margin: 25px 0;
                            border-radius: 10px;
                        }
                        .otp-code {
                            font-size: 42px;
                            font-weight: bold;
                            letter-spacing: 8px;
                            color: #1A1A18;
                            font-family: monospace;
                        }
                        .timer {
                            color: #E24B4A;
                            font-size: 14px;
                            margin-top: 10px;
                        }
                        .button {
                            display: inline-block;
                            background: #1A1A18;
                            color: #FAFAF8;
                            padding: 12px 35px;
                            text-decoration: none;
                            border-radius: 25px;
                            margin: 20px 0;
                            font-weight: bold;
                        }
                        .footer {
                            background: #f9f9f9;
                            padding: 20px;
                            text-align: center;
                            font-size: 12px;
                            color: #666;
                            border-top: 1px solid #eee;
                        }
                        .warning {
                            background: #FFF3E0;
                            padding: 12px;
                            border-left: 4px solid #E24B4A;
                            margin: 20px 0;
                            font-size: 12px;
                            text-align: left;
                        }
                        .note {
                            font-size: 11px;
                            color: #999;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🏠 EasyStay</h1>
                            <p>Find your perfect escape</p>
                        </div>
                        <div class="content">
                            <div class="greeting">
                                Hello${name ? ` ${name}` : ' there'}! 👋
                            </div>
                            
                            <p>Thank you for joining EasyStay. Please verify your email address to complete your registration.</p>
                            
                            <div class="otp-box">
                                <div class="otp-code">
                                    ${otp}
                                </div>
                                <div class="timer">
                                    ⏰ Valid for 10 minutes
                                </div>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Security Alert:</strong> Never share this code with anyone. EasyStay will never ask for this code outside of the verification process.
                            </div>
                            
                            <p style="margin-top: 20px;">
                                Once verified, you'll have access to:
                            </p>
                            <p>🏠 Book amazing stays<br>
                            💬 Connect with hosts<br>
                            ⭐ Leave reviews</p>
                            
                            <div class="note">
                                If you didn't request this, please ignore this email.
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 EasyStay. All rights reserved.</p>
                            <p>Need help? Contact us at support@easystay.com</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                Welcome to EasyStay!
                
                Hello${name ? ` ${name}` : ''},
                
                Your email verification code is: ${otp}
                
                This code is valid for 10 minutes.
                
                Security Tip: Never share this code with anyone.
                
                If you didn't request this, please ignore this email.
                
                Once verified, you can book amazing stays and connect with hosts.
                
                EasyStay - Find your perfect escape
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ OTP email sent successfully!');
        console.log(`📧 Sent to: ${email}`);
        console.log(`📬 Message ID: ${info.messageId}`);
        
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        
        if (error.message.includes('Invalid login')) {
            console.log('\n⚠️ Gmail authentication failed!');
            console.log('Please verify:');
            console.log('1. EMAIL_USER is correct: ' + process.env.EMAIL_USER);
            console.log('2. EMAIL_PASS is the 16-character app password');
            console.log('3. 2-Step Verification is enabled on Gmail');
        }
        
        return { success: false, error: error.message };
    }
};

// Backwards-compatible alias used by some controllers.
export const sendEmailOTP = async (email, otp, name = '') => sendOTPEmail(email, otp, name);

// Send Welcome Email (after verification)
export const sendWelcomeEmail = async (email, name) => {
    try {
        console.log(`\n📧 Sending welcome email to ${email}...`);
        
        const transporter = createTransporter();
        
        const mailOptions = {
            from: `"EasyStay" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🎉 Welcome to EasyStay!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; background: #fff;">
                    <div style="background: #1A1A18; color: #FAFAF8; padding: 30px; text-align: center;">
                        <h1 style="margin: 0;">EasyStay</h1>
                    </div>
                    <div style="padding: 30px; text-align: center;">
                        <h2>Welcome aboard, ${name}! 🎉</h2>
                        <p>Your email has been successfully verified.</p>
                        <p>You're now ready to explore amazing stays and book your next adventure!</p>
                        <div style="margin: 30px 0;">
                            <span style="font-size: 40px;">🏠</span>
                            <span style="font-size: 40px;">✈️</span>
                            <span style="font-size: 40px;">⭐</span>
                        </div>
                        <p>Happy travels!</p>
                        <p><strong>The EasyStay Team</strong></p>
                    </div>
                    <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                        <p>Need help? Contact us at support@easystay.com</p>
                    </div>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        console.log('✅ Welcome email sent successfully!');
        
    } catch (error) {
        console.error('Failed to send welcome email:', error.message);
    }
};

const FALLBACK_FRONTEND_URL = 'http://localhost:5173';

const formatDisplayDate = (value, locale = 'en-US', options = {}) => {
    if (!value) return 'N/A';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleDateString(locale, options);
};

const calculateNights = (checkIn, checkOut) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0;
    }

    const diffInMs = end - start;
    return Math.max(0, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)));
};

const formatCurrency = (amount) => `₹${Number(amount || 0)}`;

const buildAppUrl = (path) => {
    const baseUrl = (process.env.FRONTEND_URL || FALLBACK_FRONTEND_URL).replace(/\/+$/, '');
    const safePath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${safePath}`;
};

export const sendBookingConfirmationEmail = async (booking, property, user) => {
    try {
        console.log(`Sending booking confirmation to ${user.email}...`);

        const transporter = createTransporter();
        const nights = calculateNights(booking.checkIn, booking.checkOut);
        const basePrice = Number(property?.price || 0) * nights;
        const serviceFee = Math.round(basePrice * 0.1);
        const cleaningFee = 500;
        const bookingId = booking?._id?.toString?.().slice(-8).toUpperCase() || 'PENDING';
        const propertyLocation = [property?.location?.city, property?.location?.country].filter(Boolean).join(', ') || 'Location unavailable';
        const bookingsUrl = buildAppUrl('/my-trips');

        const mailOptions = {
            from: `"EasyStay" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Booking Confirmed - EasyStay',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            margin: 0;
                            padding: 0;
                            background-color: #f5f5f5;
                        }
                        .container {
                            max-width: 600px;
                            margin: 20px auto;
                            background: #ffffff;
                            border-radius: 16px;
                            overflow: hidden;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                        }
                        .header {
                            background: linear-gradient(135deg, #1A1A18 0%, #2A2A28 100%);
                            color: #FAFAF8;
                            padding: 30px 20px;
                            text-align: center;
                        }
                        .header h1 {
                            margin: 0;
                            font-family: Georgia, serif;
                            font-size: 32px;
                        }
                        .header p {
                            margin: 10px 0 0;
                            opacity: 0.9;
                        }
                        .content {
                            padding: 30px;
                        }
                        .success-icon {
                            text-align: center;
                            font-size: 28px;
                            font-weight: bold;
                            margin-bottom: 20px;
                            color: #1A1A18;
                        }
                        .booking-id {
                            background: #F1EFE8;
                            padding: 12px;
                            text-align: center;
                            border-radius: 8px;
                            font-family: monospace;
                            font-size: 18px;
                            font-weight: bold;
                            margin: 20px 0;
                            color: #1A1A18;
                        }
                        .property-details {
                            border: 1px solid #E0DDD6;
                            border-radius: 12px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        .property-image {
                            width: 100%;
                            height: 200px;
                            object-fit: cover;
                            border-radius: 8px;
                            margin-bottom: 15px;
                        }
                        .details-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 15px;
                            margin: 20px 0;
                        }
                        .detail-item {
                            padding: 10px;
                            background: #F9F9F9;
                            border-radius: 8px;
                        }
                        .detail-label {
                            font-size: 12px;
                            color: #666;
                            margin-bottom: 5px;
                        }
                        .detail-value {
                            font-size: 16px;
                            font-weight: 600;
                            color: #1A1A18;
                        }
                        .price-breakdown {
                            background: #F1EFE8;
                            padding: 15px;
                            border-radius: 8px;
                            margin: 20px 0;
                        }
                        .price-row {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 10px;
                        }
                        .total-row {
                            border-top: 2px solid #ddd;
                            margin-top: 10px;
                            padding-top: 10px;
                            font-weight: bold;
                            font-size: 18px;
                        }
                        .button {
                            display: inline-block;
                            background: #1A1A18;
                            color: #FAFAF8 !important;
                            padding: 12px 30px;
                            text-decoration: none;
                            border-radius: 8px;
                            margin: 20px 0;
                            font-weight: bold;
                            text-align: center;
                        }
                        .footer {
                            background: #F9F9F9;
                            padding: 20px;
                            text-align: center;
                            font-size: 12px;
                            color: #666;
                            border-top: 1px solid #eee;
                        }
                        .important-info {
                            background: #FFF3E0;
                            padding: 15px;
                            border-left: 4px solid #E24B4A;
                            margin: 20px 0;
                            border-radius: 8px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>EasyStay</h1>
                            <p>Your stay is confirmed!</p>
                        </div>
                        <div class="content">
                            <div class="success-icon">Confirmed</div>
                            <h2 style="text-align: center; color: #1A1A18;">Booking Confirmed!</h2>
                            <p style="text-align: center; color: #666;">Hello ${user.name},</p>
                            <p style="text-align: center; color: #666;">Your booking has been successfully confirmed. Get ready for an amazing stay.</p>
                            <div class="booking-id">Booking ID: #${bookingId}</div>
                            <div class="property-details">
                                <h3 style="margin: 0 0 10px; color: #1A1A18;">Property Details</h3>
                                <p style="font-size: 18px; font-weight: bold; margin: 0;">${property?.title || 'Your stay'}</p>
                                <p style="color: #666; margin: 5px 0;">${propertyLocation}</p>
                                ${property?.images?.[0]?.url ? `<img src="${property.images[0].url}" alt="${property?.title || 'Property image'}" class="property-image" />` : ''}
                            </div>
                            <div class="details-grid">
                                <div class="detail-item">
                                    <div class="detail-label">Check-in</div>
                                    <div class="detail-value">${formatDisplayDate(booking.checkIn, 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Check-out</div>
                                    <div class="detail-value">${formatDisplayDate(booking.checkOut, 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Nights</div>
                                    <div class="detail-value">${nights} night${nights === 1 ? '' : 's'}</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Guests</div>
                                    <div class="detail-value">${booking?.guests || 0} guest${Number(booking?.guests || 0) === 1 ? '' : 's'}</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Bedrooms</div>
                                    <div class="detail-value">${property?.bedrooms ?? 'N/A'}</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Bathrooms</div>
                                    <div class="detail-value">${property?.bathrooms ?? 'N/A'}</div>
                                </div>
                            </div>
                            <div class="price-breakdown">
                                <h3 style="margin: 0 0 15px;">Price Breakdown</h3>
                                <div class="price-row">
                                    <span>${formatCurrency(property?.price)} x ${nights} night${nights === 1 ? '' : 's'}</span>
                                    <span>${formatCurrency(basePrice)}</span>
                                </div>
                                <div class="price-row">
                                    <span>Service Fee (10%)</span>
                                    <span>${formatCurrency(serviceFee)}</span>
                                </div>
                                <div class="price-row">
                                    <span>Cleaning Fee</span>
                                    <span>${formatCurrency(cleaningFee)}</span>
                                </div>
                                <div class="price-row total-row">
                                    <span>Total Amount</span>
                                    <span>${formatCurrency(booking?.totalPrice)}</span>
                                </div>
                            </div>
                            <div class="important-info">
                                <strong>Important Information</strong><br/>
                                Check-in time: 2:00 PM<br/>
                                Check-out time: 11:00 AM<br/>
                                Please carry a valid ID proof<br/>
                                Payment: Pay at property (Cash/Card/UPI)
                            </div>
                            <div style="text-align: center;">
                                <a href="${bookingsUrl}" class="button">View My Bookings</a>
                            </div>
                            <p style="text-align: center; color: #666; margin-top: 20px;">
                                Need help? Contact us at support@easystay.com<br/>
                                or call +91 12345 67890
                            </p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 EasyStay. All rights reserved.</p>
                            <p>Find your perfect escape with EasyStay</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                EasyStay - Booking Confirmed

                Hello ${user.name},

                Your booking has been successfully confirmed.

                Booking ID: #${bookingId}
                Property: ${property?.title || 'Your stay'}
                Location: ${propertyLocation}
                Check-in: ${formatDisplayDate(booking.checkIn)}
                Check-out: ${formatDisplayDate(booking.checkOut)}
                Nights: ${nights}
                Guests: ${booking?.guests || 0}
                Total Amount: ${formatCurrency(booking?.totalPrice)}

                Important Information:
                - Check-in: 2:00 PM
                - Check-out: 11:00 AM
                - Please carry valid ID proof
                - Payment at property

                View your booking: ${bookingsUrl}
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Booking confirmation email sent to ${user.email}`);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Failed to send booking confirmation email:', error.message);
        return { success: false, error: error.message };
    }
};

export const sendBookingCancellationEmail = async (booking, property, user) => {
    try {
        console.log(`Sending booking cancellation email to ${user.email}...`);

        const transporter = createTransporter();
        const refundAmount = Math.round(Number(booking?.totalPrice || 0) * 0.9);
        const propertyLocation = [property?.location?.city, property?.location?.country].filter(Boolean).join(', ') || 'Location unavailable';
        const bookingsUrl = buildAppUrl('/my-trips');

        const mailOptions = {
            from: `"EasyStay" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Booking Cancelled - EasyStay',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
                        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #E24B4A 0%, #c0392b 100%); color: #FAFAF8; padding: 30px 20px; text-align: center; }
                        .content { padding: 30px; }
                        .property-details { border: 1px solid #E0DDD6; border-radius: 12px; padding: 20px; margin: 20px 0; }
                        .refund-info { background: #F1EFE8; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
                        .button { display: inline-block; background: #1A1A18; color: #FAFAF8 !important; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; text-align: center; }
                        .footer { background: #F9F9F9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>EasyStay</h1>
                            <p>Booking Cancelled</p>
                        </div>
                        <div class="content">
                            <div style="text-align: center; font-size: 28px; font-weight: bold;">Cancelled</div>
                            <h2 style="text-align: center;">Booking Cancelled</h2>
                            <p>Hello ${user.name},</p>
                            <p>Your booking has been cancelled as requested.</p>
                            <div class="property-details">
                                <h3>Cancelled Booking</h3>
                                <p><strong>${property?.title || 'Your stay'}</strong><br/>
                                ${propertyLocation}<br/>
                                ${formatDisplayDate(booking.checkIn)} - ${formatDisplayDate(booking.checkOut)}</p>
                            </div>
                            <div class="refund-info">
                                <strong>Refund Information</strong><br/>
                                Total Amount: ${formatCurrency(booking?.totalPrice)}<br/>
                                Refund Amount: ${formatCurrency(refundAmount)}<br/>
                                (90% refund, 10% cancellation fee)<br/>
                                Refund will be processed in 5-7 business days.
                            </div>
                            <div style="text-align: center;">
                                <a href="${bookingsUrl}" class="button">View My Bookings</a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 EasyStay. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                EasyStay - Booking Cancelled

                Hello ${user.name},

                Your booking has been cancelled as requested.

                Property: ${property?.title || 'Your stay'}
                Location: ${propertyLocation}
                Dates: ${formatDisplayDate(booking.checkIn)} - ${formatDisplayDate(booking.checkOut)}
                Total Amount: ${formatCurrency(booking?.totalPrice)}
                Refund Amount: ${formatCurrency(refundAmount)}
                Refund will be processed in 5-7 business days.

                View your bookings: ${bookingsUrl}
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Booking cancellation email sent to ${user.email}`);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Failed to send cancellation email:', error.message);
        return { success: false, error: error.message };
    }
};

export const sendHostNotificationEmail = async (booking, property, guest, host) => {
    try {
        console.log(`Sending host notification to ${host.email}...`);

        const transporter = createTransporter();
        const dashboardUrl = buildAppUrl('/host-dashboard');

        const mailOptions = {
            from: `"EasyStay" <${process.env.EMAIL_USER}>`,
            to: host.email,
            subject: 'New Booking - EasyStay',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
                        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FAFAF8; padding: 30px 20px; text-align: center; }
                        .content { padding: 30px; }
                        .button { display: inline-block; background: #1A1A18; color: #FAFAF8 !important; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; text-align: center; }
                        .footer { background: #F9F9F9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>EasyStay</h1>
                            <p>New Booking Received</p>
                        </div>
                        <div class="content">
                            <div style="text-align: center; font-size: 28px; font-weight: bold;">New Booking</div>
                            <h2 style="text-align: center;">You've got a new booking!</h2>
                            <p>Hello ${host.name},</p>
                            <p><strong>${guest.name}</strong> has booked your property.</p>
                            <div style="background: #F1EFE8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Property:</strong> ${property?.title || 'Your listing'}</p>
                                <p><strong>Dates:</strong> ${formatDisplayDate(booking.checkIn)} - ${formatDisplayDate(booking.checkOut)}</p>
                                <p><strong>Guests:</strong> ${booking?.guests || 0}</p>
                                <p><strong>Total Amount:</strong> ${formatCurrency(booking?.totalPrice)}</p>
                            </div>
                            <div style="text-align: center;">
                                <a href="${dashboardUrl}" class="button">View Dashboard</a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 EasyStay. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                EasyStay - New Booking

                Hello ${host.name},

                ${guest.name} has booked your property.

                Property: ${property?.title || 'Your listing'}
                Dates: ${formatDisplayDate(booking.checkIn)} - ${formatDisplayDate(booking.checkOut)}
                Guests: ${booking?.guests || 0}
                Total Amount: ${formatCurrency(booking?.totalPrice)}

                View dashboard: ${dashboardUrl}
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Host notification email sent to ${host.email}`);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Failed to send host notification:', error.message);
        return { success: false, error: error.message };
    }
};
