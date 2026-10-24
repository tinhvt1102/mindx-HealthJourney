import mongoose from 'mongoose';

// Danh sách các loại chỉ số sức khỏe được hỗ trợ
export const HEALTH_METRIC_TYPES = [
  'BLOOD_PRESSURE', // Huyết áp
  'HEART_RATE',     // Nhịp tim
  'BLOOD_SUGAR',    // Đường huyết
  'WEIGHT',         // Cân nặng
  'TEMPERATURE',    // Thân nhiệt
  'SPO2',           // Nồng độ oxy trong máu
];

// Đơn vị mặc định tương ứng với từng loại chỉ số
export const DEFAULT_UNITS = {
  BLOOD_PRESSURE: 'mmHg',
  HEART_RATE: 'bpm',
  BLOOD_SUGAR: 'mg/dL',
  WEIGHT: 'kg',
  TEMPERATURE: '°C',
  SPO2: '%',
};

const healthRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID là bắt buộc'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Loại chỉ số sức khỏe là bắt buộc'],
      enum: {
        values: HEALTH_METRIC_TYPES,
        message: 'Loại chỉ số không hợp lệ. Chỉ chấp nhận: {VALUES}',
      },
      index: true,
    },
    // Dành cho chỉ số đơn: HEART_RATE, BLOOD_SUGAR, WEIGHT, TEMPERATURE, SPO2
    value: {
      type: Number,
    },
    // Dành cho huyết áp (BLOOD_PRESSURE)
    systolic: {
      type: Number, // Tâm thu (mmHg)
    },
    diastolic: {
      type: Number, // Tâm trương (mmHg)
    },
    unit: {
      type: String,
      trim: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Ghi chú tối đa 500 ký tự'],
      default: '',
    },
    // Chỉ dùng khi type = WEIGHT: BMI tự động tính từ cân nặng và chiều cao profile (AC3 SCRUM-24)
    bmi: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Tự động gán đơn vị chuẩn nếu chưa có trước khi lưu
healthRecordSchema.pre('save', function (next) {
  if (!this.unit && DEFAULT_UNITS[this.type]) {
    this.unit = DEFAULT_UNITS[this.type];
  }
  next();
});

// Index phục vụ query lịch sử chỉ số theo thời gian (AC1 & AC2 SCRUM-28)
healthRecordSchema.index({ userId: 1, type: 1, recordedAt: -1 });

export const HealthRecord = mongoose.model('HealthRecord', healthRecordSchema);
