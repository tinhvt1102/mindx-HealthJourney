import cloudinary from '../config/cloudinary.js';
import { User } from '../models/User.js';

/**
 * Upload Avatar lên Cloudinary và cập nhật trực tiếp vào tài khoản User
 * @route POST /api/v1/upload/avatar
 * @access Private (yêu cầu Bearer Token)
 */
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn 1 file hình ảnh để upload',
      });
    }

    // Kiểm tra cấu hình Cloudinary trong .env
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || CLOUDINARY_API_SECRET === 'dien_api_secret_vao_day') {
      return res.status(503).json({
        success: false,
        message: 'Dịch vụ Cloudinary chưa được cấu hình API Secret trong file server/.env!',
      });
    }

    // Đảm bảo cloudinary SDK luôn nhận đúng config mới nhất
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });

    // Upload buffer lên Cloudinary
    const uploadStream = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'healthjourney/avatars',
            transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
    };

    const result = await uploadStream();

    // Cập nhật URL ảnh mới vào User hiện tại
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: result.secure_url, avatarUrl: result.secure_url },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Upload ảnh đại diện thành công',
      avatarUrl: result.secure_url,
      user,
    });
  } catch (error) {
    console.error('[Upload Avatar Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi upload ảnh lên Cloudinary',
      error: error.message,
    });
  }
};
