import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { sendOtpEmail } from '../services/email.service.js';

// Helper sinh JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Helper sinh mã OTP 6 số ngẫu nhiên
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Đăng ký tài khoản & gửi mã OTP qua Email
// @route   POST /api/v1/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { email, password, fullName, name } = req.body;
    const displayName = (name || fullName || '').trim();

    if (!email || !password || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ Email, Mật khẩu và Họ tên',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải chứa ít nhất 8 ký tự',
      });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác',
      });
    }

    // Băm mật khẩu
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Sinh mã OTP 6 số (hết hạn trong 10 phút)
    const otpCode = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: displayName,
      fullName: displayName,
      isVerified: false,
      otp: {
        code: otpCode,
        expiresAt: otpExpires,
      },
    });

    // Gửi email OTP (hoặc in ra Terminal nếu ở chế độ DEV)
    await sendOtpEmail(newUser.email, otpCode);

    return res.status(201).json({
      success: true,
      requireOtp: true,
      message: 'Đăng ký thành công! Vui lòng nhập mã OTP gửi tới email của bạn.',
      email: newUser.email,
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng ký tài khoản',
      error: error.message,
    });
  }
};

// @desc    Xác thực mã OTP để kích hoạt tài khoản & nhận Token
// @route   POST /api/v1/auth/verify-otp
// @access  Public
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp Email và Mã OTP',
      });
    }

    // Tìm user và lấy kèm trường otp
    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp.code +otp.expiresAt');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản với email này',
      });
    }

    // Kiểm tra mã OTP
    if (!user.otp || !user.otp.code) {
      return res.status(400).json({
        success: false,
        message: 'Không có yêu cầu OTP nào đang chờ xử lý. Vui lòng gửi lại mã!',
      });
    }

    if (user.otp.code !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại!',
      });
    }

    if (new Date() > new Date(user.otp.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn (10 phút). Vui lòng yêu cầu gửi lại mã mới!',
      });
    }

    // Kích hoạt tài khoản thành công
    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    const token = signToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Xác thực OTP thành công! Chào mừng bạn đến với HealthJourney.',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.fullName,
        fullName: user.name || user.fullName,
        avatar: user.avatar || user.avatarUrl,
        avatarUrl: user.avatar || user.avatarUrl,
        bio: user.bio,
        heightCm: user.heightCm,
        isVerified: true,
      },
    });
  } catch (error) {
    console.error('[Verify OTP Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực OTP',
      error: error.message,
    });
  }
};

// @desc    Gửi lại mã OTP
// @route   POST /api/v1/auth/resend-otp
// @access  Public
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp Email' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    const otpCode = generateOtp();
    user.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    await user.save();

    await sendOtpEmail(user.email, otpCode);

    return res.status(200).json({
      success: true,
      message: 'Đã gửi lại mã OTP mới qua email của bạn.',
    });
  } catch (error) {
    console.error('[Resend OTP Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi lại mã OTP',
      error: error.message,
    });
  }
};

// @desc    Đăng nhập
// @route   POST /api/v1/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ Email và Mật khẩu',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.fullName,
        fullName: user.name || user.fullName,
        avatar: user.avatar || user.avatarUrl,
        avatarUrl: user.avatar || user.avatarUrl,
        bio: user.bio,
        heightCm: user.heightCm,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng nhập',
      error: error.message,
    });
  }
};

// @desc    Lấy thông tin tài khoản đang đăng nhập
// @route   GET /api/v1/auth/me
// @access  Private (Cần Bearer Token)
export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name || req.user.fullName,
      fullName: req.user.name || req.user.fullName,
      avatar: req.user.avatar || req.user.avatarUrl,
      avatarUrl: req.user.avatar || req.user.avatarUrl,
      bio: req.user.bio,
      heightCm: req.user.heightCm,
      birthDate: req.user.birthDate,
      gender: req.user.gender,
      isVerified: req.user.isVerified,
      createdAt: req.user.createdAt,
    },
  });
};

// @desc    Cập nhật hồ sơ cá nhân (SCRUM-20: Tên, Bio, Chiều cao, Giới tính)
// @route   PUT /api/v1/auth/profile
// @access  Private (Cần Bearer Token)
export const updateProfile = async (req, res) => {
  try {
    const { name, fullName, bio, heightCm, gender } = req.body;
    const updateData = {};

    if (name || fullName) {
      updateData.name = (name || fullName).trim();
      updateData.fullName = (name || fullName).trim();
    }
    if (bio !== undefined) updateData.bio = bio;
    if (heightCm !== undefined) updateData.heightCm = Number(heightCm);
    if (gender) updateData.gender = gender.toString().toUpperCase();

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ cá nhân thành công',
      user: updatedUser,
    });
  } catch (error) {
    console.error('[Update Profile Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật hồ sơ',
      error: error.message,
    });
  }
};
