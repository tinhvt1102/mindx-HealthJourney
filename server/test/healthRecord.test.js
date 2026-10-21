import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { HealthRecord } from '../src/models/HealthRecord.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: HealthRecord API (Jira SCRUM-30)', () => {
  let userA, tokenA;
  let userB, tokenB;
  let createdRecordId;

  // Thiết lập môi trường trước khi chạy test suite
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Dọn dẹp dữ liệu test cũ nếu có
    await User.deleteMany({ email: { $in: ['test_hoang_a@example.com', 'test_hoang_b@example.com'] } });
    await HealthRecord.deleteMany({ note: /\[TEST_SUITE\]/ });

    // Tạo User A (Chính) - có heightCm để test AC3 BMI
    userA = await User.create({
      email: 'test_hoang_a@example.com',
      passwordHash: 'dummyHashForTesting',
      name: 'Nguyen Van A',
      fullName: 'Nguyen Van A',
      heightCm: 170, // Dùng để tính BMI khi log WEIGHT (AC3 SCRUM-24)
    });
    tokenA = jwt.sign({ id: userA._id }, JWT_SECRET, { expiresIn: '1h' });

    // Tạo User B (Để test phân quyền / security isolation)
    userB = await User.create({
      email: 'test_hoang_b@example.com',
      passwordHash: 'dummyHashForTesting',
      name: 'Tran Van B',
      fullName: 'Tran Van B',
    });
    tokenB = jwt.sign({ id: userB._id }, JWT_SECRET, { expiresIn: '1h' });
  });

  // Dọn dẹp sau khi toàn bộ test suite kết thúc
  after(async () => {
    if (userA) await HealthRecord.deleteMany({ userId: userA._id });
    if (userB) await HealthRecord.deleteMany({ userId: userB._id });
    await User.deleteMany({ email: { $in: ['test_hoang_a@example.com', 'test_hoang_b@example.com'] } });
    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. KIỂM TRA VALIDATION CÁC GIÁ TRỊ PHI LÝ (Unreasonable Value Validation)
  // =========================================================================
  describe('1. Validation giá trị phi lý (Unreasonable & Invalid Values)', () => {
    it('1.1 Bắt lỗi khi không cung cấp loại chỉ số (type)', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          value: 120,
          note: '[TEST_SUITE] Thiếu type',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors?.type);
    });

    it('1.2 Bắt lỗi khi loại chỉ số không hợp lệ', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'INVALID_METRIC_TYPE',
          value: 100,
          note: '[TEST_SUITE] Sai type',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors?.type);
    });

    it('1.3 Bắt lỗi khi huyết áp có tâm thu nhỏ hơn hoặc bằng tâm trương (systolic <= diastolic)', async () => {
      // Huyết áp tâm thu (áp lực khi tim co bóp) bắt buộc phải lớn hơn tâm trương
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'BLOOD_PRESSURE',
          systolic: 80,
          diastolic: 120, // Phi lý: tâm thu 80 < tâm trương 120
          note: '[TEST_SUITE] Huyết áp đảo ngược phi lý',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors?.bloodPressure);
    });

    it('1.4 Bắt lỗi khi huyết áp có tâm thu bằng tâm trương (systolic == diastolic)', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'BLOOD_PRESSURE',
          systolic: 120,
          diastolic: 120, // Phi lý
          note: '[TEST_SUITE] Huyết áp bằng nhau phi lý',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors?.bloodPressure);
    });

    it('1.5 Bắt lỗi khi huyết áp nằm ngoài ngưỡng sinh lý (systolic < 60 hoặc > 260)', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'BLOOD_PRESSURE',
          systolic: 350, // Cực kỳ phi lý
          diastolic: 80,
          note: '[TEST_SUITE] Huyết áp vượt ngưỡng',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors?.systolic);
    });

    it('1.6 Bắt lỗi khi nhịp tim phi lý (< 30 bpm hoặc > 220 bpm)', async () => {
      const res1 = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'HEART_RATE',
          value: 10, // Quá thấp, phi lý
          note: '[TEST_SUITE] Nhịp tim quá thấp',
        });

      assert.equal(res1.status, 400);
      assert.ok(res1.body.errors?.value);

      const res2 = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'HEART_RATE',
          value: 300, // Quá cao, phi lý
          note: '[TEST_SUITE] Nhịp tim quá cao',
        });

      assert.equal(res2.status, 400);
      assert.ok(res2.body.errors?.value);
    });

    it('1.7 Bắt lỗi khi SpO2 phi lý (> 100% hoặc < 50%)', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'SPO2',
          value: 115, // Nồng độ oxy không thể vượt 100%
          note: '[TEST_SUITE] SpO2 > 100%',
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.errors?.value);
    });

    it('1.8 Bắt lỗi khi thân nhiệt phi lý (< 34°C hoặc > 43°C)', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'TEMPERATURE',
          value: 52.0, // Nhiệt độ người không thể đạt 52°C
          note: '[TEST_SUITE] Nhiệt độ phi lý',
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.errors?.value);
    });

    it('1.9 Bắt lỗi khi đường huyết phi lý (< 20 mg/dL hoặc > 600 mg/dL)', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'BLOOD_SUGAR',
          value: -15, // Giá trị âm phi lý
          note: '[TEST_SUITE] Đường huyết âm',
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.errors?.value);
    });

    it('1.10 Bắt lỗi khi thời gian đo nằm ở tương lai (recordedAt > now)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'HEART_RATE',
          value: 75,
          recordedAt: futureDate.toISOString(),
          note: '[TEST_SUITE] Đo ở tương lai',
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.errors?.recordedAt);
    });
  });

  // =========================================================================
  // 2. KIỂM TRA CÁC THAO TÁC CRUD (Create - Read - Update - Delete)
  // =========================================================================
  describe('2. Thao tác CRUD (Create - Read - Update - Delete)', () => {
    // 2.1 CREATE
    it('2.1 [CREATE] Tạo mới bản ghi Huyết áp hợp lệ thành công (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'BLOOD_PRESSURE',
          systolic: 120,
          diastolic: 80,
          note: '[TEST_SUITE] Huyết áp bình thường',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.type, 'BLOOD_PRESSURE');
      assert.equal(res.body.data.systolic, 120);
      assert.equal(res.body.data.diastolic, 80);
      assert.equal(res.body.data.unit, 'mmHg');

      createdRecordId = res.body.data._id;
    });

    it('2.2 [CREATE] Tạo mới bản ghi Nhịp tim hợp lệ thành công', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'HEART_RATE',
          value: 72,
          unit: 'bpm',
          note: '[TEST_SUITE] Nhịp tim lúc nghỉ ngơi',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.type, 'HEART_RATE');
      assert.equal(res.body.data.value, 72);
    });

    // 2.2 READ LIST
    it('2.3 [READ] Lấy danh sách toàn bộ chỉ số của người dùng (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.count >= 2);
    });

    // 2.3 READ WITH FILTERS (AC1 Jira SCRUM-28: Lọc theo 7 ngày, 30 ngày và loại chỉ số)
    it('2.4 [READ - FILTER] Lọc theo loại chỉ số (type=BLOOD_PRESSURE)', async () => {
      const res = await request(app)
        .get('/api/v1/health-records?type=BLOOD_PRESSURE')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.every((r) => r.type === 'BLOOD_PRESSURE'));
    });

    it('2.5 [READ - FILTER] Lọc theo khoảng thời gian 7 ngày (days=7) và 30 ngày (days=30)', async () => {
      const res7Days = await request(app)
        .get('/api/v1/health-records?days=7')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res7Days.status, 200);
      assert.ok(res7Days.body.count >= 1);

      const res30Days = await request(app)
        .get('/api/v1/health-records?days=30')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res30Days.status, 200);
      assert.ok(res30Days.body.count >= 1);
    });

    // 2.4 READ ONE BY ID
    it('2.6 [READ - DETAIL] Lấy chi tiết một bản ghi theo ID hợp lệ', async () => {
      const res = await request(app)
        .get(`/api/v1/health-records/${createdRecordId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data._id, createdRecordId);
      assert.equal(res.body.data.type, 'BLOOD_PRESSURE');
    });

    it('2.7 [READ - DETAIL] Trả về 404 khi ID không tồn tại', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/health-records/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    // 2.5 UPDATE
    it('2.8 [UPDATE] Cập nhật bản ghi hợp lệ thành công (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/health-records/${createdRecordId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          systolic: 125,
          diastolic: 82,
          note: '[TEST_SUITE] Cập nhật huyết áp sau khi vận động',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.systolic, 125);
      assert.equal(res.body.data.diastolic, 82);
      assert.equal(res.body.data.note, '[TEST_SUITE] Cập nhật huyết áp sau khi vận động');
    });

    it('2.9 [UPDATE] Chặn cập nhật khi truyền giá trị phi lý (400 Bad Request)', async () => {
      const res = await request(app)
        .put(`/api/v1/health-records/${createdRecordId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          systolic: 70,
          diastolic: 110, // Tâm thu < tâm trương
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors?.bloodPressure);
    });

    // 2.6 DELETE
    it('2.10 [DELETE] Xóa bản ghi thành công (200 OK)', async () => {
      const res = await request(app)
        .delete(`/api/v1/health-records/${createdRecordId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Kiểm tra lại đảm bảo bản ghi đã bị xóa
      const checkRes = await request(app)
        .get(`/api/v1/health-records/${createdRecordId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(checkRes.status, 404);
    });

    // AC3 SCRUM-24: Tự động tính BMI khi log cân nặng
    it('2.11 [CREATE - AC3] Tự động tính và lưu BMI khi log cân nặng (WEIGHT)', async () => {
      // User A có heightCm = 170, log cân nặng 70kg => BMI = 70 / (1.7^2) ≈ 24.2
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'WEIGHT',
          value: 70,
          note: '[TEST_SUITE] Log cân nặng để test BMI tự động',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.type, 'WEIGHT');
      assert.equal(res.body.data.value, 70);

      // BMI = 70 / (1.70^2) = 24.2
      assert.ok(res.body.data.bmi !== null, 'BMI phải được tính và lưu vào record');
      assert.equal(res.body.data.bmi, 24.2, 'BMI phải là 24.2 với chiều cao 170cm và cân nặng 70kg');
    });

    it('2.12 [CREATE - AC3] Bản ghi các loại khác (HEART_RATE) KHÔNG có trường bmi', async () => {
      const res = await request(app)
        .post('/api/v1/health-records')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'HEART_RATE',
          value: 80,
          note: '[TEST_SUITE] Nhịp tim không có BMI',
        });

      assert.equal(res.status, 201);
      // bmi phải là null (không áp dụng cho HEART_RATE)
      assert.equal(res.body.data.bmi, null, 'BMI phải là null với loại chỉ số không phải WEIGHT');
    });
  });

  // =========================================================================
  // 3. KIỂM TRA BẢO MẬT VÀ PHÂN QUYỀN (Security & Isolation)
  // =========================================================================
  describe('3. Bảo mật & Phân quyền (Security & Isolation)', () => {
    let recordOfUserA;

    before(async () => {
      recordOfUserA = await HealthRecord.create({
        userId: userA._id,
        type: 'HEART_RATE',
        value: 80,
        unit: 'bpm',
        note: '[TEST_SUITE] Bản ghi của user A',
      });
    });

    it('3.1 Trả về 401 Unauthorized khi không có Bearer Token', async () => {
      const res = await request(app).get('/api/v1/health-records');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('3.2 User B không thể xem bản ghi của User A (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/health-records/${recordOfUserA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('3.3 User B không thể chỉnh sửa bản ghi của User A (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/v1/health-records/${recordOfUserA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          value: 95,
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('3.4 User B không thể xóa bản ghi của User A (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/health-records/${recordOfUserA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });
  });
});
