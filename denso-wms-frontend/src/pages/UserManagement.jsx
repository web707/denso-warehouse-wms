import { useEffect, useMemo, useState } from 'react';
import { UserRoundCog, ShieldCheck, UserPlus, Loader2, Search } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/access';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const roles = ['warehouse_manager', 'director', 'warehouse_staff', 'user'];
const initial = { email: '', password: '', fullName: '', role: 'warehouse_staff' };
export default function UserManagement() {
  const { user: current } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initial);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    try { setUsers(await api.auth.users()); setError(''); }
    catch (e) { setError(e.message || 'Không tải được người dùng'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const shown = useMemo(() => users.filter((u) => `${u.email} ${u.fullName || ''} ${ROLE_LABELS[u.role] || ''}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.auth.createUser(form);
      setForm(initial);
      await load();
      toast({ title: 'Đã thêm nhân sự', description: 'Tài khoản được tạo với vai trò đã chọn.' });
    } catch (e) { toast({ variant: 'destructive', title: 'Không thêm được', description: e.message }); }
    finally { setSaving(false); }
  };
  const update = async (u, body) => {
    setBusyId(u.id);
    try {
      await api.auth.updateUser(u.id, body);
      await load();
      toast({ title: 'Đã cập nhật phân quyền', description: u.email });
    } catch (e) { toast({ variant: 'destructive', title: 'Không cập nhật được', description: e.message }); }
    finally { setBusyId(''); }
  };
  return <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold flex items-center gap-2"><UserRoundCog className="text-emerald-600"/>Nhân sự &amp; phân quyền</h1><p className="text-sm text-slate-500 mt-1">Quản lý quyền theo vai trò, thực thi tại backend. Chỉ admin được cấp tài khoản và thay đổi quyền.</p></div>
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Bảo vệ bằng JWT</span>
    </header>
    <div className="grid lg:grid-cols-[minmax(290px,360px)_1fr] gap-5 items-start">
      <form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
        <h2 className="text-base font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-emerald-600" />Thêm nhân sự</h2>
        <label className="block text-sm">Họ tên<Input required value={form.fullName} onChange={(e)=>setForm({...form,fullName:e.target.value})} className="mt-1" placeholder="Tên nhân sự" /></label>
        <label className="block text-sm">Email đăng nhập<Input type="email" required value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="mt-1" placeholder="name@company.vn" /></label>
        <label className="block text-sm">Mật khẩu ban đầu<Input type="password" minLength={8} required autoComplete="new-password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} className="mt-1" placeholder="Tối thiểu 8 ký tự" /></label>
        <label className="block text-sm">Vai trò
          <select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})} className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-slate-900">
            {roles.map((r)=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </label>
        <Button disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <UserPlus className="w-4 h-4 mr-2"/>}Thêm tài khoản</Button>
        <div className="rounded-xl bg-slate-50 border p-3 text-xs text-slate-600 leading-relaxed"><ShieldCheck className="w-4 h-4 inline mr-1 text-emerald-600"/> Mật khẩu không hiển thị lại sau khi tạo. Đổi quyền không thể biến nhân viên thành admin.</div>
      </form>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 flex flex-wrap justify-between items-center gap-3 border-b"><h2 className="font-semibold">Danh sách nhân sự <span className="text-slate-400 font-normal">({users.length})</span></h2><div className="relative"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-3"/><Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Tìm tên/email" className="pl-9" /></div></div>
        {error && <p className="m-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-lg">{error}</p>}
        {loading && <p className="p-6 text-sm text-slate-500">Đang tải danh sách...</p>}
        {!loading && <div className="divide-y divide-slate-100">{shown.map((u)=><div key={u.id} className="p-4 grid sm:grid-cols-[1fr_200px_96px] gap-3 items-center">
          <div className="min-w-0"><p className="font-medium truncate">{u.fullName || 'Chưa có tên'} {u.id === current?.id && <span className="text-xs text-emerald-700">(Bạn)</span>}</p><p className="text-xs text-slate-500 truncate">{u.email}</p></div>
          <select aria-label={`Vai trò của ${u.email}`} disabled={busyId === u.id || u.role === 'admin'} value={u.role} onChange={(e)=>update(u,{role:e.target.value})} className="h-9 border rounded-md bg-white text-slate-900 text-sm px-2 disabled:opacity-65"><option value="admin">Quản trị hệ thống</option>{roles.map((r)=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
          <button type="button" disabled={busyId === u.id || u.id === current?.id} onClick={()=>update(u,{isActive:!u.isActive})} className={`rounded-full px-3 py-2 text-xs font-semibold border disabled:opacity-50 ${u.isActive ? 'text-emerald-700 bg-emerald-50 border-emerald-200':'text-rose-700 bg-rose-50 border-rose-200'}`}>{u.isActive ? 'Đang hoạt động' : 'Đã khóa'}</button>
        </div>)}{shown.length===0 && <p className="text-slate-500 text-sm p-6">Không tìm thấy nhân sự.</p>}</div>}
      </div>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm"><h2 className="font-semibold mb-3">Ma trận quyền cơ bản</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[
      ['Admin','Quản lý tài khoản, vai trò, toàn bộ nghiệp vụ'],['Quản lý kho','Xem và thao tác toàn bộ nghiệp vụ kho'],['Giám đốc','Chỉ xem báo cáo, tồn kho và lịch sử'],['Nhân viên kho','Xem và tạo giao dịch nhập/xuất/điều chuyển, ghi nhận QC']].map(([name,desc])=><div key={name} className="rounded-xl bg-slate-50 border p-3"><p className="font-semibold">{name}</p><p className="text-xs text-slate-600 mt-1">{desc}</p></div>)}</div></section>
  </div>;
}
