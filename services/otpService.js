// For development/testing, we'll log OTPs to console
// In production, integrate with email/SMS providers

export const sendEmailOTP = async (email, otp) => {
    // For development: log OTP to console
    console.log(`=================================`);
    console.log(`📧 EMAIL VERIFICATION OTP for ${email}: ${otp}`);
    console.log(`=================================`);
    
    // In production, use nodemailer, SendGrid, etc.
    /*
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    
    await transporter.sendMail({
        from: '"EasyStay" <noreply@easystay.com>',
        to: email,
        subject: 'Verify Your Email - EasyStay',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1A1A18;">Welcome to EasyStay!</h2>
                <p>Your email verification OTP is:</p>
                <div style="font-size: 32px; font-weight: bold; color: #1A1A18; padding: 20px; background: #F1EFE8; text-align: center; border-radius: 10px;">
                    ${otp}
                </div>
                <p>This OTP will expire in 10 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <hr style="margin: 20px 0;" />
                <p style="color: #6B6B68; font-size: 12px;">EasyStay - Find your perfect escape</p>
            </div>
        `
    });
    */
    
    return true;
};

export const sendPhoneOTP = async (phone, otp) => {
    // For development: log OTP to console
    console.log(`=================================`);
    console.log(`📱 PHONE VERIFICATION OTP for ${phone}: ${otp}`);
    console.log(`=================================`);
    
    // In production, use Twilio, Vonage, etc.
    /*
    const client = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
    
    await client.messages.create({
        body: `Your EasyStay verification code is: ${otp}. Valid for 10 minutes.`,
        to: phone,
        from: process.env.TWILIO_PHONE_NUMBER
    });
    */
    
    return true;
};