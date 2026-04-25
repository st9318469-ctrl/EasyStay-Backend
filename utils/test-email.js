const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email
 * @param {{ to: string, subject: string, html: string }} options
 */
exports.sendEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER) {
    console.warn('⚠️  EMAIL_USER not set — skipping email send');
    return;
  }
  await transporter.sendMail({
    from: `"ChillSpace 🏡" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};