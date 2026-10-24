import mongoose from 'mongoose';

// Schema thành viên trong nhóm gia đình
const familyMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID là bắt buộc'],
    },
    role: {
      type: String,
      enum: {
        values: ['ADMIN', 'MEMBER'],
        message: 'Vai trò chỉ có thể là ADMIN hoặc MEMBER',
      },
      default: 'MEMBER',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Schema Nhóm gia đình (Jira SCRUM-33: name, createdBy, members)
const familySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên nhóm gia đình là bắt buộc'],
      trim: true,
      minlength: [3, 'Tên nhóm gia đình phải có ít nhất 3 ký tự'],
      maxlength: [50, 'Tên nhóm gia đình không được vượt quá 50 ký tự'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người tạo nhóm là bắt buộc'],
    },
    members: {
      type: [familyMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index phục vụ tìm kiếm các gia đình mà một user tham gia
familySchema.index({ 'members.userId': 1 });

export const Family = mongoose.model('Family', familySchema);
