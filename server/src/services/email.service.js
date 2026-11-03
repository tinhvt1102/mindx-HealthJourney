import nodemailer from 'nodemailer';

// Khởi tạo Transporter gửi mail
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT) || 587;
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!user || !pass) {
    return null; // Chế độ DEV: Không có email thì in ra Terminal
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true cho port 465, false cho 587
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Gửi mã OTP xác thực email
 * @param {string} toEmail - Địa chỉ email người nhận
 * @param {string} otpCode - Mã OTP 6 chữ số
 */
export const sendOtpEmail = async (toEmail, otpCode) => {
  const transporter = createTransporter();

  // CHẾ ĐỘ DEV FALLBACK: Nếu chưa cài SMTP trong .env, in thẳng ra màn hình Terminal
  if (!transporter) {
    console.log(`\n==================================================`);
    console.log(`📧 [EMAIL OTP DEV MODE]`);
    console.log(`👉 Gửi tới: ${toEmail}`);
    console.log(`🔑 Mã OTP xác thực của bạn là: [ ${otpCode} ]`);
    console.log(`⏳ Hết hạn trong: 10 phút`);
    console.log(`==================================================\n`);
    return { success: true, mode: 'terminal' };
  }

  // CHẾ ĐỘ PRODUCTION: Gửi email HTML thật qua Gmail SMTP
  const mailOptions = {
    from: `"HealthJourney" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `[HealthJourney] Mã xác thực OTP của bạn: ${otpCode}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; rounded-2xl; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0d9488; margin: 0;">HealthJourney</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Đồng hành cùng sức khỏe gia đình</p>
        </div>
        <p style="color: #334155; font-size: 15px;">Xin chào,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Bạn vừa yêu cầu đăng ký tài khoản trên nền tảng <strong>HealthJourney</strong>. Vui lòng nhập mã OTP dưới đây để hoàn tất xác thực:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0d9488; background: #f0fdfa; padding: 12px 28px; border-radius: 12px; border: 1px dashed #14b8a6;">
            ${otpCode}
          </span>
        </div>
        <p style="color: #64748b; font-size: 13px;">Mã xác thực có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center;">© 2026 HealthJourney. Bảo vệ sức khỏe gia đình vẹn tròn.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email Sent] Đã gửi OTP thành công tới: ${toEmail}`);
    return { success: true, mode: 'smtp' };
  } catch (error) {
    console.error('[Email Error]: Không thể gửi mail:', error.message);
    throw error;
  }
};
