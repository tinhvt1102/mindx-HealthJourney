import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

// Helper sinh JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @desc    Đăng ký tài khoản mới (Chuẩn SCRUM-17: email, passwordHash, name, avatar, bio)
// @route   POST /api/v1/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { email, password, fullName, name, avatar, bio, heightCm } = req.body;
    const displayName = (name || fullName || '').trim();

    // Validate đầu vào cơ bản
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

    // Băm mật khẩu lưu vào trường passwordHash theo đúng Jira
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Tạo user mới
    const newUser = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: displayName,
      fullName: displayName,
      avatar: avatar || '',
      avatarUrl: avatar || '',
      bio: bio || '',
      heightCm: heightCm || 170,
    });

    const token = signToken(newUser._id);

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        fullName: newUser.name,
        avatar: newUser.avatar,
        avatarUrl: newUser.avatar,
        bio: newUser.bio,
        heightCm: newUser.heightCm,
        birthDate: newUser.birthDate,
        gender: newUser.gender,
      },
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

    // Lấy kèm trường passwordHash hoặc password cũ để so khớp
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    // So khớp mật khẩu
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
        birthDate: user.birthDate,
        gender: user.gender,
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
      weightKg: req.user.weightKg,
      birthDate: req.user.birthDate,
      gender: req.user.gender,
      bloodType: req.user.bloodType,
      bmi: req.user.bmi,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
};

// @desc    Cập nhật thông tin cá nhân (chiều cao, cân nặng, ngày sinh, giới tính...)
// @route   PUT /api/v1/auth/profile
// @access  Private (Cần Bearer Token)
export const updateProfile = async (req, res) => {
  try {
    const { heightCm, weightKg, birthDate, gender, bloodType, fullName, name, avatarUrl, bio } = req.body;
    const user = req.user;

    // Validate và cập nhật Chiều cao
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

    // Validate và cập nhật Cân nặng
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

    // Validate và cập nhật Ngày sinh
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

    // Validate và cập nhật Giới tính
    if (gender !== undefined && gender !== null && gender !== '') {
      const validGenders = ['MALE', 'FEMALE', 'OTHER'];
      if (!validGenders.includes(gender)) {
        return res.status(400).json({
          success: false,
          message: 'Giới tính không hợp lệ (chỉ chấp nhận MALE, FEMALE hoặc OTHER)',
        });
      }
      user.gender = gender;
    }

    // Validate và cập nhật Nhóm máu
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

    // Cập nhật Họ và tên nếu có
    const resolvedName = fullName !== undefined ? fullName : name;
    if (resolvedName !== undefined && typeof resolvedName === 'string' && resolvedName.trim()) {
      user.fullName = resolvedName.trim();
      user.name = resolvedName.trim();
    }

    // Cập nhật Ảnh đại diện nếu có
    if (avatarUrl !== undefined && typeof avatarUrl === 'string') {
      user.avatarUrl = avatarUrl.trim();
      user.avatar = avatarUrl.trim();
    }

    // Cập nhật Bio nếu có
    if (bio !== undefined && typeof bio === 'string') {
      user.bio = bio.trim();
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
        avatarUrl: user.avatarUrl || user.avatar,
        bio: user.bio,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        birthDate: user.birthDate,
        gender: user.gender,
        bloodType: user.bloodType,
        bmi: user.bmi,
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
