import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Family } from '../src/models/Family.js';
import { FamilyInvitation } from '../src/models/FamilyInvitation.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: Family Invitation API (Jira SCRUM-38)', () => {
  let adminUser, adminToken;
  let memberUser, memberToken;
  let inviteeUser, inviteeToken;
  let testFamily;
  let validInvitationToken;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Dọn dẹp dữ liệu test cũ
    const testEmails = [
      'admin_family_test@example.com',
      'member_family_test@example.com',
      'invitee_family_test@example.com',
      'someone_expired@example.com',
      'decline_test_user@example.com',
    ];
    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST\]/ });
    await FamilyInvitation.deleteMany({ invitedEmail: { $in: testEmails } });

    // Tạo Admin User
    adminUser = await User.create({
      email: 'admin_family_test@example.com',
      passwordHash: 'dummyHash',
      name: 'Family Admin',
      fullName: 'Family Admin',
    });
    adminToken = jwt.sign({ id: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });

    // Tạo Member User
    memberUser = await User.create({
      email: 'member_family_test@example.com',
      passwordHash: 'dummyHash',
      name: 'Regular Member',
      fullName: 'Regular Member',
    });
    memberToken = jwt.sign({ id: memberUser._id }, JWT_SECRET, { expiresIn: '1h' });

    // Tạo Invitee User (Người nhận lời mời)
    inviteeUser = await User.create({
      email: 'invitee_family_test@example.com',
      passwordHash: 'dummyHash',
      name: 'Invitee User',
      fullName: 'Invitee User',
    });
    inviteeToken = jwt.sign({ id: inviteeUser._id }, JWT_SECRET, { expiresIn: '1h' });

    // Tạo nhóm gia đình test với adminUser là ADMIN và memberUser là MEMBER
    testFamily = await Family.create({
      name: '[TEST] Gia đình Hạnh Phúc',
      createdBy: adminUser._id,
      members: [
        {
          userId: adminUser._id,
          role: 'ADMIN',
          joinedAt: new Date(),
        },
        {
          userId: memberUser._id,
          role: 'MEMBER',
          joinedAt: new Date(),
        },
      ],
    });
  });

  after(async () => {
    const testEmails = [
      'admin_family_test@example.com',
      'member_family_test@example.com',
      'invitee_family_test@example.com',
    ];
    await FamilyInvitation.deleteMany({ invitedEmail: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST\]/ });
    await User.deleteMany({ email: { $in: testEmails } });
    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. TEST POST /api/families/:id/invite (Gửi lời mời)
  // =========================================================================
  describe('1. API POST /api/families/:id/invite', () => {
    it('1.1 Admin gửi lời mời thành công (201 Created)', async () => {
      const res = await request(app)
        .post(`/api/families/${testFamily._id}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'invitee_family_test@example.com',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.invitation?.token);
      assert.equal(res.body.invitation.status, 'PENDING');
      assert.equal(res.body.invitation.invitedEmail, 'invitee_family_test@example.com');

      // Kiểm tra hạn 48 giờ
      const expiresAt = new Date(res.body.invitation.expiresAt);
      const diffHours = (expiresAt - new Date()) / (1000 * 60 * 60);
      assert.ok(diffHours >= 47 && diffHours <= 49);

      validInvitationToken = res.body.invitation.token;
    });

    it('1.2 Thành viên không phải ADMIN không được gửi lời mời (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/families/${testFamily._id}/invite`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          email: 'other_user@example.com',
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('1.3 Chặn khi gửi lời mời cho chính mình (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/families/${testFamily._id}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: adminUser.email,
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('1.4 Chặn khi mời người đã là thành viên trong nhóm (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/families/${testFamily._id}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: memberUser.email,
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('1.5 Chặn khi định dạng email không hợp lệ (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/families/${testFamily._id}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'not-an-email',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors?.email);
    });

    it('1.6 Trả về 404 khi Family ID không tồn tại', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/families/${nonExistentId}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new_person@example.com',
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  // =========================================================================
  // 2. TEST GET /api/invitations/:token (Xem chi tiết lời mời)
  // =========================================================================
  describe('2. API GET /api/invitations/:token', () => {
    it('2.1 Xem thông tin lời mời thành công bằng token hợp lệ', async () => {
      const res = await request(app)
        .get(`/api/invitations/${validInvitationToken}`)
        .set('Authorization', `Bearer ${inviteeToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.invitation.familyName, '[TEST] Gia đình Hạnh Phúc');
      assert.equal(res.body.invitation.invitedEmail, 'invitee_family_test@example.com');
      assert.equal(res.body.invitation.status, 'PENDING');
      assert.equal(res.body.invitation.isExpired, false);
    });

    it('2.2 Trả về 404 khi token không tồn tại', async () => {
      const res = await request(app)
        .get('/api/invitations/invalid-fake-token-12345')
        .set('Authorization', `Bearer ${inviteeToken}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  // =========================================================================
  // 3. TEST POST /api/invitations/:token/accept (Chấp nhận lời mời)
  // =========================================================================
  describe('3. API POST /api/invitations/:token/accept', () => {
    it('3.1 Accept thành công: chuyển status sang ACCEPTED và thêm vào members nhóm', async () => {
      const res = await request(app)
        .post(`/api/invitations/${validInvitationToken}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Kiểm tra bản ghi trong DB
      const updatedInvitation = await FamilyInvitation.findOne({ token: validInvitationToken });
      assert.equal(updatedInvitation.status, 'ACCEPTED');

      // Kiểm tra user đã vào members của Family
      const updatedFamily = await Family.findById(testFamily._id);
      const isMember = updatedFamily.members.some(
        (m) => m.userId.toString() === inviteeUser._id.toString() && m.role === 'MEMBER'
      );
      assert.ok(isMember);
    });

    it('3.2 Không thể Accept lại lời mời đã xử lý (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/invitations/${validInvitationToken}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('3.3 Không thể Accept lời mời đã hết hạn sau 48h (400 Bad Request)', async () => {
      // Tạo lời mời đã hết hạn
      const expiredToken = `expired-test-token-${Date.now()}`;
      const expiredInvite = await FamilyInvitation.create({
        familyId: testFamily._id,
        inviterId: adminUser._id,
        invitedEmail: 'someone_expired@example.com',
        token: expiredToken,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000 * 60), // Hết hạn 1 phút trước
      });

      const res = await request(app)
        .post(`/api/invitations/${expiredInvite.token}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /hết hạn/i);
    });
  });

  // =========================================================================
  // 4. TEST POST /api/invitations/:token/decline (Từ chối lời mời)
  // =========================================================================
  describe('4. API POST /api/invitations/:token/decline', () => {
    let declineToken;

    before(async () => {
      // Admin gửi lời mời mới để test decline
      const res = await request(app)
        .post(`/api/families/${testFamily._id}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'decline_test_user@example.com',
        });
      declineToken = res.body.invitation.token;
    });

    it('4.1 Decline thành công: chuyển status sang DECLINED và không thêm vào nhóm', async () => {
      const res = await request(app)
        .post(`/api/invitations/${declineToken}/decline`)
        .set('Authorization', `Bearer ${inviteeToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, 'DECLINED');

      const updatedInvitation = await FamilyInvitation.findOne({ token: declineToken });
      assert.equal(updatedInvitation.status, 'DECLINED');
    });

    it('4.2 Không thể Decline lại lời mời đã từ chối (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/invitations/${declineToken}/decline`)
        .set('Authorization', `Bearer ${inviteeToken}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });
});
