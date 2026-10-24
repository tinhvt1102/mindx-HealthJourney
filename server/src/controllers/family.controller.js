import mongoose from 'mongoose';
import { Family } from '../models/Family.js';

/**
 * @desc    Tạo nhóm gia đình mới (Jira SCRUM-32: Người tạo nhóm tự động là Family Admin)
 * @route   POST /api/families, POST /api/v1/families
 * @access  Private
 */
export const createFamily = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Tên nhóm gia đình phải từ 3 đến 50 ký tự',
      });
    }

    const family = new Family({
      name: name.trim(),
      createdBy: req.user._id,
      members: [
        {
          userId: req.user._id,
          role: 'ADMIN',
          joinedAt: new Date(),
        },
      ],
    });

    await family.save();

    return res.status(201).json({
      success: true,
      message: 'Tạo nhóm gia đình thành công',
      family,
    });
  } catch (error) {
    console.error('Error creating family:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo nhóm gia đình',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy chi tiết nhóm gia đình
 * @route   GET /api/families/:id, GET /api/v1/families/:id
 * @access  Private
 */
export const getFamilyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    const family = await Family.findById(id)
      .populate('createdBy', 'name fullName email avatar avatarUrl')
      .populate('members.userId', 'name fullName email avatar avatarUrl');

    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    // Kiểm tra quyền xem: phải là thành viên trong nhóm
    const currentUserId = req.user._id.toString();
    const isMember = family.members.some(
      (m) => m.userId?._id?.toString() === currentUserId || m.userId?.toString() === currentUserId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của nhóm gia đình này',
      });
    }

    return res.status(200).json({
      success: true,
      family,
    });
  } catch (error) {
    console.error('Error getting family by id:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết nhóm gia đình',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy danh sách các nhóm gia đình mà user tham gia
 * @route   GET /api/families, GET /api/v1/families
 * @access  Private
 */
export const getMyFamilies = async (req, res) => {
  try {
    const families = await Family.find({
      'members.userId': req.user._id,
    }).populate('createdBy', 'name fullName email');

    return res.status(200).json({
      success: true,
      count: families.length,
      families,
    });
  } catch (error) {
    console.error('Error getting my families:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách nhóm gia đình',
      error: error.message,
    });
  }
};
