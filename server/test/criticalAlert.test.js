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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
process.env.NODE_ENV = 'test';

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: Critical Alert & Notifications (Jira SCRUM-61 / SCRUM-62 / SCRUM-64)', () => {
  let userPatient, tokenPatient;
  let userRelativeWithPermission, tokenRelativeWithPermission;
  let userRelativeNoPermission, tokenRelativeNoPermission;
  let testFamily;

  const testEmails = [
    'alert_patient@example.com',
    'alert_relative_allowed@example.com',
    'alert_relative_denied@example.com',
  ];

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Dọn dẹp
    await User.deleteMany({ email: { $in: testEmails } });
    await Notification.deleteMany({});

    userPatient = await User.create({
      email: testEmails[0],
      password: 'password123',
      fullName: 'Bệnh nhân Test',
      heightCm: 170,
      weightKg: 65,
    });

    userRelativeWithPermission = await User.create({
      email: testEmails[1],
      password: 'password123',
      fullName: 'Người thân Được cấp quyền',
    });

    userRelativeNoPermission = await User.create({
      email: testEmails[2],
      password: 'password123',
      fullName: 'Người thân Bị chặn quyền',
    });

    tokenPatient = jwt.sign({ id: userPatient._id }, JWT_SECRET, { expiresIn: '1d' });
    tokenRelativeWithPermission = jwt.sign({ id: userRelativeWithPermission._id }, JWT_SECRET, { expiresIn: '1d' });
    tokenRelativeNoPermission = jwt.sign({ id: userRelativeNoPermission._id }, JWT_SECRET, { expiresIn: '1d' });

    testFamily = await Family.create({
      name: 'Gia đình Cảnh báo Test',
      createdBy: userPatient._id,
      members: [
        { userId: userPatient._id, role: 'ADMIN' },
        { userId: userRelativeWithPermission._id, role: 'MEMBER' },
        { userId: userRelativeNoPermission._id, role: 'MEMBER' },
      ],
    });

    // Cấp quyền BLOOD_PRESSURE cho relative 1
    await SharingPolicy.create({
      familyId: testFamily._id,
      ownerId: userPatient._id,
      viewerId: userRelativeWithPermission._id,
      allowedMetrics: ['BLOOD_PRESSURE'],
    });

    // Relative 2 KHÔNG được cấp quyền BLOOD_PRESSURE (Default Deny)
    await SharingPolicy.create({
      familyId: testFamily._id,
      ownerId: userPatient._id,
      viewerId: userRelativeNoPermission._id,
      allowedMetrics: ['WEIGHT'], // Chỉ cho xem cân nặng
    });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: { $in: testEmails } });
      if (testFamily) {
        await Family.findByIdAndDelete(testFamily._id);
        await SharingPolicy.deleteMany({ familyId: testFamily._id });
      }
      if (userPatient) {
        await HealthRecord.deleteMany({ userId: userPatient._id });
      }
      await Notification.deleteMany({});
      await mongoose.disconnect();
    }
  });

  it('1. Khi log chỉ số bình thường -> Không kích hoạt cảnh báo nguy kịch', async () => {
    const res = await request(app)
      .post('/api/health-records')
      .set('Authorization', `Bearer ${tokenPatient}`)
      .send({
        type: 'BLOOD_PRESSURE',
        systolic: 118,
        diastolic: 76,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.alert, undefined);

    const notifs = await Notification.find({ recipientId: userRelativeWithPermission._id });
    assert.equal(notifs.length, 0);
  });

  it('2. Khi log chỉ số nguy kịch (HA >= 160/100) -> Tự động trigger cảnh báo nguy kịch', async () => {
    const res = await request(app)
      .post('/api/health-records')
      .set('Authorization', `Bearer ${tokenPatient}`)
      .send({
        type: 'BLOOD_PRESSURE',
        systolic: 168,
        diastolic: 104,
        note: 'Cảm giác đau đầu chóng mặt',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.alert);
    assert.equal(res.body.alert.triggered, true);

    // Người thân có quyền xem nhận được thông báo
    const notifsAllowed = await Notification.find({ recipientId: userRelativeWithPermission._id });
    assert.equal(notifsAllowed.length, 1);
    assert.equal(notifsAllowed[0].type, 'CRITICAL_ALERT');
    assert.ok(notifsAllowed[0].title.includes('CẢNH BÁO NGUY CẤP'));

    // Người thân KHÔNG được cấp quyền xem BLOOD_PRESSURE sẽ KHÔNG nhận được thông báo (Default Deny)
    const notifsDenied = await Notification.find({ recipientId: userRelativeNoPermission._id });
    assert.equal(notifsDenied.length, 0);
  });

  it('3. GET /api/notifications -> Lấy danh sách thông báo và số lượng chưa đọc', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenRelativeWithPermission}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.unreadCount, 1);
  });

  it('4. PUT /api/notifications/:id/read -> Đánh dấu 1 thông báo là đã đọc', async () => {
    const notif = await Notification.findOne({ recipientId: userRelativeWithPermission._id });
    assert.ok(notif);

    const res = await request(app)
      .put(`/api/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${tokenRelativeWithPermission}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.isRead, true);

    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenRelativeWithPermission}`);

    assert.equal(countRes.body.unreadCount, 0);
  });
});
