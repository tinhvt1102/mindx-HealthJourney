import { describe, it, before, after, beforeEach } from 'node:test';
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
import { HealthRecord } from '../src/models/HealthRecord.js';
import { SharingPolicy } from '../src/models/SharingPolicy.js';
import { AISummaryCache } from '../src/models/AISummaryCache.js';
import { geminiClientFactory, MANDATORY_DISCLAIMER } from '../src/services/ai.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';
const getTodayUTC = () => new Date().toISOString().slice(0, 10);

describe('Integration & Mock Test: AI Summary Trends (Jira SCRUM-54 / SCRUM-59)', () => {
  let userA, tokenA; // Owner
  let userB, tokenB; // Viewer trong Family
  let userStranger, tokenStranger; // Người lạ
  let testFamily;

  const testEmails = [
    'ai_mock_owner_a@example.com',
    'ai_mock_viewer_b@example.com',
    'ai_mock_stranger@example.com',
  ];

  const originalCreateClient = geminiClientFactory.createClient;
  const originalApiKey = process.env.GEMINI_API_KEY;

  before(async () => {
    process.env.GEMINI_API_KEY = 'test_mock_gemini_api_key_valid';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
    }

    // Dọn dẹp dữ liệu cũ
    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_AI_MOCK\]/ });
    await HealthRecord.deleteMany({ note: /^\[TEST_AI_MOCK_REC\]/ });
    await SharingPolicy.deleteMany({});
    await AISummaryCache.deleteMany({});

    // 1. Tạo Users
    userA = await User.create({
      email: 'ai_mock_owner_a@example.com',
      passwordHash: 'dummyHash',
      name: 'Mock Owner Nguyen',
      fullName: 'Mock Owner Nguyen',
    });
    tokenA = jwt.sign({ id: userA._id }, JWT_SECRET, { expiresIn: '1h' });

    userB = await User.create({
      email: 'ai_mock_viewer_b@example.com',
      passwordHash: 'dummyHash',
      name: 'Mock Viewer Tran',
      fullName: 'Mock Viewer Tran',
    });
    tokenB = jwt.sign({ id: userB._id }, JWT_SECRET, { expiresIn: '1h' });

    userStranger = await User.create({
      email: 'ai_mock_stranger@example.com',
      passwordHash: 'dummyHash',
      name: 'Mock Stranger Le',
      fullName: 'Mock Stranger Le',
    });
    tokenStranger = jwt.sign({ id: userStranger._id }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Tạo Family gồm userA (Admin), userB (Member)
    testFamily = await Family.create({
      name: '[TEST_AI_MOCK] Gia đình Mock AI',
      createdBy: userA._id,
      members: [
        { userId: userA._id, role: 'ADMIN', joinedAt: new Date() },
        { userId: userB._id, role: 'MEMBER', joinedAt: new Date() },
      ],
    });

    // 3. Tạo dữ liệu chỉ số cho userA
    const baseDate = new Date('2026-10-10T08:00:00Z');
    for (let i = 0; i < 4; i++) {
      await HealthRecord.create({
        userId: userA._id,
        type: 'BLOOD_PRESSURE',
        systolic: 115 + i * 2,
        diastolic: 75 + i,
        unit: 'mmHg',
        note: `[TEST_AI_MOCK_REC] Huyết áp ngày ${i + 1}`,
        recordedAt: new Date(baseDate.getTime() + i * 86400000),
      });
    }

    for (let i = 0; i < 4; i++) {
      await HealthRecord.create({
        userId: userA._id,
        type: 'HEART_RATE',
        value: 72 + i,
        unit: 'bpm',
        note: `[TEST_AI_MOCK_REC] Nhịp tim ngày ${i + 1}`,
        recordedAt: new Date(baseDate.getTime() + i * 86400000),
      });
    }

    for (let i = 0; i < 2; i++) {
      await HealthRecord.create({
        userId: userA._id,
        type: 'WEIGHT',
        value: 65 + i * 0.2,
        unit: 'kg',
        note: `[TEST_AI_MOCK_REC] Cân nặng ngày ${i + 1}`,
        recordedAt: new Date(baseDate.getTime() + i * 86400000),
      });
    }
  });

  after(async () => {
    geminiClientFactory.createClient = originalCreateClient;
    process.env.GEMINI_API_KEY = originalApiKey;

    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_AI_MOCK\]/ });
    await HealthRecord.deleteMany({ note: /^\[TEST_AI_MOCK_REC\]/ });
    await SharingPolicy.deleteMany({});
    if (userA) {
      await AISummaryCache.deleteMany({
        $or: [
          { targetUserId: userA._id },
          { requesterId: userA._id },
          { targetUserId: userB._id },
          { requesterId: userB._id },
        ],
      });
    }
    await mongoose.disconnect();
  });

  beforeEach(() => {
    geminiClientFactory.createClient = () => ({
      getGenerativeModel: () => ({
        generateContent: async () => ({
          response: {
            text: () =>
              `### 📊 Xu hướng chính\nHuyết áp và nhịp tim ổn định theo thời gian.\n\n### 🌟 Điểm tích cực\nTất cả các chỉ số đều duy trì trong ngưỡng sinh lý an toàn.\n\n### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi\nDuy trì chế độ ăn nhạt và tiếp tục đo định kỳ.\n\n---\n*⚠️ Lưu ý y tế: ${MANDATORY_DISCLAIMER}*`,
          },
        }),
      }),
    });
  });

  describe('1. Mock Gemini API: Phân tích độc lập với mock client', () => {
    it('1.1 Mock thành công Gemini API và trả về output cấu trúc chuẩn 3 phần + Disclaimer', async () => {
      let generateCalled = false;
      let promptSent = '';

      geminiClientFactory.createClient = () => ({
        getGenerativeModel: () => ({
          generateContent: async (prompt) => {
            generateCalled = true;
            promptSent = prompt;
            return {
              response: {
                text: () =>
                  `### 📊 Xu hướng chính\nHuyết áp dao động nhẹ, nhịp tim duy trì đều đặn.\n\n### 🌟 Điểm tích cực\nChỉ số trong ngưỡng chuẩn.\n\n### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi\nDuy trì lối sống năng động.\n\n---\n*⚠️ Lưu ý y tế: ${MANDATORY_DISCLAIMER}*`,
              },
            };
          },
        }),
      });

      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userA._id });

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.fromCache, false);
      assert.equal(res.body.isFallback, false);
      assert.ok(generateCalled, 'Phải gọi hàm mock generateContent');
      assert.ok(promptSent.includes('Mock Owner Nguyen'), 'Prompt phải chứa tên user');
      assert.ok(res.body.summary.includes('Xu hướng chính'));
      assert.ok(res.body.summary.includes('Điểm tích cực'));
      assert.ok(res.body.summary.includes('Lưu ý sinh hoạt'));
      assert.ok(res.body.summary.includes('Lưu ý'));
    });
  });

  describe('2. AC4 Validation: Tối thiểu 3 bản ghi dữ liệu', () => {
    it('2.1 Trả về 400 Bad Request khi dữ liệu được cấp phép chỉ có 2 bản ghi (< 3)', async () => {
      await SharingPolicy.findOneAndUpdate(
        { ownerId: userA._id, viewerId: userB._id, familyId: testFamily._id },
        { $set: { allowedMetrics: ['WEIGHT'] } },
        { upsert: true }
      );

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          targetUserId: userA._id.toString(),
          familyId: testFamily._id.toString(),
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'INSUFFICIENT_DATA');
      assert.ok(
        res.body.message.includes('Cần tối thiểu 3 bản ghi chỉ số sức khỏe để AI có thể phân tích xu hướng'),
        'Thông báo lỗi phải nêu rõ yêu cầu tối thiểu 3 bản ghi'
      );
      assert.equal(res.body.currentCount, 2);
    });

    it('2.2 Trả về 400 Bad Request khi user hoàn toàn chưa có bản ghi nào cho chỉ số được cấp', async () => {
      await SharingPolicy.findOneAndUpdate(
        { ownerId: userA._id, viewerId: userB._id, familyId: testFamily._id },
        { $set: { allowedMetrics: ['BLOOD_SUGAR'] } },
        { upsert: true }
      );

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          targetUserId: userA._id.toString(),
          familyId: testFamily._id.toString(),
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.currentCount, 0);
    });
  });

  describe('3. AC1 & Granular Permission: Thu hẹp dữ liệu theo SharingPolicy', () => {
    it('3.1 Khi User B chỉ được cấp quyền HEART_RATE -> AI Service CHỈ nhận các bản ghi HEART_RATE', async () => {
      await SharingPolicy.findOneAndUpdate(
        { ownerId: userA._id, viewerId: userB._id, familyId: testFamily._id },
        { $set: { allowedMetrics: ['HEART_RATE'] } },
        { upsert: true }
      );

      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userB._id });

      let capturedPrompt = '';
      geminiClientFactory.createClient = () => ({
        getGenerativeModel: () => ({
          generateContent: async (prompt) => {
            capturedPrompt = prompt;
            return {
              response: {
                text: () => 'Mock summary for HEART_RATE only.',
              },
            };
          },
        }),
      });

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          targetUserId: userA._id.toString(),
          familyId: testFamily._id.toString(),
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.allowedMetrics, ['HEART_RATE']);
      assert.equal(res.body.recordCount, 4);

      assert.ok(capturedPrompt.includes('Nhịp tim'), 'Prompt phải có Nhịp tim');
      assert.equal(capturedPrompt.includes('Huyết áp'), false, 'Prompt không được chứa Huyết áp');
      assert.equal(capturedPrompt.includes('Cân nặng'), false, 'Prompt không được chứa Cân nặng');
    });

    it('3.2 Chặn 403 Forbidden khi Viewer chưa được cấp quyền xem bất kỳ chỉ số nào (Default Deny)', async () => {
      await SharingPolicy.findOneAndUpdate(
        { ownerId: userA._id, viewerId: userB._id, familyId: testFamily._id },
        { $set: { allowedMetrics: [] } },
        { upsert: true }
      );

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          targetUserId: userA._id.toString(),
          familyId: testFamily._id.toString(),
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'ACCESS_DENIED');
      assert.ok(res.body.message.includes('chưa được cấp quyền xem'));
    });
  });

  describe('4. Caching Verification: Cache theo ngày (UTC)', () => {
    it('4.1 Gọi lần 1 tốn 1 lượt gọi AI Service; Gọi lần 2 trong cùng ngày trả về từ Cache', async () => {
      let callCount = 0;

      geminiClientFactory.createClient = () => ({
        getGenerativeModel: () => ({
          generateContent: async () => {
            callCount++;
            return {
              response: {
                text: () => `Mock AI Summary at call count = ${callCount}`,
              },
            };
          },
        }),
      });

      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userA._id });

      const res1 = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res1.status, 200);
      assert.equal(res1.body.fromCache, false);
      assert.equal(callCount, 1);
      assert.ok(res1.body.summary.includes('call count = 1'));

      const res2 = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res2.status, 200);
      assert.equal(res2.body.fromCache, true);
      assert.equal(res2.body.cacheDate, getTodayUTC());
      assert.equal(callCount, 1);
      assert.ok(res2.body.summary.includes('call count = 1'));
    });
  });

  describe('5. Fallback Scenario: Giả lập lỗi Gemini API (500 hoặc Timeout)', () => {
    it('5.1 Khi Gemini API bị lỗi 500 -> Hệ thống tự động fallback với thống kê cơ bản và isFallback: true', async () => {
      geminiClientFactory.createClient = () => ({
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('500 Internal Server Error: Gemini backend quota exceeded');
          },
        }),
      });

      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userA._id });

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isFallback, true);
      assert.equal(res.body.fromCache, false);
      assert.ok(res.body.summary.includes('Xu hướng chính'));
      assert.ok(res.body.summary.includes('Lưu ý'));
    });

    it('5.2 Khi Gemini API bị treo Timeout -> Hệ thống tự động kích hoạt timeout fallback', async () => {
      geminiClientFactory.createClient = () => ({
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('Gemini API timeout sau 10 giây');
          },
        }),
      });

      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userA._id });

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isFallback, true);
      assert.ok(res.body.summary.includes('Xu hướng chính'));
    });
  });

  describe('6. Bảo mật và ngoại lệ', () => {
    it('6.1 Trả về 401 khi không gửi token', async () => {
      const res = await request(app).post('/api/ai/summarize-trends').send({});
      assert.equal(res.status, 401);
    });

    it('6.2 Người ngoài gia đình (Stranger) request -> Trả về 403', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenStranger}`)
        .send({
          targetUserId: userA._id.toString(),
          familyId: testFamily._id.toString(),
        });
      assert.equal(res.status, 403);
    });

    it('6.3 Trả về 400 khi targetUserId không hợp lệ', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetUserId: 'invalid-id' });
      assert.equal(res.status, 400);
    });
  });
});
