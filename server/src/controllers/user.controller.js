import { User } from '../models/User.js';

/**
 * @desc    Lấy thông tin hồ sơ & thể trạng của người dùng hiện tại
 * @route   GET /api/users/profile, GET /api/v1/users/profile
 * @access  Private (Cần Bearer Token)
 */
export const getUserProfile = async (req, res) => {
  try {
    const user = req.user;

    return res.status(200).json({
      success: true,
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
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin hồ sơ',
      error: error.message,
    });
  }
};

/**
 * @desc    Cập nhật thông tin thể trạng và hồ sơ cá nhân của user
 * @route   PUT /api/users/profile, PUT /api/v1/users/profile
 * @access  Private (Cần Bearer Token)
 */
export const updateUserProfile = async (req, res) => {
  try {
    const {
      heightCm,
      weightKg,
      birthDate,
      gender,
      bloodType,
      fullName,
      name,
      avatarUrl,
      avatar,
      bio,
    } = req.body;

    const user = req.user;

    // 1. Cập nhật Chiều cao (cm)
    if (heightCm !== undefined && heightCm !== null && heightCm !== '') {
      user.heightCm = Number(heightCm);
    }

    // 2. Cập nhật Cân nặng (kg)
    if (weightKg !== undefined && weightKg !== null && weightKg !== '') {
      user.weightKg = Number(weightKg);
    }

    // 3. Cập nhật Ngày sinh
    if (birthDate !== undefined) {
      if (birthDate === null || birthDate === '') {
        user.birthDate = undefined;
      } else {
        user.birthDate = new Date(birthDate);
      }
    }

    // 4. Cập nhật Giới tính
    if (gender !== undefined && gender !== null && gender !== '') {
      user.gender = gender;
    }

    // 5. Cập nhật Nhóm máu
    if (bloodType !== undefined && bloodType !== null && bloodType !== '') {
      user.bloodType = bloodType;
    }

    // 6. Cập nhật Họ và tên
    const resolvedName = fullName !== undefined ? fullName : name;
    if (resolvedName !== undefined && typeof resolvedName === 'string') {
      const trimmed = resolvedName.trim();
      user.fullName = trimmed;
      user.name = trimmed;
    }

    // 7. Cập nhật Avatar
    const resolvedAvatar = avatarUrl !== undefined ? avatarUrl : avatar;
    if (resolvedAvatar !== undefined && typeof resolvedAvatar === 'string') {
      const trimmedAvatar = resolvedAvatar.trim();
      user.avatarUrl = trimmedAvatar;
      user.avatar = trimmedAvatar;
    }

    // 8. Cập nhật Tiểu sử / ghi chú sức khỏe
    if (bio !== undefined && typeof bio === 'string') {
      user.bio = bio.trim();
    }

    // Lưu vào database
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thể trạng cá nhân thành công',
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
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật thông tin thể trạng',
      error: error.message,
    });
  }
};
