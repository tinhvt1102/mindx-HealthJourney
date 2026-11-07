import nodemailer from 'nodemailer';

// Khởi tạo Transporter gửi mail
const createTransporter = () => {
  // Ở môi trường test, không kết nối SMTP thật để tránh timeout mạng
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

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

  // CHẾ ĐỘ DEV / TEST FALLBACK: In ra Terminal
  if (!transporter) {
    console.log(`\n==================================================`);
    console.log(`📧 [EMAIL OTP DEV/TEST MODE]`);
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
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
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

/**
 * Gửi email cảnh báo khẩn cấp khi chỉ số vượt ngưỡng nguy kịch (SCRUM-62)
 * @param {string} toEmail - Email người thân nhận cảnh báo
 * @param {object} alertData - Dữ liệu cảnh báo
 */
export const sendCriticalAlertEmail = async (toEmail, alertData) => {
  const {
    patientName,
    metricType,
    metricLabel,
    valueString,
    description,
    instructions,
    callerPhone,
  } = alertData;

  const transporter = createTransporter();

  const subject = `🚨 CẢNH BÁO NGUY CẤP: ${patientName} vừa có chỉ số ${metricLabel || metricType} (${valueString})!`;

  if (!transporter) {
    console.log(`\n==================================================`);
    console.log(`🚨 [CRITICAL ALERT EMAIL DEV/TEST MODE]`);
    console.log(`👉 Gửi tới người thân: ${toEmail}`);
    console.log(`⚠️ Bệnh nhân: ${patientName}`);
    console.log(`📊 Chỉ số: ${metricLabel || metricType} = ${valueString}`);
    console.log(`📝 Cảnh báo: ${description || 'Vượt ngưỡng nguy kịch y tế'}`);
    console.log(`🚑 Sơ cứu: ${instructions || 'Liên hệ ngay cơ sở y tế gần nhất'}`);
    console.log(`==================================================\n`);
    return { success: true, mode: 'terminal' };
  }

  const mailOptions = {
    from: `"HealthJourney Khẩn Cấp" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
    to: toEmail,
    subject,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: auto; padding: 24px; border: 2px solid #ef4444; border-radius: 16px; background: #fff5f5;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #dc2626; margin: 0; font-size: 24px;">🚨 CẢNH BÁO SỨC KHỎE NGUY CẤP</h2>
          <p style="color: #7f1d1d; font-size: 14px; margin: 6px 0 0 0; font-weight: 600;">HealthJourney - Hệ thống giám sát y tế gia đình</p>
        </div>
        
        <div style="background: #ffffff; border-radius: 12px; padding: 20px; border: 1px solid #fecaca; margin-bottom: 20px;">
          <p style="color: #1e293b; font-size: 16px; margin: 0 0 12px 0;">
            Người thân của bạn là <strong>${patientName}</strong> vừa đo được chỉ số sức khỏe ở mức 
            <span style="color: #dc2626; font-weight: bold; font-size: 18px;">NGUY KỊCH</span>:
          </p>
          
          <div style="text-align: center; background: #fee2e2; padding: 16px; border-radius: 10px; margin: 16px 0;">
            <div style="font-size: 14px; color: #991b1b; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">
              ${metricLabel || metricType}
            </div>
            <div style="font-size: 32px; font-weight: 800; color: #b91c1c; margin-top: 4px;">
              ${valueString}
            </div>
          </div>
          
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong>Tình trạng:</strong> ${description || 'Chỉ số vượt mức an toàn cho phép.'}
          </p>
        </div>

        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; margin-bottom: 20px; border-radius: 4px;">
          <h4 style="color: #991b1b; margin: 0 0 6px 0; font-size: 15px;">📋 Hướng dẫn xử lý khẩn cấp:</h4>
          <p style="color: #7f1d1d; font-size: 13px; margin: 0; line-height: 1.5;">
            ${instructions || '1. Cho người bệnh ngồi hoặc nằm nghỉ ngơi tại chỗ thoáng khí. 2. Không để người bệnh hoảng loạn. 3. Nếu có biểu hiện đau thắt ngực, khó thở, chóng mặt dữ dội, hãy gọi cấp cứu 115 ngay lập tức.'}
          </p>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          ${callerPhone ? `
            <a href="tel:${callerPhone}" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px; padding: 14px 28px; border-radius: 30px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">
              📞 Gọi điện ngay cho ${patientName} (${callerPhone})
            </a>
          ` : `
            <span style="display: inline-block; background: #dc2626; color: #ffffff; font-weight: bold; font-size: 16px; padding: 14px 28px; border-radius: 30px;">
              📞 Hãy liên lạc ngay với ${patientName}!
            </span>
          `}
        </div>

        <hr style="border: none; border-top: 1px solid #fecaca; margin: 24px 0 16px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          Email tự động được gửi từ hệ thống giám sát sức khỏe thông minh HealthJourney.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Alert Sent] Đã gửi email cảnh báo tới: ${toEmail}`);
    return { success: true, mode: 'smtp' };
  } catch (error) {
    console.error('[Alert Email Error]:', error.message);
    return { success: false, error: error.message };
  }
};
