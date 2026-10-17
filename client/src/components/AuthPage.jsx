import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  KeyRound,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import { authService } from '../services/api';

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Step OTP State
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Countdown timer cho nút gửi lại OTP
  useEffect(() => {
    let timer;
    if (isOtpStep && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [isOtpStep, countdown]);

  // Tính độ mạnh mật khẩu
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd) || /[A-Z]/.test(pwd)) score += 1;
    return score;
  };

  const pwdStrength = calculatePasswordStrength(password);

  // Xử lý gửi Form Đăng nhập / Đăng ký
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        // Đăng nhập
        const data = await authService.login({ email, password });
        localStorage.setItem('health_token', data.token);
        localStorage.setItem('health_user', JSON.stringify(data.user));
        if (onLoginSuccess) onLoginSuccess(data.user);
      } else {
        // Đăng ký -> chuyển sang bước nhập OTP
        if (password.length < 8) {
          setErrorMessage('Mật khẩu bắt buộc từ 8 ký tự trở lên');
          setLoading(false);
          return;
        }
        const data = await authService.register({ fullName, email, password });
        if (data.requireOtp) {
          setIsOtpStep(true);
          setCountdown(60);
          setCanResend(false);
          setSuccessMessage('Mã OTP đã được tạo! Vui lòng kiểm tra email (hoặc Terminal backend).');
        } else {
          localStorage.setItem('health_token', data.token);
          localStorage.setItem('health_user', JSON.stringify(data.user));
          if (onLoginSuccess) onLoginSuccess(data.user);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại!';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý xác thực OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setErrorMessage('Vui lòng nhập đúng 6 chữ số mã OTP');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const data = await authService.verifyOtp({ email, otp: otpCode });
      localStorage.setItem('health_token', data.token);
      localStorage.setItem('health_user', JSON.stringify(data.user));
      setSuccessMessage('Xác thực OTP thành công! Đang chuyển hướng...');
      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess(data.user);
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setErrorMessage('');
    setLoading(true);

    try {
      await authService.resendOtp({ email });
      setSuccessMessage('Đã gửi lại mã OTP mới!');
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Không thể gửi lại mã OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Container chính: 2 cột Split-Screen */}
      <div className="max-w-5xl w-full mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* CỘT TRÁI: Hero Branding & Sứ mệnh y tế */}
        <div className="lg:col-span-5 bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-teal-200 text-xs font-semibold tracking-wide uppercase">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 animate-pulse" />
              HealthJourney v1.0
            </div>
            <h1 className="mt-6 text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Đồng hành cùng <br />
              <span className="text-teal-300">sức khỏe gia đình.</span>
            </h1>
            <p className="mt-4 text-teal-100/80 text-sm leading-relaxed">
              Theo dõi huyết áp, đường huyết, tim mạch với xác thực OTP bảo mật và cơ chế phân quyền riêng tư tuyệt đối.
            </p>
          </div>

          <div className="my-8 space-y-4 relative z-10">
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Xác thực OTP Email</h4>
                <p className="text-xs text-teal-200/70 mt-0.5">Bảo vệ tài khoản và danh tính y tế an toàn.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Gia đình cùng kết nối</h4>
                <p className="text-xs text-teal-200/70 mt-0.5">Cảnh báo màu khi có chỉ số huyết áp bất thường.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">AI tóm tắt xu hướng</h4>
                <p className="text-xs text-teal-200/70 mt-0.5">Trợ lý Gemini giải thích biến động chỉ số hàng tuần.</p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-teal-200/60 border-t border-white/10 pt-4 relative z-10">
            © 2026 HealthJourney. Thông tin chỉ số chỉ mang tính theo dõi hỗ trợ chăm sóc sức khỏe.
          </div>
        </div>

        {/* CỘT PHẢI: Form Đăng nhập / Đăng ký / Xác thực OTP */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            
            {/* TH1: MÀN HÌNH NHẬP MÃ OTP */}
            {isOtpStep ? (
              <div>
                <button
                  type="button"
                  onClick={() => { setIsOtpStep(false); setErrorMessage(''); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Quay lại đăng ký
                </button>

                <div className="text-center sm:text-left">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Xác thực mã OTP
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Mã xác thực gồm 6 chữ số đã được gửi tới email <br />
                    <strong className="text-slate-700">{email}</strong>
                  </p>
                </div>

                {/* Alert Box */}
                {errorMessage && (
                  <div className="mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Form OTP */}
                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 text-center sm:text-left">
                      Nhập mã 6 chữ số
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="123456"
                      className="w-full h-14 text-center tracking-[12px] font-mono font-bold text-2xl bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all duration-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full h-12 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-semibold rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Đang xác thực...</span>
                      </>
                    ) : (
                      <span>Xác nhận & Kích hoạt tài khoản</span>
                    )}
                  </button>
                </form>

                {/* Đếm ngược gửi lại OTP */}
                <div className="mt-6 text-center text-xs text-slate-500">
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="inline-flex items-center gap-1.5 font-semibold text-teal-600 hover:text-teal-700 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Gửi lại mã OTP mới
                    </button>
                  ) : (
                    <span>Gửi lại mã mới sau <strong className="text-teal-600">{countdown}s</strong></span>
                  )}
                </div>

                
              </div>
            ) : (
              /* TH2: MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ BÌNH THƯỜNG */
              <div>
                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {isLogin ? 'Chào mừng bạn trở lại' : 'Tạo tài khoản mới'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {isLogin 
                      ? 'Nhập thông tin để tiếp tục vào nhật ký sức khỏe' 
                      : 'Bắt đầu hành trình chăm sóc sức khỏe cho gia đình bạn'}
                  </p>
                </div>

                {/* Tab Switcher */}
                <div className="mt-6 p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1 border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => { setIsLogin(true); setErrorMessage(''); setSuccessMessage(''); }}
                    className={`h-10 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                      isLogin 
                        ? 'bg-white text-teal-700 shadow-sm border border-slate-200/50' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsLogin(false); setErrorMessage(''); setSuccessMessage(''); }}
                    className={`h-10 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                      !isLogin 
                        ? 'bg-white text-teal-700 shadow-sm border border-slate-200/50' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Đăng ký
                  </button>
                </div>

                {/* Alert Box */}
                {errorMessage && (
                  <div className="mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {!isLogin && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Họ và tên
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-5 h-5" />
                        </div>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Nguyễn Văn A"
                          className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all duration-200"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Địa chỉ Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Mật khẩu
                      </label>
                      {isLogin && (
                        <a href="#forgot" className="text-xs font-medium text-teal-600 hover:text-teal-700">
                          Quên mật khẩu?
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 pl-11 pr-11 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>

                    {!isLogin && password && (
                      <div className="mt-2.5">
                        <div className="flex gap-1.5 h-1.5">
                          <div className={`flex-1 rounded-full transition-all duration-300 ${
                            pwdStrength >= 1 ? (pwdStrength === 1 ? 'bg-rose-500' : pwdStrength === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'
                          }`} />
                          <div className={`flex-1 rounded-full transition-all duration-300 ${
                            pwdStrength >= 2 ? (pwdStrength === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'
                          }`} />
                          <div className={`flex-1 rounded-full transition-all duration-300 ${
                            pwdStrength >= 3 ? 'bg-emerald-500' : 'bg-slate-200'
                          }`} />
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          {pwdStrength === 1 && 'Mật khẩu yếu (cần tối thiểu 8 ký tự)'}
                          {pwdStrength === 2 && 'Mật khẩu trung bình (thêm số hoặc ký tự đặc biệt)'}
                          {pwdStrength === 3 && 'Mật khẩu mạnh & an toàn'}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 mt-2 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-semibold rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <span>{isLogin ? 'Đăng nhập vào hệ thống' : 'Tiếp tục (Nhận mã OTP)'}</span>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs text-slate-500">
                  {isLogin ? (
                    <>
                      Chưa có tài khoản?{' '}
                      <button
                        type="button"
                        onClick={() => { setIsLogin(false); setErrorMessage(''); }}
                        className="font-semibold text-teal-600 hover:text-teal-700 cursor-pointer"
                      >
                        Đăng ký ngay
                      </button>
                    </>
                  ) : (
                    <>
                      Đã có tài khoản?{' '}
                      <button
                        type="button"
                        onClick={() => { setIsLogin(true); setErrorMessage(''); }}
                        className="font-semibold text-teal-600 hover:text-teal-700 cursor-pointer"
                      >
                        Đăng nhập
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
