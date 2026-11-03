import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  Heart, 
  Droplet, 
  Scale, 
  Thermometer, 
  Wind, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { healthRecordService } from '../services/api';

const METRIC_CONFIGS = {
  BLOOD_PRESSURE: {
    label: 'Huyết áp',
    unit: 'mmHg',
    icon: Activity,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    description: 'Bao gồm huyết áp tâm thu và tâm trương (ví dụ: 120/80 mmHg)',
  },
  HEART_RATE: {
    label: 'Nhịp tim',
    unit: 'bpm',
    icon: Heart,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Nhịp đập mỗi phút khi nghỉ ngơi (30 - 220 bpm)',
  },
  BLOOD_SUGAR: {
    label: 'Đường huyết',
    unit: 'mg/dL',
    icon: Droplet,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Nồng độ đường trong máu (20 - 600 mg/dL)',
  },
  WEIGHT: {
    label: 'Cân nặng',
    unit: 'kg',
    icon: Scale,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    description: 'Trọng lượng cơ thể (10 - 300 kg), tự động tính chỉ số BMI',
  },
  TEMPERATURE: {
    label: 'Thân nhiệt',
    unit: '°C',
    icon: Thermometer,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Nhiệt độ cơ thể (34 - 43 °C)',
  },
  SPO2: {
    label: 'SpO2',
    unit: '%',
    icon: Wind,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    description: 'Nồng độ bão hòa oxy trong máu (50 - 100 %)',
  },
};

/**
 * Modal ghi nhật ký và chỉnh sửa chỉ số sức khỏe (SCRUM-24)
 */
