import multer from 'multer';

// Lưu file vào bộ nhớ RAM tạm thời để upload thẳng lên Cloudinary
const storage = multer.memoryStorage();

// Chỉ cho phép upload file ảnh (jpg, jpeg, png, webp)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file định dạng hình ảnh (PNG, JPG, WEBP)!'), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Tối đa 5MB
  fileFilter,
});
