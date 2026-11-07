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
import { Reminder } from '../src/models/Reminder.js';
import { DoctorShareLink } from '../src/models/DoctorShareLink.js';
import { Streak } from '../src/models/Streak.js';
import { HealthRecord } from '../src/models/HealthRecord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
process.env.NODE_ENV = 'test';

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: Reminders, Doctor Share, and Health Streaks (SCRUM-67, SCRUM-74, SCRUM-85)', () => {
  let testUser, userToken;
  let testReminderId;
  let doctorShareToken;

  const testEmail = 'extra_test_user@example.com';

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await User.deleteMany({ email: testEmail });
    testUser = await User.create({
      email: testEmail,
      password: 'password123',
      fullName: 'Bác Sĩ Share Test User',
      heightCm: 175,
      weightKg: 70,
    });

    userToken = jwt.sign({ id: testUser._id }, JWT_SECRET, { expiresIn: '1d' });

    await Reminder.deleteMany({ userId: testUser._id });
    await DoctorShareLink.deleteMany({ userId: testUser._id });
    await Streak.deleteMany({ userId: testUser._id });
    await HealthRecord.deleteMany({ userId: testUser._id });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      if (testUser) {
        await User.deleteMany({ email: testEmail });
        await Reminder.deleteMany({ userId: testUser._id });
        await DoctorShareLink.deleteMany({ userId: testUser._id });
        await Streak.deleteMany({ userId: testUser._id });
        await HealthRecord.deleteMany({ userId: testUser._id });
      }
      await mongoose.disconnect();
    }
  });

  // ====== 1. REMINDERS (SCRUM-67) ======
  describe('1. Quản lý Lịch nhắc nhở (Reminders)', () => {
    it('1.1 POST /api/reminders -> Tạo lịch nhắc uống thuốc thành công', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Uống thuốc Amlodipine 5mg',
          type: 'MEDICATION',
          time: '08:00',
          frequency: 'DAILY',
          dosage: '1 viên sau ăn sáng',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.title, 'Uống thuốc Amlodipine 5mg');
      testReminderId = res.body.data._id;
    });

    it('1.2 GET /api/reminders -> Lấy danh sách lịch nhắc kèm trạng thái hôm nay', async () => {
      const res = await request(app)
        .get('/api/reminders')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].isCompletedToday, false);
    });

    it('1.3 POST /api/reminders/:id/toggle -> Đánh dấu hoàn thành hôm nay', async () => {
      const res = await request(app)
        .post(`/api/reminders/${testReminderId}/toggle`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.data.isCompletedToday, true);

      // Verify status in list
      const listRes = await request(app)
        .get('/api/reminders')
        .set('Authorization', `Bearer ${userToken}`);
      assert.equal(listRes.body.data[0].isCompletedToday, true);
    });

    it('1.4 GET /api/reminders/stats -> Thống kê tỷ lệ tuân thủ điều trị', async () => {
      const res = await request(app)
        .get('/api/reminders/stats')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.complianceRate >= 0);
    });
  });

  // ====== 2. DOCTOR SHARE LINK (SCRUM-74) ======
  describe('2. Liên kết chia sẻ Bác sĩ (Doctor Share Links)', () => {
    it('2.1 POST /api/shares/create-doctor-link -> Tạo link với PIN 4 số', async () => {
      const res = await request(app)
        .post('/api/shares/create-doctor-link')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pin: '1234',
          durationHours: 24,
          notes: 'Kính gửi Bác sĩ xem giúp huyết áp tháng này',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.ok(res.body.data.shareUrl);
      doctorShareToken = res.body.data.token;
    });

    it('2.2 POST /api/shares/:token/verify-pin -> Chặn khi nhập sai mã PIN (401)', async () => {
      const res = await request(app)
        .post(`/api/shares/${doctorShareToken}/verify-pin`)
        .send({ pin: '9999' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('2.3 POST /api/shares/:token/verify-pin -> Cho phép truy cập khi đúng mã PIN (200)', async () => {
      // Log 1 record trước
      await HealthRecord.create({
        userId: testUser._id,
        type: 'BLOOD_PRESSURE',
        systolic: 120,
        diastolic: 80,
      });

      const res = await request(app)
        .post(`/api/shares/${doctorShareToken}/verify-pin`)
        .send({ pin: '1234' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.patient.name, 'Bác Sĩ Share Test User');
      assert.ok(res.body.data.records.length >= 1);
    });

    it('2.4 DELETE /api/shares/:token -> Thu hồi quyền truy cập của bác sĩ', async () => {
      const res = await request(app)
        .delete(`/api/shares/${doctorShareToken}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);

      // Verify cannot access anymore
      const verifyRes = await request(app)
        .post(`/api/shares/${doctorShareToken}/verify-pin`)
        .send({ pin: '1234' });
      assert.equal(verifyRes.status, 404);
    });
  });

  // ====== 3. STREAKS & BADGES (SCRUM-85) ======
  describe('3. Chuỗi ngày đo (Streaks) & Huy hiệu (Badges)', () => {
    it('3.1 GET /api/streaks -> Trả về streak và danh sách huy hiệu', async () => {
      const res = await request(app)
        .get('/api/streaks')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.currentStreak >= 1);
      assert.ok(Array.isArray(res.body.data.badges));
      // Đã ghi 1 record nên có huy hiệu Khởi đầu khỏe mạnh
      const firstBadge = res.body.data.badges.find((b) => b.id === 'FIRST_RECORD');
      assert.ok(firstBadge);
      assert.equal(firstBadge.isUnlocked, true);
    });
  });
});
