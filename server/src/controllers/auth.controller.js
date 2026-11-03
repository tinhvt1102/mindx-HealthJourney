import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { sendOtpEmail } from '../services/email.service.js';

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

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

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp Email và Mã OTP',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp.code +otp.expiresAt');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản với email này',
      });
    }

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
        fullName: user.fullName || user.name,
        avatar: user.avatar || user.avatarUrl,
        avatarUrl: user.avatarUrl || user.avatar,
        bio: user.bio,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        birthDate: user.birthDate,
        gender: user.gender,
        bloodType: user.bloodType,
        bmi: user.bmi,
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
        weightKg: user.weightKg,
        birthDate: user.birthDate,
        gender: user.gender,
        bloodType: user.bloodType,
        bmi: user.bmi,
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
      weightKg: req.user.weightKg,
      birthDate: req.user.birthDate,
      gender: req.user.gender,
      bloodType: req.user.bloodType,
      bmi: req.user.bmi,
      isVerified: req.user.isVerified,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
};

export const updateProfile = async (req, res) => {
  try {
    const { heightCm, weightKg, birthDate, gender, bloodType, fullName, name, bio, avatar, avatarUrl } = req.body;
    const user = req.user;

    if (heightCm !== undefined && heightCm !== null && heightCm !== '') {
      const height = Number(heightCm);
      if (isNaN(height) || height < 50 || height > 250) {
        return res.status(400).json({
          success: false,
          message: 'Chiều cao phải là số hợp lệ từ 50cm đến 250cm',
        });
      }
      user.heightCm = height;
    }

    if (weightKg !== undefined && weightKg !== null && weightKg !== '') {
      const weight = Number(weightKg);
      if (isNaN(weight) || weight < 10 || weight > 300) {
        return res.status(400).json({
          success: false,
          message: 'Cân nặng phải là số hợp lệ từ 10kg đến 300kg',
        });
      }
      user.weightKg = weight;
    }

    if (birthDate !== undefined && birthDate !== null && birthDate !== '') {
      const parsedDate = new Date(birthDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Ngày sinh không đúng định dạng ngày tháng hợp lệ',
        });
      }
      if (parsedDate > new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Ngày sinh không thể ở thời điểm tương lai',
        });
      }
      user.birthDate = parsedDate;
    } else if (birthDate === null || birthDate === '') {
      user.birthDate = undefined;
    }

    if (gender !== undefined && gender !== null && gender !== '') {
      const normalizedGender = gender.toString().toUpperCase();
      const validGenders = ['MALE', 'FEMALE', 'OTHER'];
      if (!validGenders.includes(normalizedGender)) {
        return res.status(400).json({
          success: false,
          message: 'Giới tính không hợp lệ (chỉ chấp nhận MALE, FEMALE hoặc OTHER)',
        });
      }
      user.gender = normalizedGender;
    }

    if (bloodType !== undefined && bloodType !== null && bloodType !== '') {
      const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];
      if (!validBloodTypes.includes(bloodType)) {
        return res.status(400).json({
          success: false,
          message: 'Nhóm máu không hợp lệ (hỗ trợ: A+, A-, B+, B-, AB+, AB-, O+, O-, UNKNOWN)',
        });
      }
      user.bloodType = bloodType;
    }

    const resolvedName = (fullName !== undefined ? fullName : name);
    if (resolvedName !== undefined && typeof resolvedName === 'string' && resolvedName.trim()) {
      user.fullName = resolvedName.trim();
      user.name = resolvedName.trim();
    }

    if (bio !== undefined && typeof bio === 'string') {
      user.bio = bio.trim();
    }

    const newAvatar = avatarUrl || avatar;
    if (newAvatar !== undefined && typeof newAvatar === 'string') {
      user.avatarUrl = newAvatar.trim();
      user.avatar = newAvatar.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin hồ sơ thành công',
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.fullName,
        fullName: user.fullName || user.name,
        avatar: user.avatar || user.avatarUrl,
        avatarUrl: user.avatarUrl || user.avatar,
        bio: user.bio,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        birthDate: user.birthDate,
        gender: user.gender,
        bloodType: user.bloodType,
        bmi: user.bmi,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Update Profile Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật hồ sơ cá nhân',
      error: error.message,
    });
  }
};