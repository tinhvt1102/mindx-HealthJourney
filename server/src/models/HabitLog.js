import mongoose from 'mongoose';

const habitLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String, // Định dạng YYYY-MM-DD
      required: true,
      index: true,
    },
    completedItemIds: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

habitLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const HabitLog = mongoose.model('HabitLog', habitLogSchema);
