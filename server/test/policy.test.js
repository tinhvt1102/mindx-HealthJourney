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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: SharingPolicy API (Jira SCRUM-43)', () => {
  let userA, tokenA; // Owner
  let userB, tokenB; // Member 1 (Viewer)
  let userC, tokenC; // Member 2 (Viewer)
  let userStranger, tokenStranger; // Người ngoài không thuộc gia đình
  let testFamily;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
    }

    const testEmails = [
      'policy_owner_a@example.com',
      'policy_viewer_b@example.com',
      'policy_viewer_c@example.com',
      'policy_stranger@example.com',
    ];

    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_POLICY\]/ });
    await SharingPolicy.deleteMany({});

    // Tạo User A (Owner)
    userA = await User.create({
      email: 'policy_owner_a@example.com',
      passwordHash: 'dummyHash',
      name: 'Nguyen Van Owner',
      fullName: 'Nguyen Van Owner',
    });
    tokenA = jwt.sign({ id: userA._id }, JWT_SECRET, { expiresIn: '1h' });

    // Tạo User B (Viewer 1)
    userB = await User.create({
      email: 'policy_viewer_b@example.com',
      passwordHash: 'dummyHash',
      name: 'Tran Thi Viewer',
      fullName: 'Tran Thi Viewer',
    });
    tokenB = jwt.sign({ id: userB._id }, JWT_SECRET, { expiresIn: '1h' });

    // Tạo User C (Viewer 2)
    userC = await User.create({
      email: 'policy_viewer_c@example.com',
      passwordHash: 'dummyHash',
      name: 'Le Van Viewer 2',
      fullName: 'Le Van Viewer 2',
    });
    tokenC = jwt.sign({ id: userC._id }, JWT_SECRET, { expiresIn: '1h' });

    // Tạo User Stranger (Người lạ)
    userStranger = await User.create({
      email: 'policy_stranger@example.com',
      passwordHash: 'dummyHash',
      name: 'Nguoi La',
      fullName: 'Nguoi La',
    });
    tokenStranger = jwt.sign({ id: userStranger._id }, JWT_SECRET, { expiresIn: '1h' });

    // Tạo nhóm gia đình mẫu có User A, B, C
    testFamily = await Family.create({
      name: '[TEST_POLICY] Gia đình mẫu',
      createdBy: userA._id,
      members: [
        { userId: userA._id, role: 'ADMIN', joinedAt: new Date() },
        { userId: userB._id, role: 'MEMBER', joinedAt: new Date() },
        { userId: userC._id, role: 'MEMBER', joinedAt: new Date() },
      ],
    });
  });

  after(async () => {
    const testEmails = [
      'policy_owner_a@example.com',
      'policy_viewer_b@example.com',
      'policy_viewer_c@example.com',
      'policy_stranger@example.com',
    ];
    await User.deleteMany({ email: { $in: testEmails } });
    await Family.deleteMany({ name: /^\[TEST_POLICY\]/ });
    await SharingPolicy.deleteMany({});
    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. KIỂM TRA GET /api/families/:familyId/policies
  // =========================================================================
  describe('1. GET /api/families/:familyId/policies (Lấy chính sách chia sẻ)', () => {
    it('1.1 Trả về 401 Unauthorized khi không có Bearer token', async () => {
      const res = await request(app).get(`/api/families/${testFamily._id}/policies`);
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('1.2 Trả về 404 khi ID nhóm gia đình không tồn tại', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/families/${fakeId}/policies`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('1.3 Trả về 403 Forbidden khi người gọi không phải thành viên nhóm', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenStranger}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('1.4 [AC1 SCRUM-41] Mặc định trả về Default Deny (allowedMetrics: []) cho tất cả thành viên khác khi chưa thiết lập', async () => {
      const res = await request(app)
        .get(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2); // Chỉ bao gồm User B và User C (loại trừ chính User A)
      assert.ok(Array.isArray(res.body.policies));

      // Kiểm tra cả 2 người đều có allowedMetrics = [] theo Default Deny
      for (const policy of res.body.policies) {
        assert.deepEqual(policy.allowedMetrics, []);
        assert.ok(policy.viewerName);
        assert.ok(policy.viewerEmail);
      }
    });
  });

  // =========================================================================
  // 2. KIỂM TRA PUT /api/families/:familyId/policies
  // =========================================================================
  describe('2. PUT /api/families/:familyId/policies (Cập nhật chính sách chia sẻ)', () => {
    it('2.1 Cập nhật thành công quyền xem cho 1 viewer (Huyết áp & Nhịp tim) - 200 OK', async () => {
      const res = await request(app)
        .put(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          viewerId: userB._id.toString(),
          allowedMetrics: ['BLOOD_PRESSURE', 'HEART_RATE'],
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.updatedCount, 1);
      assert.deepEqual(res.body.policies[0].allowedMetrics, ['BLOOD_PRESSURE', 'HEART_RATE']);

      // GET lại để đối chiếu đảm bảo đã lưu vào DB
      const getRes = await request(app)
        .get(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`);

      const policyOfB = getRes.body.policies.find((p) => p.viewerId === userB._id.toString());
      assert.ok(policyOfB);
      assert.deepEqual(policyOfB.allowedMetrics, ['BLOOD_PRESSURE', 'HEART_RATE']);

      // User C vẫn là Default Deny (allowedMetrics: [])
      const policyOfC = getRes.body.policies.find((p) => p.viewerId === userC._id.toString());
      assert.ok(policyOfC);
      assert.deepEqual(policyOfC.allowedMetrics, []);
    });

    it('2.2 Cập nhật hàng loạt (Batch Upsert) cho nhiều thành viên cùng lúc', async () => {
      const res = await request(app)
        .put(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          policies: [
            {
              viewerId: userB._id.toString(),
              allowedMetrics: ['BLOOD_PRESSURE', 'HEART_RATE', 'WEIGHT'],
            },
            {
              viewerId: userC._id.toString(),
              allowedMetrics: ['SPO2', 'TEMPERATURE'],
            },
          ],
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.updatedCount, 2);

      // GET lại để xác nhận
      const getRes = await request(app)
        .get(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`);

      const policyOfB = getRes.body.policies.find((p) => p.viewerId === userB._id.toString());
      const policyOfC = getRes.body.policies.find((p) => p.viewerId === userC._id.toString());

      assert.deepEqual(policyOfB.allowedMetrics, ['BLOOD_PRESSURE', 'HEART_RATE', 'WEIGHT']);
      assert.deepEqual(policyOfC.allowedMetrics, ['SPO2', 'TEMPERATURE']);
    });

    it('2.3 Chặn khi truyền loại chỉ số không hợp lệ (400 Bad Request)', async () => {
      const res = await request(app)
        .put(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          viewerId: userB._id.toString(),
          allowedMetrics: ['INVALID_METRIC_NAME'],
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /không hợp lệ/i);
    });

    it('2.4 Chặn khi cố thiết lập chính sách cho chính bản thân mình (400 Bad Request)', async () => {
      const res = await request(app)
        .put(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          viewerId: userA._id.toString(),
          allowedMetrics: ['BLOOD_PRESSURE'],
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /chính bản thân/i);
    });

    it('2.5 Chặn khi viewerId không phải thành viên trong nhóm gia đình (400 Bad Request)', async () => {
      const res = await request(app)
        .put(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          viewerId: userStranger._id.toString(),
          allowedMetrics: ['BLOOD_PRESSURE'],
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /không phải là thành viên/i);
    });

    it('2.6 Người ngoài nhóm không thể cập nhật chính sách (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenStranger}`)
        .send({
          viewerId: userB._id.toString(),
          allowedMetrics: ['BLOOD_PRESSURE'],
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('2.7 [AC2 SCRUM-41] Thu hồi toàn bộ quyền xem (chuyển về []) thành công', async () => {
      const res = await request(app)
        .put(`/api/families/${testFamily._id}/policies`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          viewerId: userB._id.toString(),
          allowedMetrics: [], // Thu hồi hết
        });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.policies[0].allowedMetrics, []);
    });
  });
});
