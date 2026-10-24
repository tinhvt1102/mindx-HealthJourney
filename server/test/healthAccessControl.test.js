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
import { HealthRecord, HEALTH_METRIC_TYPES } from '../src/models/HealthRecord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: Health Access Control Query Layer (Jira SCRUM-47 / SCRUM-45)', () => {
  let userAdmin, tokenAdmin; // Family Admin
  let userA, tokenA; // Member - Data Owner
  let userB, tokenB; // Member - Viewer
  let userStranger, tokenStranger; // Người ngoài không thuộc gia đình
  let testFamily;
  let recordBP, recordHR, recordWeight;

  const testEmails = [
    'access_admin@example.com',
    'access_owner_a@example.com',
    'access_viewer_b@example.com',
    'access_stranger@example.com',
  ];

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
    }

    // Dọn dẹp dữ liệu cũ nếu còn sót lại
    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_ACCESS_CONTROL\]/ });
    await SharingPolicy.deleteMany({});
    await HealthRecord.deleteMany({ note: /^\[TEST_ACCESS_RECORD\]/ });

    // 1. Tạo User Admin
    userAdmin = await User.create({
      email: 'access_admin@example.com',
      passwordHash: 'dummyHash',
      name: 'Admin Tran',
      fullName: 'Admin Tran',
    });
    tokenAdmin = jwt.sign({ id: userAdmin._id }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Tạo User A (Owner dữ liệu)
    userA = await User.create({
      email: 'access_owner_a@example.com',
      passwordHash: 'dummyHash',
      name: 'Owner Nguyen',
      fullName: 'Owner Nguyen',
    });
    tokenA = jwt.sign({ id: userA._id }, JWT_SECRET, { expiresIn: '1h' });

    // 3. Tạo User B (Viewer xem dữ liệu)
    userB = await User.create({
      email: 'access_viewer_b@example.com',
      passwordHash: 'dummyHash',
      name: 'Viewer Le',
      fullName: 'Viewer Le',
    });
    tokenB = jwt.sign({ id: userB._id }, JWT_SECRET, { expiresIn: '1h' });

    // 4. Tạo User Stranger (Người ngoài nhóm)
    userStranger = await User.create({
      email: 'access_stranger@example.com',
      passwordHash: 'dummyHash',
      name: 'Stranger Hoang',
      fullName: 'Stranger Hoang',
    });
    tokenStranger = jwt.sign({ id: userStranger._id }, JWT_SECRET, { expiresIn: '1h' });

    // 5. Tạo Family gồm: Admin, User A, User B
    testFamily = await Family.create({
      name: '[TEST_ACCESS_CONTROL] Gia đình kiểm thử truy cập',
      createdBy: userAdmin._id,
      members: [
        { userId: userAdmin._id, role: 'ADMIN', joinedAt: new Date() },
        { userId: userA._id, role: 'MEMBER', joinedAt: new Date() },
        { userId: userB._id, role: 'MEMBER', joinedAt: new Date() },
      ],
    });

    // 6. Tạo các bản ghi sức khỏe mẫu cho User A
    // - Bản ghi Huyết áp (BLOOD_PRESSURE)
    recordBP = await HealthRecord.create({
      userId: userA._id,
      type: 'BLOOD_PRESSURE',
      systolic: 120,
      diastolic: 80,
      unit: 'mmHg',
      note: '[TEST_ACCESS_RECORD] Huyết áp bình thường',
      recordedAt: new Date('2026-10-20T08:00:00Z'),
    });

    // - Bản ghi Nhịp tim (HEART_RATE)
    recordHR = await HealthRecord.create({
      userId: userA._id,
      type: 'HEART_RATE',
      value: 75,
      unit: 'bpm',
      note: '[TEST_ACCESS_RECORD] Nhịp tim khi nghỉ ngơi',
      recordedAt: new Date('2026-10-21T08:00:00Z'),
    });

    // - Bản ghi Cân nặng (WEIGHT)
    recordWeight = await HealthRecord.create({
      userId: userA._id,
      type: 'WEIGHT',
      value: 68.5,
      unit: 'kg',
      note: '[TEST_ACCESS_RECORD] Cân nặng buổi sáng',
      recordedAt: new Date('2026-10-22T08:00:00Z'),
    });
  });

  after(async () => {
    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_ACCESS_CONTROL\]/ });
    await SharingPolicy.deleteMany({});
    await HealthRecord.deleteMany({ note: /^\[TEST_ACCESS_RECORD\]/ });
    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. KIỂM TRA DEFAULT DENY (Chưa cấp quyền -> Không được xem gì)
  // =========================================================================
  describe('1. Default Deny - Mặc định từ chối khi chưa được cấp quyền', () => {
    it('1.1 Khi chưa thiết lập policy, User B request dữ liệu User A -> trả về data rỗng []', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 0);
      assert.deepEqual(res.body.allowedMetrics, []);
      assert.deepEqual(res.body.data, []);
    });

    it('1.2 Khi policy tồn tại nhưng allowedMetrics rỗng [], User B request -> trả về data rỗng []', async () => {
      await SharingPolicy.create({
        ownerId: userA._id,
        viewerId: userB._id,
        familyId: testFamily._id,
        allowedMetrics: [],
      });

      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 0);
      assert.deepEqual(res.body.allowedMetrics, []);
      assert.deepEqual(res.body.data, []);

      // Dọn policy này để test case sau cấu hình lại
      await SharingPolicy.deleteMany({ familyId: testFamily._id });
    });
  });

  // =========================================================================
  // 2. KIỂM TRA AC1 - GRANULAR METRICS ACCESS CONTROL (Cấp gì chỉ được xem nấy)
  // =========================================================================
  describe('2. AC1: Viewer chỉ xem đúng các chỉ số trong allowedMetrics', () => {
    before(async () => {
      // User A cấu hình cấp CHỈ quyền xem BLOOD_PRESSURE cho User B
      await SharingPolicy.create({
        ownerId: userA._id,
        viewerId: userB._id,
        familyId: testFamily._id,
        allowedMetrics: ['BLOOD_PRESSURE'],
      });
    });

    after(async () => {
      await SharingPolicy.deleteMany({ familyId: testFamily._id });
    });

    it('2.1 User B request dữ liệu User A -> CHỈ nhận về BLOOD_PRESSURE, không thấy HEART_RATE và WEIGHT', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
      assert.deepEqual(res.body.allowedMetrics, ['BLOOD_PRESSURE']);

      // Xác minh tất cả records trả về đều chỉ thuộc BLOOD_PRESSURE
      const records = res.body.data;
      assert.equal(records.length, 1);
      assert.equal(records[0].type, 'BLOOD_PRESSURE');
      assert.equal(records[0].systolic, 120);
      assert.equal(records[0].diastolic, 80);

      // Chắc chắn không có HEART_RATE hoặc WEIGHT
      const hasHeartRate = records.some((r) => r.type === 'HEART_RATE');
      const hasWeight = records.some((r) => r.type === 'WEIGHT');
      assert.equal(hasHeartRate, false);
      assert.equal(hasWeight, false);
    });

    it('2.2 User B request lọc ?type=BLOOD_PRESSURE (chỉ số được cấp) -> Trả về kết quả bình thường', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records?type=BLOOD_PRESSURE`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].type, 'BLOOD_PRESSURE');
    });

    it('2.3 User B request lọc ?type=HEART_RATE (chỉ số KHÔNG được cấp phép) -> Bị chặn 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records?type=HEART_RATE`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('không có quyền xem chỉ số'));
    });

    it('2.4 User B request lọc ?type=WEIGHT (chỉ số KHÔNG được cấp phép) -> Bị chặn 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records?type=WEIGHT`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });
  });

  // =========================================================================
  // 3. KIỂM TRA AC2 - FAMILY ADMIN TUYỆT ĐỐI KHÔNG BYPASS QUYỀN RIÊNG TƯ
  // =========================================================================
  describe('3. AC2: Family Admin cũng KHÔNG được bypass SharingPolicy nếu không được Owner cấp', () => {
    it('3.1 Khi User A chưa cấp quyền cho Admin -> Admin request dữ liệu của User A -> Trả về data rỗng []', async () => {
      // Đảm bảo không có policy nào giữa Owner A và Admin
      await SharingPolicy.deleteMany({ ownerId: userA._id, viewerId: userAdmin._id });

      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 0);
      assert.deepEqual(res.body.allowedMetrics, []);
      assert.deepEqual(res.body.data, []);
    });

    it('3.2 Admin cố tình query ?type=BLOOD_PRESSURE khi chưa được cấp quyền -> Bị chặn 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records?type=BLOOD_PRESSURE`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      // Vì allowedMetrics của Admin là [] nên lọc bất kỳ type nào cũng phải bị từ chối
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('3.3 Khi User A chỉ cấp cho Admin quyền xem WEIGHT -> Admin CHỈ thấy WEIGHT, không thấy BLOOD_PRESSURE', async () => {
      await SharingPolicy.create({
        ownerId: userA._id,
        viewerId: userAdmin._id,
        familyId: testFamily._id,
        allowedMetrics: ['WEIGHT'],
      });

      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].type, 'WEIGHT');
      assert.equal(res.body.data[0].value, 68.5);

      // Dọn dẹp
      await SharingPolicy.deleteMany({ ownerId: userA._id, viewerId: userAdmin._id });
    });
  });

  // =========================================================================
  // 4. KIỂM TRA BẢO MẬT & XÁC THỰC (Security & Validation)
  // =========================================================================
  describe('4. Bảo mật và kiểm tra ngoại lệ truy cập', () => {
    it('4.1 Trả về 401 Unauthorized khi không có Bearer token', async () => {
      const res = await request(app).get(
        `/api/families/${testFamily._id}/members/${userA._id}/health-records`
      );
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('4.2 Người ngoài nhóm gia đình (Stranger) request dữ liệu -> Trả về 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenStranger}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('không phải là thành viên'));
    });

    it('4.3 Trả về 404 khi ID gia đình không tồn tại trong hệ thống', async () => {
      const fakeFamilyId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/families/${fakeFamilyId}/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('4.4 Trả về 403 khi ID thành viên mục tiêu không thuộc nhóm gia đình', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userStranger._id}/health-records`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Thành viên mục tiêu không thuộc'));
    });

    it('4.5 Trả về 400 Bad Request khi familyId hoặc memberId không phải ObjectId hợp lệ', async () => {
      const resInvalidFamily = await request(app)
        .get(`/api/families/invalid-id/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(resInvalidFamily.status, 400);

      const resInvalidMember = await request(app)
        .get(`/api/families/${testFamily._id}/members/invalid-id/health-records`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(resInvalidMember.status, 400);
    });
  });

  // =========================================================================
  // 5. KIỂM TRA SELF-VIEW (Chính chủ tự xem dữ liệu của mình)
  // =========================================================================
  describe('5. Self-view: Người dùng tự xem dữ liệu sức khỏe của chính mình', () => {
    it('5.1 User A tự request xem dữ liệu của chính mình -> Toàn quyền thấy 100% tất cả các chỉ số', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isSelfView, true);
      assert.equal(res.body.count, 3);
      assert.deepEqual(res.body.allowedMetrics, HEALTH_METRIC_TYPES);

      // Đảm bảo đầy đủ 3 loại chỉ số
      const types = res.body.data.map((r) => r.type);
      assert.ok(types.includes('BLOOD_PRESSURE'));
      assert.ok(types.includes('HEART_RATE'));
      assert.ok(types.includes('WEIGHT'));
    });

    it('5.2 User A tự lọc ?type=HEART_RATE -> Lấy đúng dữ liệu không bị chặn', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-records?type=HEART_RATE`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].type, 'HEART_RATE');
      assert.equal(res.body.data[0].value, 75);
    });
  });
});
