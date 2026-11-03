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
import { HealthRecord } from '../src/models/HealthRecord.js';
import { SharingPolicy } from '../src/models/SharingPolicy.js';
import { AISummaryCache } from '../src/models/AISummaryCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

// Helper để lấy cacheDate hôm nay (UTC)
const getTodayUTC = () => new Date().toISOString().slice(0, 10);

describe('Integration Test: AI Summarize Trends API (Jira SCRUM-57 / SCRUM-55)', () => {
  let userA, tokenA; // Owner dữ liệu (self-view)
  let userB, tokenB; // Viewer - được cấp quyền một phần
  let userStranger, tokenStranger; // Người ngoài nhóm
  let testFamily;

  const testEmails = [
    'ai_owner_a@example.com',
    'ai_viewer_b@example.com',
    'ai_stranger@example.com',
  ];

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
    }

    // Dọn dẹp dữ liệu cũ
    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_AI\]/ });
    await HealthRecord.deleteMany({ note: /^\[TEST_AI_RECORD\]/ });
    await SharingPolicy.deleteMany({});
    await AISummaryCache.deleteMany({
      $or: [
        { targetUserId: { $in: [] } }, // placeholder, sẽ cập nhật sau khi tạo user
      ],
    });

    // 1. Tạo User A (Owner dữ liệu)
    userA = await User.create({
      email: 'ai_owner_a@example.com',
      passwordHash: 'dummyHash',
      name: 'AI Owner Nguyen',
      fullName: 'AI Owner Nguyen',
    });
    tokenA = jwt.sign({ id: userA._id }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Tạo User B (Viewer)
    userB = await User.create({
      email: 'ai_viewer_b@example.com',
      passwordHash: 'dummyHash',
      name: 'AI Viewer Tran',
      fullName: 'AI Viewer Tran',
    });
    tokenB = jwt.sign({ id: userB._id }, JWT_SECRET, { expiresIn: '1h' });

    // 3. Tạo User Stranger
    userStranger = await User.create({
      email: 'ai_stranger@example.com',
      passwordHash: 'dummyHash',
      name: 'AI Stranger Le',
      fullName: 'AI Stranger Le',
    });
    tokenStranger = jwt.sign({ id: userStranger._id }, JWT_SECRET, { expiresIn: '1h' });

    // 4. Tạo Family (userA và userB là thành viên)
    testFamily = await Family.create({
      name: '[TEST_AI] Gia đình AI kiểm thử',
      createdBy: userA._id,
      members: [
        { userId: userA._id, role: 'ADMIN', joinedAt: new Date() },
        { userId: userB._id, role: 'MEMBER', joinedAt: new Date() },
      ],
    });

    // 5. Tạo bản ghi sức khỏe cho User A (5 bản ghi để vượt ngưỡng tối thiểu 3)
    const baseDate = new Date('2026-10-01T08:00:00Z');
    for (let i = 0; i < 5; i++) {
      await HealthRecord.create({
        userId: userA._id,
        type: 'HEART_RATE',
        value: 70 + i * 2, // 70, 72, 74, 76, 78
        unit: 'bpm',
        note: `[TEST_AI_RECORD] Nhịp tim ngày ${i + 1}`,
        recordedAt: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000),
      });
    }

    // 6 thêm bản ghi WEIGHT
    for (let i = 0; i < 3; i++) {
      await HealthRecord.create({
        userId: userA._id,
        type: 'WEIGHT',
        value: 65 + i * 0.5,
        unit: 'kg',
        note: `[TEST_AI_RECORD] Cân nặng ngày ${i + 1}`,
        recordedAt: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000),
      });
    }

    // Dọn cache AI của user test để không bị ảnh hưởng bởi test cũ
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
    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_AI\]/ });
    await HealthRecord.deleteMany({ note: /^\[TEST_AI_RECORD\]/ });
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

  // =========================================================================
  // 1. KIỂM TRA BẢO VỆ ENDPOINT (Auth & Validation)
  // =========================================================================
  describe('1. Bảo vệ Endpoint & Validation cơ bản', () => {
    it('1.1 Trả về 401 Unauthorized khi không có Bearer token', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .send({});

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('1.2 Trả về 400 khi targetUserId không hợp lệ (không phải ObjectId)', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetUserId: 'invalid-id' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('1.3 Trả về 400 khi xem người thân nhưng không cung cấp familyId', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ targetUserId: userA._id.toString() }); // Không có familyId

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('familyId'));
    });

    it('1.4 Trả về 404 khi familyId không tồn tại', async () => {
      const fakeFamily = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ targetUserId: userA._id.toString(), familyId: fakeFamily.toString() });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('1.5 Trả về 403 khi người gọi không phải thành viên gia đình', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenStranger}`)
        .send({ targetUserId: userA._id.toString(), familyId: testFamily._id.toString() });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('không phải là thành viên'));
    });
  });

  // =========================================================================
  // 2. KIỂM TRA AC4 - TỐI THIỂU 3 BẢN GHI
  // =========================================================================
  describe('2. AC4: Yêu cầu tối thiểu 3 bản ghi dữ liệu', () => {
    it('2.1 Trả về 403 khi Viewer chưa được cấp quyền xem chỉ số nào', async () => {
      // Không có SharingPolicy -> mặc định Default Deny
      await SharingPolicy.deleteMany({ ownerId: userA._id, viewerId: userB._id });

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ targetUserId: userA._id.toString(), familyId: testFamily._id.toString() });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('2.2 Trả về 400 khi được cấp quyền nhưng dữ liệu chỉ số được cấp < 3 bản ghi (dùng type mới)', async () => {
      // Cấp quyền cho user B xem BLOOD_SUGAR (chưa có bản ghi nào)
      await SharingPolicy.findOneAndUpdate(
        { ownerId: userA._id, viewerId: userB._id, familyId: testFamily._id },
        { $set: { allowedMetrics: ['BLOOD_SUGAR'] } },
        { upsert: true }
      );

      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ targetUserId: userA._id.toString(), familyId: testFamily._id.toString() });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('tối thiểu 3 bản ghi'));
    });
  });

  // =========================================================================
  // 3. KIỂM TRA SELF-VIEW (Chính chủ tự phân tích dữ liệu của mình)
  // =========================================================================
  describe('3. Self-view: Phân tích dữ liệu của chính người dùng', () => {
    before(async () => {
      // Đảm bảo không còn cache cũ
      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userA._id });
    });

    it('3.1 User A tự phân tích dữ liệu của mình -> 200 OK với summary (AI hoặc fallback)', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({}); // Không truyền targetUserId -> tự phân tích

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isSelfView, true);
      assert.equal(typeof res.body.summary, 'string');
      assert.ok(res.body.summary.length > 0);
      assert.ok(res.body.recordCount >= 3);
      assert.equal(typeof res.body.isFallback, 'boolean');
      assert.equal(res.body.fromCache, false);
    });

    it('3.2 Lần gọi thứ hai trong cùng ngày -> trả về từ Cache (fromCache: true)', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.fromCache, true);
      assert.equal(res.body.isSelfView, true);
      assert.equal(typeof res.body.summary, 'string');
      assert.ok(res.body.summary.length > 0);
    });

    it('3.3 Cache có cacheDate bằng ngày hôm nay (UTC)', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.cacheDate, getTodayUTC());
    });

    it('3.4 Summary luôn có nội dung disclaimer an toàn y tế', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      assert.equal(res.status, 200);
      assert.ok(
        res.body.summary.includes('⚠️ Lưu ý:') || res.body.summary.includes('tham khảo'),
        'Summary phải chứa disclaimer an toàn y tế'
      );
    });
  });

  // =========================================================================
  // 4. KIỂM TRA QUYỀN TRUY CẬP NGƯỜI THÂN (AC1 & AC2 của SCRUM-45)
  // =========================================================================
  describe('4. Truy cập dữ liệu người thân với SharingPolicy', () => {
    before(async () => {
      // Cấp quyền cho userB xem HEART_RATE của userA (có 5 bản ghi)
      await SharingPolicy.findOneAndUpdate(
        { ownerId: userA._id, viewerId: userB._id, familyId: testFamily._id },
        { $set: { allowedMetrics: ['HEART_RATE'] } },
        { upsert: true }
      );
      // Dọn cache của userB xem userA
      await AISummaryCache.deleteMany({ targetUserId: userA._id, requesterId: userB._id });
    });

    it('4.1 User B xem dữ liệu User A (được cấp quyền HEART_RATE) -> 200 OK với summary', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ targetUserId: userA._id.toString(), familyId: testFamily._id.toString() });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isSelfView, false);
      assert.deepEqual(res.body.allowedMetrics, ['HEART_RATE']);
      assert.ok(res.body.recordCount >= 3);
      assert.equal(typeof res.body.summary, 'string');
      assert.ok(res.body.summary.length > 0);
    });

    it('4.2 Lần gọi thứ hai của User B trong ngày -> trả về từ Cache', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-trends')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ targetUserId: userA._id.toString(), familyId: testFamily._id.toString() });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.fromCache, true);
    });
  });

  // =========================================================================
  // 5. KIỂM TRA CACHE DATABASE
  // =========================================================================
  describe('5. Cache Database - Lưu trữ và truy xuất đúng', () => {
    it('5.1 Cache document được lưu đúng trong MongoDB sau lần gọi đầu tiên', async () => {
      const cacheDoc = await AISummaryCache.findOne({
        targetUserId: userA._id,
        requesterId: userA._id,
        cacheDate: getTodayUTC(),
      });

      assert.ok(cacheDoc !== null, 'Cache document phải tồn tại trong DB');
      assert.equal(cacheDoc.cacheDate, getTodayUTC());
      assert.equal(typeof cacheDoc.summary, 'string');
      assert.ok(cacheDoc.summary.length > 0);
      assert.ok(cacheDoc.recordCount >= 3);
      assert.equal(typeof cacheDoc.isFallback, 'boolean');
    });

    it('5.2 Cache document có trường createdAt là Date object', async () => {
      const cacheDoc = await AISummaryCache.findOne({
        targetUserId: userA._id,
        requesterId: userA._id,
        cacheDate: getTodayUTC(),
      });

      assert.ok(cacheDoc !== null);
      assert.ok(cacheDoc.createdAt instanceof Date, 'createdAt phải là Date object cho TTL index');
    });

    it('5.3 Cache phân biệt đúng giữa self-view và cross-view (2 cache riêng biệt)', async () => {
      const selfCache = await AISummaryCache.findOne({
        targetUserId: userA._id,
        requesterId: userA._id,
      });
      const crossCache = await AISummaryCache.findOne({
        targetUserId: userA._id,
        requesterId: userB._id,
      });

      // Cả 2 cache đều phải tồn tại độc lập
      assert.ok(selfCache !== null, 'Self-view cache phải tồn tại');
      assert.ok(crossCache !== null, 'Cross-view cache phải tồn tại');
      // Đảm bảo đây là 2 document khác nhau
      assert.notEqual(selfCache._id.toString(), crossCache._id.toString());
    });
  });
});
