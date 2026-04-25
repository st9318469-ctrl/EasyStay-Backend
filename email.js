import { sendEmailOTP } from './services/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

const testEmail = async () => {
    console.log('Testing email sending...');
    const result = await sendEmailOTP('test@example.com', '123456', 'Test User');
    
    if (result.success) {
        console.log('✅ Email sent successfully!');
        if (result.previewUrl) {
            console.log('📬 Preview URL:', result.previewUrl);
        }
    } else {
        console.log('❌ Email failed:', result.error);
    }
};

testEmail();