export default function HealthRecordModal({
  isOpen,
  onClose,
  onSuccess,
  recordToEdit = null,
  initialType = 'BLOOD_PRESSURE',
  currentUserHeight = null,
}) {
  const [type, setType] = useState(initialType);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [value, setValue] = useState('');
  const [recordedAt, setRecordedAt] = useState('');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [previewBmi, setPreviewBmi] = useState(null);

  // Khởi tạo dữ liệu form khi mở modal
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      if (recordToEdit) {
        setType(recordToEdit.type);
        if (recordToEdit.type === 'BLOOD_PRESSURE') {
          setSystolic(recordToEdit.systolic ?? '');
          setDiastolic(recordToEdit.diastolic ?? '');
          setValue('');
        } else {
          setValue(recordToEdit.value ?? '');
          setSystolic('');
          setDiastolic('');
        }
        // Định dạng datetime-local (YYYY-MM-DDTHH:mm)
        const dateObj = recordToEdit.recordedAt ? new Date(recordToEdit.recordedAt) : new Date();
        const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setRecordedAt(localIso);
        setNote(recordToEdit.note || '');
      } else {
        setType(initialType || 'BLOOD_PRESSURE');
        setSystolic('');
        setDiastolic('');
        setValue('');
        const now = new Date();
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setRecordedAt(localIso);
        setNote('');
      }
    }
  }, [isOpen, recordToEdit, initialType]);

  // Tự động tính BMI xem trước khi người dùng nhập cân nặng
  useEffect(() => {
    if (type === 'WEIGHT' && value && currentUserHeight) {
      const w = parseFloat(value);
      const hMeters = parseFloat(currentUserHeight) / 100;
      if (w > 0 && hMeters > 0) {
        const bmiVal = (w / (hMeters * hMeters)).toFixed(1);
        setPreviewBmi(bmiVal);
      } else {
        setPreviewBmi(null);
      }
    } else {
      setPreviewBmi(null);
    }
  }, [type, value, currentUserHeight]);

  if (!isOpen) return null;

  // Client validation trước khi gửi
  const validateForm = () => {
    const errs = {};

    if (type === 'BLOOD_PRESSURE') {
      const sys = parseFloat(systolic);
      const dia = parseFloat(diastolic);

      if (!systolic || isNaN(sys)) {
        errs.systolic = 'Vui lòng nhập huyết áp tâm thu';
      } else if (sys < 60 || sys > 260) {
        errs.systolic = 'Tâm thu nên nằm trong khoảng 60 - 260 mmHg';
      }

      if (!diastolic || isNaN(dia)) {
        errs.diastolic = 'Vui lòng nhập huyết áp tâm trương';
      } else if (dia < 40 || dia > 160) {
        errs.diastolic = 'Tâm trương nên nằm trong khoảng 40 - 160 mmHg';
      }

      if (!errs.systolic && !errs.diastolic && sys <= dia) {
        errs.diastolic = 'Chỉ số tâm thu phải lớn hơn tâm trương';
      }
    } else {
      const numVal = parseFloat(value);
      if (!value || isNaN(numVal)) {
        errs.value = 'Vui lòng nhập giá trị chỉ số';
      } else {
        if (type === 'HEART_RATE' && (numVal < 30 || numVal > 220)) {
          errs.value = 'Nhịp tim sinh lý từ 30 đến 220 bpm';
        } else if (type === 'BLOOD_SUGAR' && (numVal < 20 || numVal > 600)) {
          errs.value = 'Đường huyết từ 20 đến 600 mg/dL';
        } else if (type === 'WEIGHT' && (numVal < 10 || numVal > 300)) {
          errs.value = 'Cân nặng hợp lệ từ 10 đến 300 kg';
        } else if (type === 'TEMPERATURE' && (numVal < 34 || numVal > 43)) {
          errs.value = 'Thân nhiệt từ 34 đến 43 °C';
        } else if (type === 'SPO2' && (numVal < 50 || numVal > 100)) {
          errs.value = 'SpO2 từ 50% đến 100%';
        }
      }
    }

    if (recordedAt) {
      const chosen = new Date(recordedAt);
      if (chosen > new Date()) {
        errs.recordedAt = 'Thời gian đo không thể ở tương lai';
      }
    }

    if (note && note.length > 500) {
      errs.note = 'Ghi chú tối đa 500 ký tự';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const payload = {
        type,
        recordedAt: recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString(),
        note: note.trim(),
      };

      if (type === 'BLOOD_PRESSURE') {
        payload.systolic = Number(systolic);
        payload.diastolic = Number(diastolic);
      } else {
        payload.value = Number(value);
      }

      let res;
      if (recordToEdit?._id || recordToEdit?.id) {
        const id = recordToEdit._id || recordToEdit.id;
        res = await healthRecordService.update(id, payload);
      } else {
        res = await healthRecordService.create(payload);
      }

      if (res?.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      }
    } catch (err) {
      console.error('Lỗi khi lưu chỉ số:', err);
      const apiErrors = err.response?.data?.errors;
      if (apiErrors && typeof apiErrors === 'object') {
        setErrors(apiErrors);
      } else {
        setErrors({
          global: err.response?.data?.message || 'Không thể lưu chỉ số sức khỏe. Vui lòng thử lại.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const currentConfig = METRIC_CONFIGS[type] || METRIC_CONFIGS.BLOOD_PRESSURE;
  const MetricIcon = currentConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${currentConfig.bgColor} ${currentConfig.color} flex items-center justify-center shadow-xs`}>
              <MetricIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg leading-tight">
                {recordToEdit ? 'Chỉnh sửa chỉ số sức khỏe' : 'Ghi nhận chỉ số sức khỏe'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {recordToEdit ? 'Cập nhật lại kết quả đo' : 'Lưu lại kết quả kiểm tra thể trạng của bạn'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errors.global && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.global}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Chọn loại chỉ số (nếu là tạo mới) */}
          {!recordToEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Chọn loại chỉ số <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(METRIC_CONFIGS).map(([key, item]) => {
                  const Icon = item.icon;
                  const isSelected = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setType(key);
                        setErrors({});
                      }}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/80 text-teal-800 ring-2 ring-teal-500/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-teal-600' : item.color}`} />
                      <span className="text-[11px] font-bold truncate max-w-full">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ô nhập liệu theo từng loại chỉ số */}
          {type === 'BLOOD_PRESSURE' ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Chỉ số huyết áp (mmHg) <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      placeholder="120"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${
                        errors.systolic
                          ? 'border-rose-400 focus:ring-rose-200'
                          : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                      Tâm thu
                    </span>
                  </div>
                  {errors.systolic && (
                    <p className="text-[11px] text-rose-600 mt-1">{errors.systolic}</p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      placeholder="80"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${
                        errors.diastolic
                          ? 'border-rose-400 focus:ring-rose-200'
                          : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'
                      }`}
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                      Tâm trương
                    </span>
                  </div>
                  {errors.diastolic && (
                    <p className="text-[11px] text-rose-600 mt-1">{errors.diastolic}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Chuẩn tham chiếu người lớn bình thường: khoảng <strong>120/80 mmHg</strong>.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Giá trị đo ({currentConfig.unit}) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={type === 'TEMPERATURE' ? '0.1' : type === 'WEIGHT' ? '0.1' : '1'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Ví dụ: 75"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${
                    errors.value
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'
                  }`}
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">
                  {currentConfig.unit}
                </span>
              </div>
              {errors.value && <p className="text-[11px] text-rose-600 mt-1">{errors.value}</p>}
              <p className="text-xs text-slate-500 mt-1">{currentConfig.description}</p>

              {/* Xem trước chỉ số BMI khi nhập cân nặng */}
              {previewBmi && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-teal-50/80 border border-teal-200/80 flex items-center justify-between text-xs text-teal-900">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    Chỉ số BMI ước tính:
                  </span>
                  <span className="font-bold text-teal-800 text-sm">{previewBmi} kg/m²</span>
                </div>
              )}
            </div>
          )}

          {/* Thời gian đo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Thời gian đo</span>
            </label>
            <input
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className={`w-full px-4 py-2 rounded-xl border text-xs text-slate-700 focus:outline-none focus:ring-2 ${
                errors.recordedAt
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'
              }`}
            />
            {errors.recordedAt && (
              <p className="text-[11px] text-rose-600 mt-1">{errors.recordedAt}</p>
            )}
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Ghi chú thêm (tùy chọn)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Đo sau khi ăn sáng 2 tiếng, sau khi tập thể dục..."
              maxLength={500}
              className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none"
            />
            {errors.note && <p className="text-[11px] text-rose-600 mt-1">{errors.note}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{recordToEdit ? 'Cập nhật chỉ số' : 'Lưu chỉ số'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}