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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: Member Health Overview & Medical Thresholds (Jira SCRUM-50 / SCRUM-52)', () => {
  let userAdmin, tokenAdmin;
  let userA, tokenA; // Owner
  let userB, tokenB; // Viewer
  let userStranger, tokenStranger;
  let testFamily;

  const testEmails = [
    'overview_admin@example.com',
    'overview_a@example.com',
    'overview_b@example.com',
    'overview_stranger@example.com',
  ];

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Dọn dẹp dữ liệu test cũ
    await User.deleteMany({ email: { $in: testEmails } });
    await HealthRecord.deleteMany({
      notes: { $regex: 'TEST_OVERVIEW_' },
    });

    // 1. Tạo Users
    userAdmin = await User.create({
      email: testEmails[0],
      password: 'password123',
      fullName: 'Admin Overview',
      name: 'Admin Overview',
      heightCm: 175,
    });
    tokenAdmin = jwt.sign({ id: userAdmin._id }, JWT_SECRET, { expiresIn: '1d' });

    userA = await User.create({
      email: testEmails[1],
      password: 'password123',
      fullName: 'Owner A',
      name: 'Owner A',
      heightCm: 170,
    });
    tokenA = jwt.sign({ id: userA._id }, JWT_SECRET, { expiresIn: '1d' });

    userB = await User.create({
      email: testEmails[2],
      password: 'password123',
      fullName: 'Viewer B',
      name: 'Viewer B',
      heightCm: 165,
    });
    tokenB = jwt.sign({ id: userB._id }, JWT_SECRET, { expiresIn: '1d' });

    userStranger = await User.create({
      email: testEmails[3],
      password: 'password123',
      fullName: 'Stranger',
      name: 'Stranger',
    });
    tokenStranger = jwt.sign({ id: userStranger._id }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Tạo Family gồm Admin, User A, User B (Stranger không thuộc nhóm)
    testFamily = await Family.create({
      name: 'Gia đình Overview Test',
      createdBy: userAdmin._id,
      members: [
        { userId: userAdmin._id, role: 'ADMIN', joinedAt: new Date() },
        { userId: userA._id, role: 'MEMBER', joinedAt: new Date() },
        { userId: userB._id, role: 'MEMBER', joinedAt: new Date() },
      ],
    });

    // 3. Tạo các bản ghi sức khỏe cho User A với các ngưỡng y tế khác nhau (Jira SCRUM-52)
    // Huyết áp cao: 145/95 mmHg -> DANGER
    await HealthRecord.create({
      userId: userA._id,
      type: 'BLOOD_PRESSURE',
      systolic: 145,
      diastolic: 95,
      unit: 'mmHg',
      recordedAt: new Date(),
      note: 'TEST_OVERVIEW_BP_HIGH',
    });

    // Nhịp tim nhanh: 108 bpm -> WARNING
    await HealthRecord.create({
      userId: userA._id,
      type: 'HEART_RATE',
      value: 108,
      unit: 'bpm',
      recordedAt: new Date(),
      note: 'TEST_OVERVIEW_HR_FAST',
    });

    // Cân nặng & BMI: 75 kg (BMI 25.95) -> WARNING (Thừa cân)
    await HealthRecord.create({
      userId: userA._id,
      type: 'WEIGHT',
      value: 75,
      bmi: 25.95,
      unit: 'kg',
      recordedAt: new Date(),
      note: 'TEST_OVERVIEW_WEIGHT',
    });

    // Đường huyết: 85 mg/dL -> NORMAL
    await HealthRecord.create({
      userId: userA._id,
      type: 'BLOOD_SUGAR',
      value: 85,
      unit: 'mg/dL',
      recordedAt: new Date(),
      note: 'TEST_OVERVIEW_SUGAR',
    });
  });

  after(async () => {
    if (testFamily) {
      await SharingPolicy.deleteMany({ familyId: testFamily._id });
      await Family.findByIdAndDelete(testFamily._id);
    }
    await User.deleteMany({ email: { $in: testEmails } });
    await HealthRecord.deleteMany({
      note: { $regex: 'TEST_OVERVIEW_' },
    });
    await mongoose.disconnect();
  });

  describe('1. Default Deny - Khi chưa cấp quyền chia sẻ (AC1 SCRUM-49 / SCRUM-50)', () => {
    it('1.1 User B request tổng quan của User A khi chưa cấp quyền -> Các chỉ số bị ẩn và hasAccess: false', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-overview`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.member.id, userA._id.toString());
      assert.deepEqual(res.body.allowedMetrics, []);
      assert.equal(res.body.isSelfView, false);

      // Toàn bộ 4 metrics đều hasAccess: false
      assert.equal(res.body.metrics.BLOOD_PRESSURE.hasAccess, false);
      assert.equal(res.body.metrics.HEART_RATE.hasAccess, false);
      assert.equal(res.body.metrics.WEIGHT.hasAccess, false);
      assert.equal(res.body.metrics.BLOOD_SUGAR.hasAccess, false);

      // Không lộ giá trị đo
      assert.equal(res.body.metrics.BLOOD_PRESSURE.latest, null);
    });
  });

  describe('2. Phân quyền từng chỉ số & Đánh giá ngưỡng y khoa (Jira SCRUM-50 / SCRUM-52)', () => {
    before(async () => {
      // User A chia sẻ cho User B 2 chỉ số: BLOOD_PRESSURE và HEART_RATE
      await SharingPolicy.findOneAndUpdate(
        { ownerId: userA._id, viewerId: userB._id, familyId: testFamily._id },
        { allowedMetrics: ['BLOOD_PRESSURE', 'HEART_RATE'] },
        { upsert: true, new: true }
      );
    });

    it('2.1 User B chỉ thấy 2 chỉ số được cấp quyền kèm đánh giá ngưỡng rủi ro', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-overview`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.allowedMetrics.length, 2);
      assert.ok(res.body.allowedMetrics.includes('BLOOD_PRESSURE'));
      assert.ok(res.body.allowedMetrics.includes('HEART_RATE'));

      // 1. BLOOD_PRESSURE: hasAccess true, nhận diện Tăng huyết áp (DANGER) vì 145/95 mmHg
      const bp = res.body.metrics.BLOOD_PRESSURE;
      assert.equal(bp.hasAccess, true);
      assert.ok(bp.latest);
      assert.equal(bp.latest.values.systolic, 145);
      assert.equal(bp.evaluation.level, 'DANGER');
      assert.equal(bp.evaluation.label, 'Tăng huyết áp');

      // 2. HEART_RATE: hasAccess true, nhận diện Nhịp nhanh (WARNING) vì 108 bpm
      const hr = res.body.metrics.HEART_RATE;
      assert.equal(hr.hasAccess, true);
      assert.ok(hr.latest);
      assert.equal(hr.latest.values.value, 108);
      assert.equal(hr.evaluation.level, 'WARNING');

      // 3. WEIGHT & BLOOD_SUGAR: hasAccess false, bị bảo vệ bởi Default Deny
      assert.equal(res.body.metrics.WEIGHT.hasAccess, false);
      assert.equal(res.body.metrics.BLOOD_SUGAR.hasAccess, false);

      // Tổng thể cảnh báo: vì có DANGER nên overallStatus = 'DANGER'
      assert.equal(res.body.overallStatus, 'DANGER');
      assert.equal(res.body.alerts.dangerCount, 1);
      assert.equal(res.body.alerts.warningCount, 1);
    });
  });

  describe('3. Family Admin Enforcement (AC2 SCRUM-49 / SCRUM-45)', () => {
    it('3.1 Family Admin cũng KHÔNG được xem dữ liệu User A nếu User A chưa cấp quyền cho Admin', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-overview`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.allowedMetrics, []);
      assert.equal(res.body.metrics.BLOOD_PRESSURE.hasAccess, false);
      assert.equal(res.body.metrics.HEART_RATE.hasAccess, false);
    });
  });

  describe('4. Self-view: Người dùng tự xem tổng quan sức khỏe của chính mình', () => {
    it('4.1 User A tự request tổng quan của chính mình -> Toàn quyền xem 100% các chỉ số', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-overview`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.isSelfView, true);
      assert.equal(res.body.allowedMetrics.length, 6);

      // Toàn bộ các chỉ số đều hasAccess: true
      assert.equal(res.body.metrics.BLOOD_PRESSURE.hasAccess, true);
      assert.equal(res.body.metrics.HEART_RATE.hasAccess, true);
      assert.equal(res.body.metrics.WEIGHT.hasAccess, true);
      assert.equal(res.body.metrics.BLOOD_SUGAR.hasAccess, true);
      assert.equal(res.body.metrics.TEMPERATURE.hasAccess, true);
      assert.equal(res.body.metrics.SPO2.hasAccess, true);
    });
  });

  describe('5. Bảo mật và ngoại lệ', () => {
    it('5.1 Trả về 401 Unauthorized khi không có token', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-overview`);
      assert.equal(res.status, 401);
    });

    it('5.2 Người ngoài gia đình (Stranger) request -> Trả về 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/members/${userA._id}/health-overview`)
        .set('Authorization', `Bearer ${tokenStranger}`);
      assert.equal(res.status, 403);
    });

    it('5.3 Trả về 400 Bad Request khi truyền ID không hợp lệ', async () => {
      const res = await request(app)
        .get(`/api/families/invalid-id/members/${userA._id}/health-overview`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.equal(res.status, 400);
    });
  });
});
