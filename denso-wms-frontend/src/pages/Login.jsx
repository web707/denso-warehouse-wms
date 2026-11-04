import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Warehouse, Package, Truck, Clock3, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const FEATURES = [
  { icon: Package, label: 'Quản lý SKU, lô hàng và hạn sử dụng' },
  { icon: Warehouse, label: 'Sơ đồ kho 3D và vị trí lưu trữ' },
  { icon: Truck, label: 'Nhập kho, xuất hàng và điều chuyển' },
];

export default function Login() {
  const { signedIn, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (signedIn) return <Navigate to="/" replace />;
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      if (err?.status === 429 || (err?.message && err.message.includes('Too Many Requests'))) {
        setError('Máy chủ Cloud tạm thời giới hạn tần suất do thử nhiều lần. Vui lòng đợi 1-2 phút hoặc khởi động lại dịch vụ.');
      } else {
        setError('Tài khoản hoặc mật khẩu không đúng. Vui lòng thử lại.');
      }
    }
    finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-[#f6f8f7] dark:bg-[#101a28] flex flex-col lg:flex-row text-slate-900">
      <div className="relative isolate min-h-[330px] lg:min-h-screen lg:w-[54%] overflow-hidden bg-[#0a4136] text-white flex flex-col justify-between px-7 py-8 sm:px-12 lg:px-16 lg:py-14">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -right-40 -top-44 h-[580px] w-[580px] rounded-full bg-emerald-400/15 blur-[80px]" />
          <div className="absolute bottom-[-260px] left-[-170px] h-[620px] w-[620px] rounded-full bg-lime-400/10 blur-[90px]" />
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'linear-gradient(90deg, #fff2 1px, transparent 1px), linear-gradient(#fff2 1px, transparent 1px)', backgroundSize: '55px 55px' }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-white/15 border border-white/20"><Warehouse className="h-6 w-6" /></div>
          <div><div className="font-extrabold text-lg tracking-wide">MASAN CONSUMER</div><div className="text-[11px] text-emerald-100/80 tracking-[.15em] uppercase">Warehouse Management System</div></div>
        </div>
        <div className="my-10 lg:my-0 max-w-xl">
          <div className="inline-flex gap-2 items-center rounded-full border border-emerald-200/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-100 mb-6"><Sparkles className="h-3.5 w-3.5" /> SMART DISTRIBUTION CENTER</div>
          <h1 className="text-4xl sm:text-5xl xl:text-[58px] leading-[1.13] font-bold tracking-tight">Quản lý kho hàng<br /><span className="text-[#b8e66e]">thông minh, tập trung.</span></h1>
          <p className="text-emerald-50/75 mt-5 text-sm sm:text-base max-w-lg leading-relaxed">Từ tiếp nhận, kiểm định, lưu trữ đến xuất kho. Một không gian làm việc trực quan dành cho hoạt động phân phối hàng tiêu dùng.</p>
          <div className="hidden lg:grid gap-4 mt-10">
            {FEATURES.map(({ icon: Icon, label }) => <div key={label} className="flex gap-3 items-center text-sm text-emerald-50/90"><span className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/10 border border-white/10"><Icon className="w-4 h-4" /></span>{label}</div>)}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-50/50"><Clock3 className="h-4 w-4" /> Hệ thống điều phối kho & phân phối · Phiên bản WMS 6</div>
      </div>
      <div className="flex-1 min-h-[500px] flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-[410px]">
          <div className="mb-9"><div className="text-xs font-bold tracking-[.2em] uppercase text-[#168161] mb-3">Quản trị kho</div><h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Đăng nhập hệ thống</h2><p className="text-sm text-slate-500 mt-3">Sử dụng tài khoản đã được cấp quyền để tiếp tục.</p></div>
          <form onSubmit={submit} className="space-y-5">
            <label className="block text-sm font-semibold text-slate-700">Tên đăng nhập
              <input autoComplete="username" required name="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập tên đăng nhập" className="mt-2 block h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 transition" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Mật khẩu
              <span className="relative block mt-2"><input autoComplete="current-password" required name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" className="block h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 transition" />
                <button aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} type="button" onClick={() => setShowPassword((x) => !x)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </span>
            </label>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button disabled={busy} type="submit" className="w-full rounded-xl h-12 bg-[#08754f] hover:bg-[#075f42] disabled:opacity-70 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-800/10 transition">{busy ? 'Đang kết nối Cloud...' : <>Đăng nhập <ArrowRight className="h-4 w-4" /></>}</button>
          </form>
          <div className="mt-9 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Phiên đăng nhập được bảo vệ bằng xác thực bảo mật</div>
        </div>
      </div>
    </div>
  );
}
