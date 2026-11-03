import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Family } from '../src/models/Family.js';
import { HealthRecord } from '../src/models/HealthRecord.js';
import { SharingPolicy } from '../src/models/SharingPolicy.js';
import { AiTrendSummary } from '../src/models/AiTrendSummary.js';
import { MANDATORY_DISCLAIMER } from '../src/services/ai.service.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthjourney_test';

describe('Integration Test: AI Health Trend Assistant (Jira SCRUM-54 / E6-S1)', () => {
  let userA, tokenA;
  let userB, tokenB;
  let testFamily;
  const testEmails = [
    'ai_test_owner_a@example.com',
    'ai_test_viewer_b@example.com',
  ];

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    await User.deleteMany({ email: { $in: testEmails } });
    await HealthRecord.deleteMany({ note: { $regex: 'TEST_AI_' } });
    await AiTrendSummary.deleteMany({});

    userA = await User.create({
      email: testEmails[0],
      password: 'password123',
      fullName: 'AI Test User A',
      name: 'AI Test User A',
      heightCm: 170,
    });
    tokenA = jwt.sign({ id: userA._id }, JWT_SECRET, { expiresIn: '1d' });

    userB = await User.create({
      email: testEmails[1],
      password: 'password123',
      fullName: 'AI Test User B',
      name: 'AI Test User B',
      heightCm: 165,
    });
    tokenB = jwt.sign({ id: userB._id }, JWT_SECRET, { expiresIn: '1d' });

    testFamily = await Family.create({
      name: 'Gia đình AI Test',
      createdBy: userA._id,
      members: [
        { userId: userA._id, role: 'ADMIN', joinedAt: new Date() },
        { userId: userB._id, role: 'MEMBER', joinedAt: new Date() },
      ],
    });
  });

  after(async () => {
    if (testFamily) {
      await SharingPolicy.deleteMany({ familyId: testFamily._id });
      await Family.findByIdAndDelete(testFamily._id);
    }
    await User.deleteMany({ email: { $in: testEmails } });
    await HealthRecord.deleteMany({ note: { $regex: 'TEST_AI_' } });
    await AiTrendSummary.deleteMany({});
    await mongoose.disconnect();
  });

  describe('1. Kiểm tra điều kiện tối thiểu 3 bản ghi dữ liệu (AC4 SCRUM-54)', () => {
    it('1.1 Khi chưa có đủ 3 bản ghi -> Trả về 400 kèm mã INSUFFICIENT_DATA', async () => {
      // Hiện tại User A chưa có bản ghi nào
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'INSUFFICIENT_DATA');
      assert.equal(res.body.recordCount, 0);
      assert.equal(res.body.minRequired, 3);
      assert.match(res.body.message, /tối thiểu 3 bản ghi/i);
    });
  });

  describe('2. Tạo tóm tắt xu hướng sức khỏe (AC1, AC2, AC3 SCRUM-54)', () => {
    before(async () => {
      // Tạo 4 bản ghi cho User A
      await HealthRecord.create({
        userId: userA._id,
        type: 'BLOOD_PRESSURE',
        systolic: 120,
        diastolic: 80,
        unit: 'mmHg',
        recordedAt: new Date(Date.now() - 3 * 86400000),
        note: 'TEST_AI_BP_1',
      });
      await HealthRecord.create({
        userId: userA._id,
        type: 'BLOOD_PRESSURE',
        systolic: 125,
        diastolic: 82,
        unit: 'mmHg',
        recordedAt: new Date(Date.now() - 2 * 86400000),
        note: 'TEST_AI_BP_2',
      });
      await HealthRecord.create({
        userId: userA._id,
        type: 'HEART_RATE',
        value: 75,
        unit: 'bpm',
        recordedAt: new Date(Date.now() - 86400000),
        note: 'TEST_AI_HR_1',
      });
      await HealthRecord.create({
        userId: userA._id,
        type: 'WEIGHT',
        value: 68,
        bmi: 23.5,
        unit: 'kg',
        recordedAt: new Date(),
        note: 'TEST_AI_WEIGHT_1',
      });
    });

    it('2.1 Tự tóm tắt sức khỏe của mình -> Thành công, Markdown có đủ 3 mục và Disclaimer bắt buộc', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.summary);
      assert.equal(res.body.recordCount, 4);

      // AC2: Kiểm tra 3 phần mục markdown
      assert.match(res.body.summary, /Xu hướng chính/i);
      assert.match(res.body.summary, /Điểm tích cực/i);
      assert.match(res.body.summary, /Lưu ý sinh hoạt/i);

      // AC3: Disclaimer y tế bắt buộc
      assert.ok(res.body.disclaimer);
      assert.match(res.body.disclaimer, /không thay thế cho chẩn đoán của bác sĩ/i);
      assert.match(res.body.summary, /không thay thế cho chẩn đoán của bác sĩ/i);
    });

    it('2.2 Cache theo ngày -> Lần gọi thứ 2 trả về fromCache: true', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.fromCache, true);
    });
  });

  describe('3. Phân quyền và Default Deny khi tóm tắt dữ liệu người thân (SCRUM-49 / SCRUM-54)', () => {
    it('3.1 User B tóm tắt dữ liệu User A khi chưa được chia sẻ quyền -> Bị chặn 403 Default Deny', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          memberId: userA._id.toString(),
          familyId: testFamily._id.toString(),
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'ACCESS_DENIED');
      assert.match(res.body.message, /Default Deny/i);
    });

    it('3.2 User A cấp quyền BLOOD_PRESSURE cho User B -> User B tóm tắt thành công với dữ liệu được cấp quyền', async () => {
      // Cấp quyền BLOOD_PRESSURE
      await SharingPolicy.findOneAndUpdate(
        { ownerId: userA._id, viewerId: userB._id, familyId: testFamily._id },
        { allowedMetrics: ['BLOOD_PRESSURE'] },
        { upsert: true, new: true }
      );

      // Tạo thêm 1 bản ghi BP nữa để User A có ít nhất 3 bản ghi BP
      await HealthRecord.create({
        userId: userA._id,
        type: 'BLOOD_PRESSURE',
        systolic: 122,
        diastolic: 81,
        unit: 'mmHg',
        recordedAt: new Date(),
        note: 'TEST_AI_BP_3',
      });

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          memberId: userA._id.toString(),
          familyId: testFamily._id.toString(),
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.summary);
      assert.equal(res.body.recordCount, 3); // Chỉ gồm 3 bản ghi BLOOD_PRESSURE được chia sẻ
      assert.match(res.body.summary, /Huyết áp/i);
    });
  });

  describe('4. Ngoại lệ & Bảo mật', () => {
    it('4.1 Trả về 401 khi không gửi token', async () => {
      const res = await request(app).post('/api/ai/summarize-trends').send({});
      assert.equal(res.status, 401);
    });
  });
});
