import { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Warehouse,
  Clock3,
  Loader2,
  Lock,
  User,
  Activity,
  Boxes,
  Sparkles,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { isDemoMode } from '@/lib/environment';
import { useAuth } from '@/lib/auth';
import MiniWarehouseDigitalTwin from '@/components/MiniWarehouseDigitalTwin';

export default function Login() {
  const { signedIn, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Pre-warm backend and DNS while user is on the login page
  useEffect(() => {
    try {
      const apiBase = isDemoMode ? '/api' : import.meta.env.VITE_API_BASE_URL || '/api';
      fetch(`${apiBase}/health`, { method: 'GET', keepalive: true }).catch(() => {});
    } catch {}
  }, []);

  if (signedIn) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || '/', { replace: true });
    } catch {
      setError('Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen bg-[#080F1C] text-[#F8FAFC] flex flex-col lg:flex-row antialiased selection:bg-[#10B981] selection:text-slate-950 font-sans overflow-x-hidden w-full max-w-[100vw]">
      {/* =========================================================================
          LEFT PANEL — 52% DESKTOP (Mini Warehouse 3D Digital Twin Centerpiece)
          ========================================================================= */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative isolate lg:w-[52%] xl:w-[50%] bg-[#0C1625] border-b lg:border-b-0 lg:border-r border-[#26374C] flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 lg:px-10 lg:py-7 xl:px-14 xl:py-8 overflow-hidden w-full min-h-0"
      >
        {/* Subtle Ambient Radial Glows Strictly Confined */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#10B981]/10 blur-[80px]" />
          <div className="absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-[#2DD4BF]/10 blur-[90px]" />
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #F8FAFC 1px, transparent 1px), linear-gradient(#F8FAFC 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        {/* 1. Top Header: Logo & Branding */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-[#111E30] border border-[#10B981]/50 shadow-lg shadow-emerald-950/30 text-[#10B981]">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <div className="font-extrabold text-sm sm:text-base tracking-wide text-[#F8FAFC] flex items-center gap-2">
              MASAN CONSUMER WMS
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[10px] font-mono font-semibold text-[#10B981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                ENTERPRISE
              </span>
            </div>
            <div className="text-[10px] text-[#94A3B8] tracking-[0.2em] uppercase font-mono">
              Trung tâm Điều hành Kho vận
            </div>
          </div>
        </div>

        {/* 2. Main Center Content: Hero, 3D Digital Twin, Compact Feature Highlights */}
        <div className="my-auto py-3 sm:py-4 lg:py-2 max-w-xl w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#26374C] bg-[#111E30]/90 px-3.5 py-1 text-xs font-semibold text-[#2DD4BF] mb-2.5 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#10B981]" />
            SMART WAREHOUSE OPERATIONS
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl lg:text-[28px] xl:text-[34px] font-extrabold tracking-tight text-[#F8FAFC] leading-[1.25]">
            Vận hành kho thông minh.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] via-[#2DD4BF] to-[#38BDF8]">
              Kiểm soát toàn diện.
            </span>
          </h1>

          {/* Concise Description */}
          <p className="text-[#94A3B8] mt-2 text-xs sm:text-sm leading-relaxed max-w-lg">
            Nền tảng quản lý kho vận FMCG tập trung — kiểm soát tồn kho theo thời gian thực, tự động cấp phát FEFO và chuẩn hóa luồng xuất nhập hàng.
          </p>

          {/* 3D Mini Warehouse Digital Twin (Interactive Three.js Canvas) */}
          <div className="my-3 p-3 sm:p-3.5 rounded-2xl border border-[#26374C]/80 bg-[#111E30]/60 backdrop-blur-sm shadow-inner">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] border-b border-[#26374C]/50 pb-2 mb-2 font-mono">
              <span className="flex items-center gap-2 text-[#10B981] font-semibold">
                <Layers className="w-4 h-4 text-[#10B981]" />
                MÔ HÌNH KHÔNG GIAN KHO SỐ HÓA
              </span>
              <span className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                ZONE-A · GIÁM SÁT SỨC CHỨA THỰC ĐỊA
              </span>
            </div>

            {/* 3D Three.js Container */}
            <div className="w-full h-[195px] sm:h-[215px] lg:h-[225px] xl:h-[245px] rounded-xl overflow-hidden relative">
              <MiniWarehouseDigitalTwin />
            </div>
          </div>

          {/* Compact Feature Highlights (Single Row: Icon + Label only) */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111E30] border border-[#26374C] text-xs font-medium text-[#F8FAFC] shadow-sm hover:border-[#10B981]/50 transition-colors">
              <Boxes className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Kiểm soát tồn kho</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111E30] border border-[#26374C] text-xs font-medium text-[#F8FAFC] shadow-sm hover:border-[#2DD4BF]/50 transition-colors">
              <Clock3 className="w-3.5 h-3.5 text-[#2DD4BF]" />
              <span>Xuất kho FEFO</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111E30] border border-[#26374C] text-xs font-medium text-[#F8FAFC] shadow-sm hover:border-[#38BDF8]/50 transition-colors">
              <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Điều hành vận hành</span>
            </div>
          </div>
        </div>

        {/* 3. Small Footer */}
        <div className="flex items-center justify-between text-xs text-[#94A3B8]/80 font-mono pt-3 border-t border-[#26374C]/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>Masan Consumer WMS · Enterprise Core</span>
          </div>
          <span className="hidden sm:inline">Hệ thống Điều phối Vận hành</span>
        </div>
      </motion.div>

      {/* =========================================================================
          RIGHT PANEL — 48% DESKTOP (Login card width 460px, centered in viewport)
          ========================================================================= */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-8 xl:p-12 bg-[#080F1C] relative overflow-hidden w-full min-h-0">
        {/* Subtle background ambient ring confined to container */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[460px] h-[380px] sm:h-[460px] rounded-full bg-[#10B981]/5 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="w-full max-w-[460px] rounded-2xl border border-[#26374C] bg-[#111E30] p-7 sm:p-8 lg:p-8 xl:p-9 shadow-2xl relative backdrop-blur-xl"
        >
          {/* QA Lab Notice if in demo mode */}
          {isDemoMode && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <b>MÔI TRƯỜNG QA LAB</b> · Kết nối CSDL kiểm định độc lập.
              </span>
            </div>
          )}

          {/* Form Header */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-1 text-[10px] font-mono font-bold tracking-wider uppercase text-[#10B981] mb-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              CỔNG XÁC THỰC TẬP TRUNG
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC]">
              Chào mừng trở lại
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
              Đăng nhập để truy cập trung tâm điều hành và quản trị kho Masan Consumer.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {/* Username / Email Input (Height 50px, High Contrast) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-username" className="text-xs font-semibold text-[#F8FAFC]">
                  Tài khoản hoặc Email
                </label>
                <span className="text-[11px] text-[#94A3B8] font-mono">Bắt buộc</span>
              </div>
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#10B981] transition-colors pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="login-username"
                  autoComplete="username"
                  required
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin@masan.local hoặc mã NV"
                  className="block h-[50px] w-full rounded-xl border border-[#26374C] bg-[#17263B] pl-10 pr-3.5 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] outline-none transition-all duration-200 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/30 hover:border-[#38516d]"
                />
              </div>
            </div>

            {/* Password Input with Show/Hide Toggle (Height 50px, High Contrast) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-xs font-semibold text-[#F8FAFC]">
                  Mật khẩu
                </label>
                <span className="text-[11px] text-[#94A3B8] font-mono">Tối thiểu 6 ký tự</span>
              </div>
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#10B981] transition-colors pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="login-password"
                  autoComplete="current-password"
                  required
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block h-[50px] w-full rounded-xl border border-[#26374C] bg-[#17263B] pl-10 pr-12 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] outline-none transition-all duration-200 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/30 hover:border-[#38516d]"
                />
                <button
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  type="button"
                  tabIndex={0}
                  onClick={() => setShowPassword((x) => !x)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#26374C]/60 rounded-lg p-2 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Animated Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.2 }}
                  role="alert"
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2.5 leading-relaxed shadow-sm"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button (Height 50px) */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={busy}
              type="submit"
              className="w-full rounded-xl h-[50px] bg-[#10B981] hover:bg-[#0ea572] active:bg-[#059669] disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 transition-all duration-150 cursor-pointer mt-4"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Đang xác thực thông tin...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập hệ thống</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Security & Token Info */}
          <div className="mt-6 pt-4 border-t border-[#26374C]/50 flex items-center justify-center gap-2 text-xs text-[#94A3B8]">
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            <span>Bảo mật phiên làm việc chuẩn RBAC & JWT</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
