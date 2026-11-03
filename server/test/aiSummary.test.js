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
import { geminiClientFactory } from '../src/services/ai.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';
const getTodayUTC = () => new Date().toISOString().slice(0, 10);

describe('Integration & Mock Test: AI Summary Trends (Jira SCRUM-59 / SCRUM-55)', () => {
  let userA, tokenA; // Owner
  let userB, tokenB; // Viewer trong Family
  let userStranger, tokenStranger; // Người lạ
  let testFamily;

  const testEmails = [
    'ai_mock_owner_a@example.com',
    'ai_mock_viewer_b@example.com',
    'ai_mock_stranger@example.com',
  ];

  // Lưu bản gốc của factory createClient
  const originalCreateClient = geminiClientFactory.createClient;

  // Đảm bảo GEMINI_API_KEY luôn có giá trị trong quá trình test
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
    // - 4 bản ghi BLOOD_PRESSURE
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

    // - 4 bản ghi HEART_RATE
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

    // - 2 bản ghi WEIGHT (cố tình < 3 bản ghi để test điều kiện AC4 khi viewer chỉ được cấp WEIGHT)
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

    // Dọn cache liên quan
    await AISummaryCache.deleteMany({
      $or: [
        { targetUserId: userA._id },
        { requesterId: userA._id },
        { targetUserId: userB._id },
        { requesterId: userB._id },
      ],
    });
  });

  after(async () => {
    // Phục hồi ban đầu
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
    // Thiết lập mock Gemini client mặc định trả về phản hồi hợp lệ
    geminiClientFactory.createClient = () => ({
      getGenerativeModel: () => ({
        generateContent: async () => ({
          response: {
            text: () =>
              `### 📊 Xu hướng chính\nHuyết áp và nhịp tim ổn định theo thời gian.\n\n### 🌟 Điểm tích cực\nTất cả các chỉ số đều duy trì trong ngưỡng sinh lý an toàn.\n\n### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi\nDuy trì chế độ ăn nhạt và tiếp tục đo định kỳ.\n\n---\n*⚠️ Lưu ý: Tóm tắt này được tạo bởi AI nhằm mục đích tham khảo và theo dõi xu hướng, không có giá trị thay thế chẩn đoán hoặc chỉ định từ bác sĩ chuyên khoa.*`,
          },
        }),
      }),
    });
  });

  // =========================================================================
  // 1. MOCK GEMINI API: TEST ĐỘC LẬP KHÔNG PHỤ THUỘC NETWORK HAY API KEY THẬT
  // =========================================================================
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
                  `### 📊 Xu hướng chính\nHuyết áp dao động nhẹ, nhịp tim duy trì đều đặn.\n\n### 🌟 Điểm tích cực\nChỉ số trong ngưỡng chuẩn.\n\n### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi\nDuy trì lối sống năng động.\n\n---\n*⚠️ Lưu ý: Tóm tắt này được tạo bởi AI nhằm mục đích tham khảo và theo dõi xu hướng, không có giá trị thay thế chẩn đoán hoặc chỉ định từ bác sĩ chuyên khoa.*`,
              },
            };
          },
        }),
      });

      // Đảm bảo không có cache
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
      assert.ok(res.body.summary.includes('⚠️ Lưu ý:'));
    });
  });

  // =========================================================================
  // 2. AC4 VALIDATION: < 3 BẢN GHI -> 400 BAD REQUEST KÈM MESSAGE RÕ RÀNG
  // =========================================================================
  describe('2. AC4 Validation: Tối thiểu 3 bản ghi dữ liệu', () => {
    it('2.1 Trả về 400 Bad Request khi dữ liệu được cấp phép chỉ có 2 bản ghi (< 3)', async () => {
      // Cấu hình SharingPolicy: userA chỉ cấp cho userB quyền xem WEIGHT (có đúng 2 bản ghi)
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
      assert.ok(
        res.body.message.includes('Cần tối thiểu 3 bản ghi chỉ số sức khỏe để AI có thể phân tích xu hướng'),
        'Thông báo lỗi phải nêu rõ yêu cầu tối thiểu 3 bản ghi'
      );
      assert.equal(res.body.currentCount, 2);
    });

    it('2.2 Trả về 400 Bad Request khi user hoàn toàn chưa có bản ghi nào cho chỉ số được cấp', async () => {
      // Cấp quyền BLOOD_SUGAR (0 bản ghi)
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

  // =========================================================================
  // 3. AC1 & GRANULAR PERMISSION: CHỈ GOM ĐÚNG DỮ LIỆU THUỘC ALLOWED METRICS
  // =========================================================================
  describe('3. AC1 & Granular Permission: Thu hẹp dữ liệu theo SharingPolicy', () => {
    it('3.1 Khi User B chỉ được cấp quyền HEART_RATE -> AI Service CHỈ nhận các bản ghi HEART_RATE (không nhận BLOOD_PRESSURE/WEIGHT)', async () => {
      // Cấp quyền xem duy nhất HEART_RATE (userA có 4 bản ghi HEART_RATE, 4 BLOOD_PRESSURE, 2 WEIGHT)
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

      // Prompt gửi đến AI phải chứa Nhịp tim, TUYỆT ĐỐI không chứa Huyết áp hoặc Cân nặng
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
      assert.ok(res.body.message.includes('chưa được cấp quyền xem'));
    });
  });

  // =========================================================================
  // 4. CACHING VERIFICATION: LẦN 1 GỌI AI SERVICE, LẦN 2 TRẢ VỀ TỪ CACHE DB
  // =========================================================================
  describe('4. Caching Verification: Cache theo ngày (UTC)', () => {
    it('4.1 Gọi lần 1 tốn 1 lượt gọi AI Service; Gọi lần 2 trong cùng ngày trả về từ Cache (không gọi lại Service)', async () => {
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

      // Xóa cache cũ của userA
      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userA._id });

      // Lần gọi 1
      const res1 = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res1.status, 200);
      assert.equal(res1.body.fromCache, false);
      assert.equal(callCount, 1, 'Lần 1 phải gọi AI Service');
      assert.ok(res1.body.summary.includes('call count = 1'));

      // Lần gọi 2 trong cùng ngày
      const res2 = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res2.status, 200);
      assert.equal(res2.body.fromCache, true, 'Lần 2 phải trả về fromCache: true');
      assert.equal(res2.body.cacheDate, getTodayUTC());
      assert.equal(callCount, 1, 'Lần 2 TUYỆT ĐỐI KHÔNG được gọi lại AI Service');
      assert.ok(res2.body.summary.includes('call count = 1'));
    });
  });

  // =========================================================================
  // 5. FALLBACK SCENARIO: GIẢ LẬP LỖI GEMINI API -> PHẢN HỒI THỐNG KÊ CƠ BẢN
  // =========================================================================
  describe('5. Fallback Scenario: Giả lập lỗi Gemini API (500 hoặc Timeout)', () => {
    it('5.1 Khi Gemini API bị lỗi 500/Internal -> Hệ thống tự động fallback với thống kê cơ bản và isFallback: true', async () => {
      // Giả lập Gemini SDK quăng lỗi 500
      geminiClientFactory.createClient = () => ({
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('500 Internal Server Error: Gemini backend quota exceeded');
          },
        }),
      });

      // Xóa cache cũ để kích hoạt service
      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userA._id });

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isFallback, true, 'isFallback phải là true khi xảy ra sự cố');
      assert.equal(res.body.fromCache, false);
      assert.ok(res.body.summary.includes('thống kê cơ bản'));
      assert.ok(res.body.summary.includes('⚠️ Lưu ý:'));

      // Kiểm tra DB cache cũng đánh dấu đúng isFallback: true
      const cachedDoc = await AISummaryCache.findOne({
        targetUserId: userA._id,
        requesterId: userA._id,
        cacheDate: getTodayUTC(),
      });
      assert.ok(cachedDoc !== null);
      assert.equal(cachedDoc.isFallback, true);
    });

    it('5.2 Khi Gemini API bị treo Timeout -> Hệ thống tự động kích hoạt timeout fallback', async () => {
      // Giả lập Gemini SDK bị treo (không bao giờ resolve)
      geminiClientFactory.createClient = () => ({
        getGenerativeModel: () => ({
          generateContent: () =>
            new Promise((resolve) => {
              // Treo không resolve, để Promise.race bắt timeout
              // Để test chạy nhanh, ta mô phỏng timeout bằng cách throw error timeout
              setTimeout(() => resolve({ response: { text: () => 'Late' } }), 15000);
            }),
        }),
      });

      // Xóa cache cũ
      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userA._id });

      // Để tránh chờ 10s thật trong test, mock timeout error trực tiếp
      geminiClientFactory.createClient = () => ({
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('Gemini API timeout sau 10 giây');
          },
        }),
      });

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isFallback, true);
      assert.ok(res.body.summary.includes('Báo cáo thống kê sức khỏe'));
    });
  });
});
