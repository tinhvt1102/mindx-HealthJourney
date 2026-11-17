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
import { HabitPlan } from '../src/models/HabitPlan.js';
import { HabitLog } from '../src/models/HabitLog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
process.env.NODE_ENV = 'test';

const JWT_SECRET = process.env.JWT_SECRET || 'healthjourney_jwt_secret_test';

describe('Integration Test: Weekly Habit Board & Habit Streak (Phương án B & C)', () => {
  let testUser, userToken;
  const testEmail = 'habit_test_user@example.com';
  const today = new Date().toISOString().split('T')[0];

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await User.deleteMany({ email: testEmail });
    testUser = await User.create({
      email: testEmail,
      password: 'password123',
      fullName: 'Habit Tester',
      heightCm: 172,
    });

    userToken = jwt.sign({ id: testUser._id }, JWT_SECRET, { expiresIn: '1d' });

    await HabitPlan.deleteMany({ userId: testUser._id });
    await HabitLog.deleteMany({ userId: testUser._id });
  });

  after(async () => {
    await HabitPlan.deleteMany({ userId: testUser._id });
    await HabitLog.deleteMany({ userId: testUser._id });
    await User.deleteMany({ email: testEmail });
  });

  it('1.1 GET /api/habits/week -> Yêu cầu xác thực token (401 khi thiếu)', async () => {
    const res = await request(app).get('/api/habits/week');
    assert.strictEqual(res.status, 401);
  });

  it('1.2 POST /api/habits/sync-ai -> Chuyển đổi văn bản AI thành các mục checklist ăn uống & tập luyện', async () => {
    const mockAiMarkdown = `
### 1. Xu hướng chính
- Huyết áp ổn định, nhịp tim bình thường.

### 2. Điểm tích cực
- Cân nặng duy trì tốt.

### 3. Quy trình ăn uống phù hợp
- Ăn giảm muối, tăng cường rau xanh và kali (DASH Diet)
- Bổ sung 2 lít nước mỗi ngày và hạn chế nước ngọt

### 4. Quy trình tập luyện phù hợp
- Đi bộ nhanh hoặc đạp xe 30 phút mỗi ngày
- Thực hiện bài tập kéo giãn cơ nhẹ nhàng 10 phút trước khi ngủ

### 5. Lưu ý sinh hoạt
- Ngủ đủ 7-8 tiếng mỗi đêm.
`;

    const res = await request(app)
      .post('/api/habits/sync-ai')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ summaryText: mockAiMarkdown });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(res.body.plan.items.length >= 4);

    const dietItems = res.body.plan.items.filter((i) => i.category === 'diet');
    const workoutItems = res.body.plan.items.filter((i) => i.category === 'workout');
    assert(dietItems.length >= 2, 'Cần có ít nhất 2 mục ăn uống');
    assert(workoutItems.length >= 2, 'Cần có ít nhất 2 mục tập luyện');
  });

  it('1.3 GET /api/habits/week -> Lấy kế hoạch tuần hiện tại kèm 7 ngày', async () => {
    const res = await request(app)
      .get(`/api/habits/week?date=${today}`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.weekDates.length, 7);
    assert(res.body.plan !== null);
    assert(res.body.streak !== undefined);
  });

  it('1.4 POST /api/habits/log -> Tick hoàn thành 1 mục hôm nay và tăng Habit Streak', async () => {
    const weekRes = await request(app)
      .get(`/api/habits/week?date=${today}`)
      .set('Authorization', `Bearer ${userToken}`);

    const firstItem = weekRes.body.plan.items[0];
    assert(firstItem, 'Phải có ít nhất 1 item');

    const toggleRes = await request(app)
      .post('/api/habits/log')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        date: today,
        itemId: firstItem.id,
        completed: true,
      });

    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.body.success, true);
    assert(toggleRes.body.log.completedItemIds.includes(firstItem.id));
    assert(toggleRes.body.streak.currentStreak >= 1);
  });

  it('1.5 POST /api/habits/log -> Bỏ tick (completed: false) thành công', async () => {
    const weekRes = await request(app)
      .get(`/api/habits/week?date=${today}`)
      .set('Authorization', `Bearer ${userToken}`);

    const firstItem = weekRes.body.plan.items[0];

    const uncheckRes = await request(app)
      .post('/api/habits/log')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        date: today,
        itemId: firstItem.id,
        completed: false,
      });

    assert.strictEqual(uncheckRes.status, 200);
    assert(!uncheckRes.body.log.completedItemIds.includes(firstItem.id));
  });
});
