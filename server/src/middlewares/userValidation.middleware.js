/**
 * Middleware validation cho cập nhật hồ sơ & thông tin thể trạng người dùng
 */
export const validateUpdateProfile = (req, res, next) => {
  const { heightCm, weightKg, birthDate, gender, bloodType, fullName, name, bio, avatarUrl, avatar } = req.body;
  const errors = {};

  // 1. Validation Chiều cao (heightCm)
  if (heightCm !== undefined && heightCm !== null && heightCm !== '') {
    const height = Number(heightCm);
    if (isNaN(height) || !Number.isFinite(height)) {
      errors.heightCm = 'Chiều cao phải là một số hợp lệ';
    } else if (height < 50 || height > 250) {
      errors.heightCm = 'Chiều cao phải nằm trong khoảng từ 50cm đến 250cm';
    }
  }

  // 2. Validation Cân nặng (weightKg)
  if (weightKg !== undefined && weightKg !== null && weightKg !== '') {
    const weight = Number(weightKg);
    if (isNaN(weight) || !Number.isFinite(weight)) {
      errors.weightKg = 'Cân nặng phải là một số hợp lệ';
    } else if (weight < 10 || weight > 300) {
      errors.weightKg = 'Cân nặng phải nằm trong khoảng từ 10kg đến 300kg';
    }
  }

  // 3. Validation Ngày sinh (birthDate)
  if (birthDate !== undefined && birthDate !== null && birthDate !== '') {
    const parsedDate = new Date(birthDate);
    if (isNaN(parsedDate.getTime())) {
      errors.birthDate = 'Ngày sinh không đúng định dạng ngày tháng hợp lệ';
    } else {
      const now = new Date();
      if (parsedDate > now) {
        errors.birthDate = 'Ngày sinh không thể ở thời điểm tương lai';
      }
      // Giới hạn tuổi hợp lý (ví dụ: không quá 120 tuổi)
      const earliestAllowed = new Date();
      earliestAllowed.setFullYear(now.getFullYear() - 120);
      if (parsedDate < earliestAllowed) {
        errors.birthDate = 'Ngày sinh không hợp lệ (vượt quá 120 năm)';
      }
    }
  }

  // 4. Validation Giới tính (gender)
  if (gender !== undefined && gender !== null && gender !== '') {
    const validGenders = ['MALE', 'FEMALE', 'OTHER'];
    if (!validGenders.includes(gender)) {
      errors.gender = 'Giới tính không hợp lệ (chỉ chấp nhận: MALE, FEMALE, OTHER)';
    }
  }

  // 5. Validation Nhóm máu (bloodType)
  if (bloodType !== undefined && bloodType !== null && bloodType !== '') {
    const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];
    if (!validBloodTypes.includes(bloodType)) {
      errors.bloodType = 'Nhóm máu không hợp lệ (hỗ trợ: A+, A-, B+, B-, AB+, AB-, O+, O-, UNKNOWN)';
    }
  }

  // 6. Validation Họ tên (fullName / name)
  const nameToCheck = fullName !== undefined ? fullName : name;
  if (nameToCheck !== undefined && nameToCheck !== null) {
    if (typeof nameToCheck !== 'string' || nameToCheck.trim().length === 0) {
      errors.fullName = 'Họ tên không được để trống';
    } else if (nameToCheck.trim().length > 60) {
      errors.fullName = 'Họ tên không được vượt quá 60 ký tự';
    }
  }

  // 7. Validation Tiểu sử (bio)
  if (bio !== undefined && bio !== null && typeof bio === 'string') {
    if (bio.trim().length > 250) {
      errors.bio = 'Tiểu sử không được vượt quá 250 ký tự';
    }
  }

  // 8. Validation Ảnh đại diện (avatarUrl hoặc avatar)
  const avatarKey = avatarUrl !== undefined ? 'avatarUrl' : 'avatar';
  const avatarInput = avatarUrl !== undefined ? avatarUrl : avatar;
  if (avatarInput !== undefined && avatarInput !== null) {
    if (typeof avatarInput !== 'string') {
      errors[avatarKey] = 'Ảnh đại diện phải là chuỗi hợp lệ';
    } else {
      const trimmedAvatar = avatarInput.trim();
      // Nếu không rỗng, kiểm tra định dạng hợp lệ
      if (trimmedAvatar !== '') {
        const isHttpUrl = /^https?:\/\/[^\s]+$/i.test(trimmedAvatar);
        const isDataUri = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmedAvatar);
        const isRelativePath = /^\/(uploads|images|avatars)\/[^\s]+$/i.test(trimmedAvatar);

        if (!isHttpUrl && !isDataUri && !isRelativePath) {
          errors[avatarKey] = 'Đường dẫn ảnh đại diện không hợp lệ (phải là URL http/https hoặc chuỗi ảnh base64 hợp lệ)';
        }
      }
    }
  }

  // Nếu có lỗi validation, trả về 400 Bad Request
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu thông tin thể trạng không hợp lệ',
      errors,
    });
  }

  next();
};
