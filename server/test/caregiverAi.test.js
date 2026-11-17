import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Family } from '../src/models/Family.js';
import { SharingPolicy } from '../src/models/SharingPolicy.js';
import { HealthRecord } from '../src/models/HealthRecord.js';
import { Notification } from '../src/models/Notification.js';
import { Streak } from '../src/models/Streak.js';
import { AISummaryCache } from '../src/models/AISummaryCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
process.env.NODE_ENV = 'test';

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: Caregiver Features & AI Diet/Workout Plans', () => {
  let caregiverUser, caregiverToken;
  let siblingUser, siblingToken;
  let outsiderUser, outsiderToken;
  let testFamily;
  let dependentUserId;

  const testEmails = [
    'caregiver_main@example.com',
    'caregiver_sibling@example.com',
    'caregiver_outsider@example.com',
  ];

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_CAREGIVER\]/ });

    caregiverUser = await User.create({
      email: testEmails[0],
      password: 'password123',
      fullName: 'Con Cả Chăm Sóc',
      heightCm: 170,
    });

    siblingUser = await User.create({
      email: testEmails[1],
      password: 'password123',
      fullName: 'Em Gái Gia Đình',
      heightCm: 160,
    });

    outsiderUser = await User.create({
      email: testEmails[2],
      password: 'password123',
      fullName: 'Người Ngoài Nhóm',
    });

    caregiverToken = jwt.sign({ id: caregiverUser._id }, JWT_SECRET, { expiresIn: '1d' });
    siblingToken = jwt.sign({ id: siblingUser._id }, JWT_SECRET, { expiresIn: '1d' });
    outsiderToken = jwt.sign({ id: outsiderUser._id }, JWT_SECRET, { expiresIn: '1d' });

    testFamily = await Family.create({
      name: '[TEST_CAREGIVER] Gia Đình Hạnh Phúc',
      createdBy: caregiverUser._id,
      members: [
        { userId: caregiverUser._id, role: 'ADMIN' },
        { userId: siblingUser._id, role: 'MEMBER' },
      ],
    });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      const createdIds = [caregiverUser?._id, siblingUser?._id, outsiderUser?._id, dependentUserId].filter(Boolean);
      if (dependentUserId) {
        await User.findByIdAndDelete(dependentUserId);
      }
      await User.deleteMany({ email: { $in: testEmails } });
      if (testFamily) {
        await Family.findByIdAndDelete(testFamily._id);
        await SharingPolicy.deleteMany({ familyId: testFamily._id });
      }
      await HealthRecord.deleteMany({ userId: { $in: createdIds } });
      await Notification.deleteMany({
        $or: [{ recipientId: { $in: createdIds } }, { senderId: { $in: createdIds } }],
      });
      await Streak.deleteMany({ userId: { $in: createdIds } });
      await AISummaryCache.deleteMany({
        $or: [{ targetUserId: { $in: createdIds } }, { requesterId: { $in: createdIds } }],
      });
      await mongoose.disconnect();
    }
  });

  describe('1. Hồ sơ phụ thuộc & Ghi chỉ số hộ (Caregiver Mode)', () => {
    it('1.1 POST /api/families/:id/dependents -> Tạo hồ sơ phụ thuộc (Bà Nội) và tự cấp quyền cho người tạo', async () => {
      const res = await request(app)
        .post(`/api/families/${testFamily._id}/dependents`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          fullName: 'Bà Nội Test',
          relationship: 'Bà nội',
          gender: 'FEMALE',
          heightCm: 155,
          weightKg: 60,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.dependent.isDependent, true);
      assert.equal(res.body.dependent.relationship, 'Bà nội');
      dependentUserId = res.body.dependent._id || res.body.dependent.id;

      // Kiểm tra sibling vẫn bị Default Deny khi chưa cấp quyền
      const overviewSibling = await request(app)
        .get(`/api/families/${testFamily._id}/members/${dependentUserId}/health-overview`)
        .set('Authorization', `Bearer ${siblingToken}`);

      assert.equal(overviewSibling.status, 200);
      assert.deepEqual(overviewSibling.body.allowedMetrics, []);
    });

    it('1.2 POST /api/health-records -> Caregiver ghi hộ cân nặng & huyết áp nguy kịch cho Bà Nội', async () => {
      // Ghi cân nặng (155cm, 62kg -> BMI ~ 25.8)
      const weightRes = await request(app)
        .post('/api/health-records')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          targetUserId: dependentUserId,
          type: 'WEIGHT',
          value: 62,
          note: 'Đo hộ buổi sáng',
        });

      assert.equal(weightRes.status, 201);
      assert.equal(weightRes.body.data.userId, dependentUserId);
      assert.equal(weightRes.body.data.recordedBy, caregiverUser._id.toString());
      assert.equal(weightRes.body.data.bmi, 25.8);

      // Ghi 2 bản ghi huyết áp (1 bản ghi nguy kịch >= 160/100) để test cảnh báo & AI (>= 3 records)
      await request(app)
        .post('/api/health-records')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          targetUserId: dependentUserId,
          type: 'BLOOD_PRESSURE',
          systolic: 135,
          diastolic: 85,
        });

      const bpRes = await request(app)
        .post('/api/health-records')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          targetUserId: dependentUserId,
          type: 'BLOOD_PRESSURE',
          systolic: 165,
          diastolic: 102,
        });

      assert.equal(bpRes.status, 201);
      assert.equal(bpRes.body.alert?.triggered, true);
      assert.ok(bpRes.body.alert.recipientsNotified.includes(caregiverUser._id.toString()));
    });

    it('1.3 Bảo mật: Chặn người ngoài hoặc thành viên không có quyền ghi hộ chỉ số cho user khác', async () => {
      // Sibling (role MEMBER, không phải managedBy) không được ghi hộ
      const siblingAttempt = await request(app)
        .post('/api/health-records')
        .set('Authorization', `Bearer ${siblingToken}`)
        .send({
          targetUserId: dependentUserId,
          type: 'HEART_RATE',
          value: 80,
        });
      assert.equal(siblingAttempt.status, 403);

      // Caregiver không được phép ghi hộ cho tài khoản độc lập (sibling)
      const regularUserAttempt = await request(app)
        .post('/api/health-records')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          targetUserId: siblingUser._id.toString(),
          type: 'HEART_RATE',
          value: 80,
        });
      assert.equal(regularUserAttempt.status, 403);
    });

    it('1.4 Caregiver chia sẻ quyền xem Huyết áp của Bà Nội cho Em Gái qua Privacy Matrix', async () => {
      const updatePolicy = await request(app)
        .put(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          ownerId: dependentUserId,
          viewerId: siblingUser._id.toString(),
          allowedMetrics: ['BLOOD_PRESSURE'],
        });

      assert.equal(updatePolicy.status, 200);

      const siblingOverview = await request(app)
        .get(`/api/families/${testFamily._id}/members/${dependentUserId}/health-overview`)
        .set('Authorization', `Bearer ${siblingToken}`);

      assert.equal(siblingOverview.status, 200);
      assert.deepEqual(siblingOverview.body.allowedMetrics, ['BLOOD_PRESSURE']);
      assert.equal(siblingOverview.body.metrics.BLOOD_PRESSURE.hasAccess, true);
      assert.equal(siblingOverview.body.metrics.WEIGHT.hasAccess, false);
    });
  });

  describe('2. Nút nhắc người thân (Care Nudge)', () => {
    it('2.1 POST /api/families/:familyId/members/:memberId/nudge -> Gửi lời nhắc thành công', async () => {
      const res = await request(app)
        .post(`/api/families/${testFamily._id}/members/${siblingUser._id}/nudge`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          category: 'MEASUREMENT',
          message: 'Em nhớ đo huyết áp tối nay nhé!',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.notification.type, 'CARE_NUDGE');
      assert.equal(res.body.notification.recipientId, siblingUser._id.toString());
    });

    it('2.2 Chặn tự nhắc mình, nhắc hồ sơ phụ thuộc hoặc người ngoài nhóm', async () => {
      const selfAttempt = await request(app)
        .post(`/api/families/${testFamily._id}/members/${caregiverUser._id}/nudge`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({});
      assert.equal(selfAttempt.status, 400);

      const depAttempt = await request(app)
        .post(`/api/families/${testFamily._id}/members/${dependentUserId}/nudge`)
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({});
      assert.equal(depAttempt.status, 400);

      const outsiderAttempt = await request(app)
        .post(`/api/families/${testFamily._id}/members/${siblingUser._id}/nudge`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({});
      assert.equal(outsiderAttempt.status, 403);
    });
  });

  describe('3. AI Tóm tắt kèm Quy trình Ăn uống & Tập luyện phù hợp', () => {
    it('3.1 POST /api/ai/summarize-trends -> Trả về Quy trình ăn uống và Quy trình tập luyện dựa trên chỉ số', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${caregiverToken}`)
        .send({
          targetUserId: dependentUserId,
          familyId: testFamily._id.toString(),
          forceRefresh: true,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.summary.includes('Xu hướng chính'));
      assert.ok(res.body.summary.includes('Quy trình ăn uống phù hợp'));
      assert.ok(res.body.summary.includes('Quy trình tập luyện phù hợp'));
      // Kiểm tra gợi ý DASH / Huyết áp cao / BMI đã được sinh tương ứng với số liệu của Bà Nội
      assert.ok(res.body.summary.includes('DASH') || res.body.summary.includes('muối'));
    });
  });
});
