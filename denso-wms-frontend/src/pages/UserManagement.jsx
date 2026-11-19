import { useEffect, useMemo, useState } from 'react';
import {
  UsersRound, ShieldCheck, UserPlus, Loader2, Search, KeyRound, LogOut,
  Lock, Unlock, Check, X, AlertTriangle, Clock, Building2, Phone, Mail,
  RefreshCw, Eye, EyeOff, Copy, SlidersHorizontal, CheckCircle2, XCircle,
  FileText, Shield, UserCog, AlertCircle, ArrowRightLeft, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/auth';
import {
  ROLE_LABELS,
  ROLE_BADGE_STYLES,
  ENTERPRISE_ROLES,
  PERMISSION_GROUPS,
  ROLE_DEFAULT_PERMISSIONS,
  PERMISSIONS,
  hasPermission
} from '@/lib/access';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const DEPARTMENT_PRESETS = [
  'Kho Vận & Điều Hành (Logistics & Ops)',
  'Nhập Hàng & Lưu Trữ (Inbound & Putaway)',
  'Xuất Hàng & Phân Phối (Outbound & Dispatch)',
  'Kiểm Kê & Quản Lý Tồn (Inventory Control)',
  'Kiểm Định Chất Lượng (Quality Control - QC)',
  'Kế Hoạch & Chuỗi Cung Ứng (Planning & SCM)',
  'Ban Quản Trị Hệ Thống (System Administration)',
];

function generateSecurePassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < len; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' | 'matrix' | 'audit'

  // Data states
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetModalUser, setResetModalUser] = useState(null);
  const [revokeConfirmUser, setRevokeConfirmUser] = useState(null);
  const [inspectPermissionsUser, setInspectPermissionsUser] = useState(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'warehouse_staff',
    department: 'Kho Vận & Điều Hành (Logistics & Ops)',
    phone: '',
    mustChangePassword: true,
    customPermissions: [],
    useCustomPermissions: false,
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    fullName: '',
    role: '',
    department: '',
    phone: '',
    isActive: true,
    permissions: [],
    useCustomPermissions: false,
  });

  // Password reset dialog state
  const [resetOption, setResetOption] = useState('temp_password'); // 'temp_password' | 'token'
  const [tempPasswordVal, setTempPasswordVal] = useState('');
  const [forceChangePwd, setForceChangePwd] = useState(true);
  const [resetResult, setResetResult] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Load user accounts
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.auth.users();
      setUsers(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  // Load audit logs
  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await api.auth.auditLogs({ limit: 60 });
      setAuditLogs(Array.isArray(data) ? data : (data?.items || []));
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  // Derived user statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const locked = total - active;
    const mustChange = users.filter((u) => u.mustChangePassword).length;
    const rolesCount = new Set(users.map((u) => u.role)).size;
    return { total, active, locked, mustChange, rolesCount };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (ROLE_LABELS[u.role] || '').toLowerCase().includes(q);

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'LOCKED' && !u.isActive);
      const matchDept = deptFilter === 'ALL' || u.department === deptFilter;

      return matchSearch && matchRole && matchStatus && matchDept;
    });
  }, [users, search, roleFilter, statusFilter, deptFilter]);

  // Available departments in current list
  const departmentsList = useMemo(() => {
    const set = new Set();
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    DEPARTMENT_PRESETS.forEach((d) => set.add(d));
    return Array.from(set);
  }, [users]);

  // Handlers
  const handleOpenCreate = () => {
    const defaultPwd = generateSecurePassword(12);
    setCreateForm({
      fullName: '',
      email: '',
      password: defaultPwd,
      role: 'warehouse_coordinator',
      department: DEPARTMENT_PRESETS[0],
      phone: '',
      mustChangePassword: true,
      customPermissions: [...(ROLE_DEFAULT_PERMISSIONS['warehouse_coordinator'] || [])],
      useCustomPermissions: false,
    });
    setCreateOpen(true);
  };

  const handleRoleChangeInCreate = (newRole) => {
    const defPerms = ROLE_DEFAULT_PERMISSIONS[newRole] || [];
    setCreateForm((prev) => ({
      ...prev,
      role: newRole,
      customPermissions: prev.useCustomPermissions ? prev.customPermissions : [...defPerms],
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setBusyId('create');
    try {
      const payload = {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        department: createForm.department || undefined,
        phone: createForm.phone || undefined,
        mustChangePassword: createForm.mustChangePassword,
        permissions: createForm.useCustomPermissions ? createForm.customPermissions : undefined,
      };
      await api.auth.createUser(payload);
      toast({
        title: 'Tạo tài khoản thành công',
        description: `Tài khoản ${payload.email} (${ROLE_LABELS[payload.role] || payload.role}) đã được kích hoạt.`,
      });
      setCreateOpen(false);
      await loadUsers();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Tạo tài khoản thất bại',
        description: err.message || 'Lỗi không xác định từ hệ thống.',
      });
    } finally {
      setBusyId('');
    }
  };

  const handleOpenEdit = (targetUser) => {
    setEditUser(targetUser);
    const hasExplicitPerms = Array.isArray(targetUser.permissions) && targetUser.permissions.length > 0;
    const effectivePerms = hasExplicitPerms
      ? [...targetUser.permissions]
      : [...(ROLE_DEFAULT_PERMISSIONS[targetUser.role] || [])];

    setEditForm({
      fullName: targetUser.fullName || '',
      role: targetUser.role || 'viewer',
      department: targetUser.department || '',
      phone: targetUser.phone || '',
      isActive: targetUser.isActive !== false,
      permissions: effectivePerms,
      useCustomPermissions: hasExplicitPerms,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setBusyId(editUser.id);
    try {
      const payload = {
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        department: editForm.department || undefined,
        phone: editForm.phone || undefined,
        isActive: editForm.isActive,
        permissions: editForm.useCustomPermissions ? editForm.permissions : [],
      };
      await api.auth.updateUser(editUser.id, payload);
      toast({
        title: 'Cập nhật thành công',
        description: `Đã lưu thay đổi cho tài khoản ${editUser.email}.`,
      });
      setEditUser(null);
      await loadUsers();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Cập nhật thất bại',
        description: err.message || 'Không thể lưu thay đổi.',
      });
    } finally {
      setBusyId('');
    }
  };

  const handleToggleActive = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      toast({ variant: 'destructive', title: 'Thao tác bị từ chối', description: 'Không thể tự khóa tài khoản của chính mình.' });
      return;
    }
    setBusyId(targetUser.id);
    try {
      const nextActive = !targetUser.isActive;
      await api.auth.updateUser(targetUser.id, { isActive: nextActive });
      toast({
        title: nextActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
        description: `${targetUser.email} hiện ở trạng thái ${nextActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}.`,
      });
      await loadUsers();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Lỗi cập nhật', description: err.message });
    } finally {
      setBusyId('');
    }
  };

  const handleOpenResetModal = (targetUser) => {
    setResetModalUser(targetUser);
    setResetOption('temp_password');
    setTempPasswordVal(generateSecurePassword(12));
    setForceChangePwd(true);
    setResetResult(null);
    setCopiedKey(false);
  };

  const handleExecuteResetPassword = async () => {
    if (!resetModalUser) return;
    setResetting(true);
    try {
      const payload = {
        temporaryPassword: resetOption === 'temp_password' ? tempPasswordVal : undefined,
        mustChangePassword: forceChangePwd,
        useToken: resetOption === 'token',
      };
      const res = await api.auth.resetPassword(resetModalUser.id, payload);
      setResetResult(res);
      toast({
        title: 'Đặt lại mật khẩu thành công',
        description: `Đã thu hồi mọi phiên làm việc cũ của ${resetModalUser.email}.`,
      });
      await loadUsers();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Đặt lại mật khẩu thất bại',
        description: err.message || 'Lỗi máy chủ.',
      });
    } finally {
      setResetting(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!revokeConfirmUser) return;
    setBusyId(revokeConfirmUser.id);
    try {
      const res = await api.auth.revokeSessions(revokeConfirmUser.id);
      toast({
        title: 'Thu hồi phiên thành công',
        description: `Đã đóng ${res.revokedCount || 'tất cả'} phiên hoạt động của ${revokeConfirmUser.email}.`,
      });
      setRevokeConfirmUser(null);
      await loadUsers();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Lỗi thu hồi', description: err.message });
    } finally {
      setBusyId('');
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    toast({ title: 'Đã sao chép vào bộ nhớ đệm' });
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Helper to get effective permissions array for a user
  const getUserPermissions = (targetUser) => {
    if (Array.isArray(targetUser.permissions) && targetUser.permissions.length > 0) {
      return targetUser.permissions;
    }
    const role = (targetUser.role || '').toLowerCase();
    return ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS['viewer'] || [];
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#080F1C] text-[#F8FAFC] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#26374C]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-950/50 border border-emerald-400/40">
              <UsersRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Quản Trị Nhân Sự &amp; Phân Quyền (RBAC 2.0)
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                  Enterprise SoD
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Masan Industrial Command Center — Quản lý 8 vai trò vận hành, 24 quyền hạn vi mô, bảo mật phiên và kiểm toán toàn diện
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={loading}
            className="border-[#26374C] bg-[#111E30] hover:bg-[#17263B] text-[#94A3B8] hover:text-white text-xs h-9"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Làm mới
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-9 shadow-md shadow-emerald-950/30 border border-emerald-500/40"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Thêm nhân sự mới
          </Button>
        </div>
      </header>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Total Users */}
        <div className="bg-[#111E30] rounded-xl p-4 border border-[#26374C] relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#94A3B8]">Tổng số nhân sự</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UsersRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats.total}</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {stats.active} hoạt động
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Được phân quyền vào hệ thống WMS</p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Stat 2: Locked Accounts */}
        <div className="bg-[#111E30] rounded-xl p-4 border border-[#26374C] relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#94A3B8]">Tài khoản khóa / Yêu cầu đổi mật khẩu</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats.locked}</span>
            <span className="text-xs text-amber-400 font-medium">
              {stats.mustChange} cần đổi MK
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Khóa do admin hoặc chưa kích hoạt lại</p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Stat 3: Role Structure */}
        <div className="bg-[#111E30] rounded-xl p-4 border border-[#26374C] relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#94A3B8]">Cấu trúc vai trò vận hành</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">8</span>
            <span className="text-xs text-cyan-400 font-medium">Vai trò doanh nghiệp</span>
          </div>
          <p className="mt-1 text-[11px] text-[#94A3B8]">24 quyền hạn vi mô được cấu hình</p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Stat 4: Security Standard */}
        <div className="bg-[#111E30] rounded-xl p-4 border border-[#26374C] relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#94A3B8]">Tiêu chuẩn bảo mật (Security)</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">Bcrypt</span>
            <span className="text-xs text-teal-400 font-medium">Work factor 10</span>
          </div>
          <p className="mt-1 text-[11px] text-[#94A3B8]">0 plaintext · 0 hash leak · SoD Active</p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[#26374C] gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={cn(
            'pb-3 border-b-2 flex items-center gap-2 transition-colors',
            activeTab === 'accounts'
              ? 'border-emerald-400 text-emerald-400 font-semibold'
              : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
          )}
        >
          <UsersRound className="w-4 h-4" />
          <span>Danh sách nhân sự ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={cn(
            'pb-3 border-b-2 flex items-center gap-2 transition-colors',
            activeTab === 'matrix'
              ? 'border-emerald-400 text-emerald-400 font-semibold'
              : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Ma trận phân quyền (RBAC Matrix)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={cn(
            'pb-3 border-b-2 flex items-center gap-2 transition-colors',
            activeTab === 'audit'
              ? 'border-emerald-400 text-emerald-400 font-semibold'
              : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
          )}
        >
          <FileText className="w-4 h-4" />
          <span>Nhật ký bảo mật &amp; Kiểm toán (Audit)</span>
        </button>
      </div>

      {/* ===================== TAB 1: ACCOUNTS LIST ===================== */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-[#111E30] p-4 rounded-xl border border-[#26374C] flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm theo tên, email, phòng ban, SĐT..."
                  className="pl-9 h-9 bg-[#0C1625] border-[#26374C] text-[#F8FAFC] placeholder:text-[#94A3B8]/60 text-xs focus-visible:ring-emerald-500"
                />
              </div>

              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#26374C] bg-[#0C1625] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Tất cả vai trò</option>
                {ENTERPRISE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#26374C] bg-[#0C1625] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="LOCKED">Đã khóa</option>
              </select>

              {/* Department filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#26374C] bg-[#0C1625] px-3 text-xs text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Tất cả phòng ban</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-[#94A3B8] font-medium">
              Hiển thị <span className="text-white font-bold">{filteredUsers.length}</span> / {users.length} nhân sự
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-[#111E30] rounded-xl border border-[#26374C] overflow-hidden shadow-sm">
            {error && (
              <div className="m-4 p-3 bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="p-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Đang tải danh sách tài khoản nhân sự từ hệ thống...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-[#94A3B8] text-sm space-y-2">
                <UsersRound className="w-10 h-10 mx-auto text-[#26374C]" />
                <p>Không tìm thấy nhân sự nào phù hợp với bộ lọc hiện tại.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#26374C] bg-[#0C1625]/80 text-[#94A3B8] font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Nhân sự</th>
                      <th className="py-3 px-4">Phòng ban</th>
                      <th className="py-3 px-4">Vai trò doanh nghiệp</th>
                      <th className="py-3 px-4">Quyền hạn vi mô</th>
                      <th className="py-3 px-4">Đăng nhập cuối</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#26374C]/60">
                    {filteredUsers.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      const roleStyle = ROLE_BADGE_STYLES[u.role] || ROLE_BADGE_STYLES['viewer'];
                      const effectivePerms = getUserPermissions(u);
                      const hasCustom = Array.isArray(u.permissions) && u.permissions.length > 0;

                      return (
                        <tr key={u.id} className="hover:bg-[#17263B]/50 transition-colors">
                          {/* Personnel Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 shrink-0">
                                {(u.fullName || u.email || 'U').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-white truncate">
                                    {u.fullName || 'Chưa cập nhật họ tên'}
                                  </p>
                                  {isSelf && (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 rounded">
                                      Bạn
                                    </span>
                                  )}
                                  {u.mustChangePassword && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded" title="Bắt buộc đổi mật khẩu">
                                      Đổi MK
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] truncate">
                                  <span>{u.email}</span>
                                  {u.phone && <span>· {u.phone}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#17263B] text-[#CBD5E1] border border-[#26374C] truncate max-w-[180px]">
                              {u.department || 'Kho Vận & Logistics'}
                            </span>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span className={cn('inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border', roleStyle)}>
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          </td>

                          {/* Permissions */}
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => setInspectPermissionsUser(u)}
                              className="group flex items-center gap-1.5 text-[11px] text-[#94A3B8] hover:text-emerald-400 transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                              <span className="underline decoration-dotted underline-offset-2">
                                {effectivePerms.length} quyền
                              </span>
                              {hasCustom && (
                                <span className="text-[9px] px-1 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold">
                                  Tùy chỉnh
                                </span>
                              )}
                            </button>
                          </td>

                          {/* Last Login */}
                          <td className="py-3.5 px-4 text-[#94A3B8] text-[11px]">
                            {u.lastLoginAt ? (
                              <div className="space-y-0.5">
                                <p className="text-white font-medium">
                                  {new Date(u.lastLoginAt).toLocaleDateString('vi-VN')}
                                </p>
                                <p className="text-[10px] text-[#94A3B8]">
                                  {new Date(u.lastLoginAt).toLocaleTimeString('vi-VN')}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Chưa đăng nhập</span>
                            )}
                          </td>

                          {/* Status Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={busyId === u.id || isSelf}
                              onClick={() => handleToggleActive(u)}
                              title={isSelf ? 'Không thể khóa tài khoản chính mình' : (u.isActive ? 'Bấm để khóa tài khoản' : 'Bấm để mở khóa')}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all disabled:opacity-50',
                                u.isActive
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                              )}
                            >
                              {u.isActive ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Hoạt động</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>Đã khóa</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(u)}
                                title="Chỉnh sửa tài khoản & phân quyền"
                                className="h-7 w-7 p-0 text-[#94A3B8] hover:text-white hover:bg-[#17263B]"
                              >
                                <UserCog className="w-3.5 h-3.5" />
                              </Button>

                              {/* Reset Password Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenResetModal(u)}
                                title="Đặt lại mật khẩu an toàn"
                                className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </Button>

                              {/* Revoke Sessions Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevokeConfirmUser(u)}
                                title="Thu hồi tất cả phiên làm việc"
                                className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 2: RBAC MATRIX ===================== */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* SoD Highlight Callouts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#111E30] border border-amber-500/30 flex gap-3.5 items-start">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Segregation of Duties (SoD) — Kiểm Kê Kho
                </h4>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  Nhân viên kiểm toán kho (<span className="text-amber-300 font-semibold">INVENTORY_AUDITOR</span>) chỉ được thực hiện đếm và ghi nhận sai lệch (<code className="text-amber-400">inventory.count</code>). Thẩm quyền duyệt điều chỉnh tồn kho (<code className="text-amber-400">inventory.adjust.approve</code>) bắt buộc thuộc về Quản lý kho (<span className="text-emerald-300 font-semibold">WAREHOUSE_MANAGER</span>) hoặc Super Admin.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#111E30] border border-cyan-500/30 flex gap-3.5 items-start">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Phân Quyền Kiểm Định Độc Lập (QC Gatekeeper)
                </h4>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  Nhân viên Nhập/Xuất kho không có quyền giải phóng hàng QC. Chỉ kiểm định viên (<span className="text-purple-300 font-semibold">QC_INSPECTOR</span>) mới có quyền phán quyết Đạt chuẩn (<code className="text-cyan-400">qc.release</code>) hoặc Khóa cách ly (<code className="text-rose-400">qc.block</code>).
                </p>
              </div>
            </div>
          </div>

          {/* Full Role Matrix Table */}
          <div className="bg-[#111E30] rounded-xl border border-[#26374C] overflow-hidden">
            <div className="p-4 bg-[#0C1625] border-b border-[#26374C] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Ma Trận 8 Vai Trò Doanh Nghiệp &amp; 24 Quyền Hạn Vi Mô</h3>
                <p className="text-xs text-[#94A3B8]">Kiểm tra và thực thi quyền Authoritative tại Backend NestJS MasanAccessGuard</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#26374C] bg-[#0C1625]/90 text-[#94A3B8]">
                    <th className="py-3 px-4 min-w-[240px]">Danh mục &amp; Quyền hạn</th>
                    {ENTERPRISE_ROLES.map((r) => (
                      <th key={r} className="py-3 px-2 text-center min-w-[105px]">
                        <span className={cn('block px-1.5 py-0.5 rounded text-[10px] font-bold border truncate', ROLE_BADGE_STYLES[r])}>
                          {ROLE_LABELS[r] ? ROLE_LABELS[r].split(' ')[0] : r}
                        </span>
                        <span className="text-[9px] text-[#94A3B8] block truncate font-normal mt-0.5">
                          {r.replace('_', ' ')}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#26374C]/50">
                  {PERMISSION_GROUPS.map((grp) => (
                    <>
                      {/* Group Header Row */}
                      <tr key={grp.name} className="bg-[#0C1625]/60 text-emerald-400 font-semibold border-t border-[#26374C]">
                        <td colSpan={ENTERPRISE_ROLES.length + 1} className="py-2.5 px-4 text-xs tracking-wide">
                          <span className="text-emerald-300 uppercase font-bold mr-2">{grp.name}</span>
                          <span className="text-[#94A3B8] font-normal text-[11px]">— {grp.description}</span>
                        </td>
                      </tr>

                      {/* Permissions in this group */}
                      {grp.permissions.map((p) => (
                        <tr key={p.code} className="hover:bg-[#17263B]/40 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-white">{p.label}</div>
                            <div className="text-[10px] text-[#94A3B8] font-mono">{p.code}</div>
                          </td>
                          {ENTERPRISE_ROLES.map((role) => {
                            const defaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
                            const isAllowed = defaults.includes(p.code);
                            return (
                              <td key={role} className="py-2.5 px-2 text-center">
                                {isAllowed ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                    <Check className="w-3 h-3" />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#17263B] text-slate-600">
                                    -
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: AUDIT LOGS ===================== */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-[#111E30] p-4 rounded-xl border border-[#26374C] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Nhật Ký Bảo Mật &amp; Kiểm Toán (user_security_events)
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Lưu vết toàn bộ thao tác đăng nhập, đổi mật khẩu, phân quyền và thu hồi phiên làm việc
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAuditLogs}
              disabled={loadingLogs}
              className="border-[#26374C] bg-[#0C1625] hover:bg-[#17263B] text-[#94A3B8] text-xs h-8"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loadingLogs && 'animate-spin')} />
              Tải lại log
            </Button>
          </div>

          <div className="bg-[#111E30] rounded-xl border border-[#26374C] overflow-hidden">
            {loadingLogs ? (
              <div className="p-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Đang tải dữ liệu kiểm toán bảo mật...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center text-[#94A3B8] text-sm">
                Chưa có sự kiện bảo mật nào được ghi nhận.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#26374C] bg-[#0C1625]/80 text-[#94A3B8] font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Thời gian</th>
                      <th className="py-3 px-4">Loại sự kiện</th>
                      <th className="py-3 px-4">Người thực hiện</th>
                      <th className="py-3 px-4">Mục tiêu tác động</th>
                      <th className="py-3 px-4">Địa chỉ IP &amp; Client</th>
                      <th className="py-3 px-4">Chi tiết ghi nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#26374C]/50">
                    {auditLogs.map((ev) => (
                      <tr key={ev.id} className="hover:bg-[#17263B]/40 transition-colors">
                        <td className="py-3 px-4 text-[#CBD5E1] whitespace-nowrap">
                          {new Date(ev.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border',
                              ev.eventType?.includes('FAIL') || ev.eventType?.includes('LOCK')
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : ev.eventType?.includes('RESET') || ev.eventType?.includes('REVOKE')
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            )}
                          >
                            {ev.eventType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          {ev.actorEmail || 'Hệ thống'}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {ev.targetEmail || '—'}
                        </td>
                        <td className="py-3 px-4 text-[#94A3B8] font-mono text-[11px]">
                          {ev.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="py-3 px-4 text-[#CBD5E1] max-w-xs truncate" title={JSON.stringify(ev.details || {})}>
                          {ev.details ? JSON.stringify(ev.details) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== MODAL: THÊM NHÂN SỰ ===================== */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111E30] border border-[#26374C] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#26374C] flex items-center justify-between bg-[#0C1625]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Thêm Nhân Sự &amp; Cấp Tài Khoản Mới</h3>
                  <p className="text-xs text-[#94A3B8]">Khởi tạo thông tin nhân viên, vai trò vận hành và mật khẩu khởi tạo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-[#94A3B8] hover:text-white p-1 rounded-lg hover:bg-[#17263B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Họ và tên *</label>
                  <Input
                    required
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="bg-[#0C1625] border-[#26374C] text-white text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Email công vụ (Username) *</label>
                  <Input
                    required
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="staff.name@masan.local"
                    className="bg-[#0C1625] border-[#26374C] text-white text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Phòng ban / Bộ phận</label>
                  <select
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    className="w-full h-9 rounded-md border border-[#26374C] bg-[#0C1625] px-3 text-xs text-white"
                  >
                    {DEPARTMENT_PRESETS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Số điện thoại liên hệ</label>
                  <Input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="0912 345 678"
                    className="bg-[#0C1625] border-[#26374C] text-white text-xs h-9"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#CBD5E1]">Vai trò doanh nghiệp (Enterprise Role) *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => handleRoleChangeInCreate(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#26374C] bg-[#0C1625] px-3 text-xs text-white"
                >
                  {ENTERPRISE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]} ({r})
                    </option>
                  ))}
                </select>
              </div>

              {/* Initial Password */}
              <div className="space-y-1.5 p-3 rounded-xl bg-[#0C1625] border border-[#26374C]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Mật khẩu khởi tạo ban đầu</label>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, password: generateSecurePassword(12) })}
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Sinh mật khẩu ngẫu nhiên
                  </button>
                </div>
                <div className="relative mt-1">
                  <Input
                    required
                    minLength={8}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="bg-[#111E30] border-[#26374C] text-emerald-400 font-mono text-xs h-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyText(createForm.password)}
                    className="absolute right-2.5 top-2.5 text-[#94A3B8] hover:text-white"
                    title="Sao chép mật khẩu"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-[#CBD5E1]">
                  <input
                    type="checkbox"
                    checked={createForm.mustChangePassword}
                    onChange={(e) => setCreateForm({ ...createForm, mustChangePassword: e.target.checked })}
                    className="rounded border-[#26374C] bg-[#111E30] text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Yêu cầu nhân viên đổi mật khẩu ngay ở lần đăng nhập đầu tiên (Khuyến nghị)</span>
                </label>
              </div>

              {/* Custom Permissions toggle */}
              <div className="space-y-3 pt-2 border-t border-[#26374C]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                    <input
                      type="checkbox"
                      checked={createForm.useCustomPermissions}
                      onChange={(e) => setCreateForm({ ...createForm, useCustomPermissions: e.target.checked })}
                      className="rounded border-[#26374C] bg-[#0C1625] text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Tùy chỉnh danh mục quyền hạn đặc thù (Ghi đè mặc định vai trò)</span>
                  </label>

                  {createForm.useCustomPermissions && (
                    <button
                      type="button"
                      onClick={() =>
                        setCreateForm((p) => ({
                          ...p,
                          customPermissions: [...(ROLE_DEFAULT_PERMISSIONS[p.role] || [])],
                        }))
                      }
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      Dùng quyền mặc định của vai trò
                    </button>
                  )}
                </div>

                {createForm.useCustomPermissions && (
                  <div className="space-y-3 bg-[#0C1625] p-3 rounded-xl border border-[#26374C] max-h-60 overflow-y-auto">
                    {PERMISSION_GROUPS.map((grp) => (
                      <div key={grp.name} className="space-y-1.5">
                        <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                          {grp.name}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {grp.permissions.map((p) => {
                            const checked = createForm.customPermissions.includes(p.code);
                            return (
                              <label
                                key={p.code}
                                className={cn(
                                  'flex items-start gap-2 p-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors',
                                  checked
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                    : 'bg-[#111E30] border-[#26374C] text-[#94A3B8]'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...createForm.customPermissions, p.code]
                                      : createForm.customPermissions.filter((c) => c !== p.code);
                                    setCreateForm({ ...createForm, customPermissions: next });
                                  }}
                                  className="mt-0.5 rounded border-[#26374C] bg-[#0C1625] text-emerald-500 focus:ring-emerald-500"
                                />
                                <div>
                                  <p className="font-medium leading-tight">{p.label}</p>
                                  <p className="text-[9px] text-[#94A3B8] font-mono">{p.code}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#26374C] flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  className="border-[#26374C] text-[#94A3B8] hover:text-white"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={busyId === 'create'}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {busyId === 'create' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang khởi tạo...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Tạo tài khoản
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: SỬA NHÂN SỰ & PHÂN QUYỀN ===================== */}
      {editUser && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111E30] border border-[#26374C] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#26374C] flex items-center justify-between bg-[#0C1625]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Chỉnh Sửa Tài Khoản &amp; Phân Quyền</h3>
                  <p className="text-xs text-[#94A3B8]">Cập nhật vai trò, phòng ban và thẩm quyền cho {editUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="text-[#94A3B8] hover:text-white p-1 rounded-lg hover:bg-[#17263B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Họ và tên</label>
                  <Input
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="bg-[#0C1625] border-[#26374C] text-white text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Email đăng nhập (Không đổi)</label>
                  <Input
                    disabled
                    value={editUser.email}
                    className="bg-[#0C1625]/60 border-[#26374C] text-[#94A3B8] text-xs h-9 opacity-80"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Phòng ban / Bộ phận</label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full h-9 rounded-md border border-[#26374C] bg-[#0C1625] px-3 text-xs text-white"
                  >
                    {departmentsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">Số điện thoại</label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="0912 345 678"
                    className="bg-[#0C1625] border-[#26374C] text-white text-xs h-9"
                  />
                </div>
              </div>

              {/* Role selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#CBD5E1]">Vai trò doanh nghiệp</label>
                <select
                  disabled={editUser.role === 'admin' && editUser.id === currentUser?.id}
                  value={editForm.role}
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    const defs = ROLE_DEFAULT_PERMISSIONS[nextRole] || [];
                    setEditForm((prev) => ({
                      ...prev,
                      role: nextRole,
                      permissions: prev.useCustomPermissions ? prev.permissions : [...defs],
                    }));
                  }}
                  className="w-full h-10 rounded-md border border-[#26374C] bg-[#0C1625] px-3 text-xs text-white"
                >
                  <option value="admin">Quản trị viên hệ thống (Admin)</option>
                  {ENTERPRISE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]} ({r})
                    </option>
                  ))}
                </select>
              </div>

              {/* Active status */}
              <div className="p-3 rounded-xl bg-[#0C1625] border border-[#26374C] flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Trạng thái kích hoạt tài khoản</p>
                  <p className="text-[11px] text-[#94A3B8]">Khi tắt, người dùng sẽ bị từ chối đăng nhập ngay lập tức</p>
                </div>
                <button
                  type="button"
                  disabled={editUser.id === currentUser?.id}
                  onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    editForm.isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  )}
                >
                  {editForm.isActive ? 'Đang kích hoạt' : 'Đã khóa'}
                </button>
              </div>

              {/* Custom Permissions */}
              <div className="space-y-3 pt-2 border-t border-[#26374C]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                    <input
                      type="checkbox"
                      checked={editForm.useCustomPermissions}
                      onChange={(e) => setEditForm({ ...editForm, useCustomPermissions: e.target.checked })}
                      className="rounded border-[#26374C] bg-[#0C1625] text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Tùy chỉnh danh mục quyền hạn đặc thù (Ghi đè mặc định vai trò)</span>
                  </label>

                  {editForm.useCustomPermissions && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((p) => ({
                          ...p,
                          permissions: [...(ROLE_DEFAULT_PERMISSIONS[p.role] || [])],
                        }))
                      }
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      Dùng quyền mặc định của vai trò
                    </button>
                  )}
                </div>

                {editForm.useCustomPermissions && (
                  <div className="space-y-3 bg-[#0C1625] p-3 rounded-xl border border-[#26374C] max-h-60 overflow-y-auto">
                    {PERMISSION_GROUPS.map((grp) => (
                      <div key={grp.name} className="space-y-1.5">
                        <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                          {grp.name}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {grp.permissions.map((p) => {
                            const checked = editForm.permissions.includes(p.code);
                            return (
                              <label
                                key={p.code}
                                className={cn(
                                  'flex items-start gap-2 p-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors',
                                  checked
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                    : 'bg-[#111E30] border-[#26374C] text-[#94A3B8]'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...editForm.permissions, p.code]
                                      : editForm.permissions.filter((c) => c !== p.code);
                                    setEditForm({ ...editForm, permissions: next });
                                  }}
                                  className="mt-0.5 rounded border-[#26374C] bg-[#0C1625] text-emerald-500 focus:ring-emerald-500"
                                />
                                <div>
                                  <p className="font-medium leading-tight">{p.label}</p>
                                  <p className="text-[9px] text-[#94A3B8] font-mono">{p.code}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#26374C] flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditUser(null)}
                  className="border-[#26374C] text-[#94A3B8] hover:text-white"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={busyId === editUser.id}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {busyId === editUser.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    'Lưu thay đổi'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ĐẶT LẠI MẬT KHẨU (RESET PASSWORD) ===================== */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111E30] border border-[#26374C] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#26374C] flex items-center justify-between bg-[#0C1625]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Đặt Lại Mật Khẩu An Toàn</h3>
                  <p className="text-xs text-[#94A3B8]">Cấp lại quyền truy cập cho {resetModalUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="text-[#94A3B8] hover:text-white p-1 rounded-lg hover:bg-[#17263B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!resetResult ? (
                <>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Cảnh báo thu hồi phiên làm việc:</p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        Thao tác đặt lại mật khẩu sẽ ngay lập tức vô hiệu hóa mọi phiên đăng nhập (Active Sessions) đang mở của người dùng này trên mọi thiết bị.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#CBD5E1]">Chọn phương thức đặt lại:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={cn(
                          'p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-1',
                          resetOption === 'temp_password'
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                            : 'bg-[#0C1625] border-[#26374C] text-[#94A3B8]'
                        )}
                      >
                        <input
                          type="radio"
                          name="resetOpt"
                          checked={resetOption === 'temp_password'}
                          onChange={() => setResetOption('temp_password')}
                          className="sr-only"
                        />
                        <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5" /> Mật khẩu tạm thời
                        </div>
                        <p className="text-[11px] text-[#94A3B8]">Sinh mật khẩu ngẫu nhiên để bàn giao cho nhân sự</p>
                      </label>

                      <label
                        className={cn(
                          'p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-1',
                          resetOption === 'token'
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                            : 'bg-[#0C1625] border-[#26374C] text-[#94A3B8]'
                        )}
                      >
                        <input
                          type="radio"
                          name="resetOpt"
                          checked={resetOption === 'token'}
                          onChange={() => setResetOption('token')}
                          className="sr-only"
                        />
                        <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Reset Token (1 giờ)
                        </div>
                        <p className="text-[11px] text-[#94A3B8]">Tạo token bí mật có thời hạn 60 phút</p>
                      </label>
                    </div>
                  </div>

                  {resetOption === 'temp_password' && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-[#0C1625] border border-[#26374C]">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[#CBD5E1]">Mật khẩu tạm thời dự kiến</label>
                        <button
                          type="button"
                          onClick={() => setTempPasswordVal(generateSecurePassword(12))}
                          className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Đổi mật khẩu khác
                        </button>
                      </div>
                      <Input
                        value={tempPasswordVal}
                        onChange={(e) => setTempPasswordVal(e.target.value)}
                        className="bg-[#111E30] border-[#26374C] text-emerald-400 font-mono text-xs h-9"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#CBD5E1]">
                    <input
                      type="checkbox"
                      checked={forceChangePwd}
                      onChange={(e) => setForceChangePwd(e.target.checked)}
                      className="rounded border-[#26374C] bg-[#0C1625] text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Bắt buộc nhân sự phải đổi mật khẩu ở lần đăng nhập tiếp theo</span>
                  </label>

                  <div className="pt-4 border-t border-[#26374C] flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setResetModalUser(null)}
                      className="border-[#26374C] text-[#94A3B8] hover:text-white"
                    >
                      Hủy bỏ
                    </Button>
                    <Button
                      type="button"
                      disabled={resetting}
                      onClick={handleExecuteResetPassword}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-medium"
                    >
                      {resetting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Đang xử lý...
                        </>
                      ) : (
                        'Xác nhận đặt lại mật khẩu'
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                /* Success View with Copiable Credentials */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-white">Đã đặt lại mật khẩu thành công!</p>
                      <p className="text-[11px] text-emerald-300/80 mt-0.5">
                        Mọi phiên làm việc cũ đã được thu hồi. Hãy cung cấp thông tin bên dưới cho nhân viên.
                      </p>
                    </div>
                  </div>

                  {resetResult.temporaryPassword && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-[#0C1625] border border-[#26374C]">
                      <label className="text-xs font-semibold text-[#CBD5E1]">Mật khẩu tạm thời (Hiển thị 1 lần duy nhất):</label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 p-2 rounded-lg bg-[#111E30] border border-[#26374C] text-emerald-400 font-mono text-sm font-bold tracking-wider select-all">
                          {resetResult.temporaryPassword}
                        </code>
                        <Button
                          type="button"
                          onClick={() => handleCopyText(resetResult.temporaryPassword)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                        >
                          {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span className="ml-1.5 text-xs">{copiedKey ? 'Đã sao chép' : 'Sao chép'}</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {resetResult.resetToken && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-[#0C1625] border border-[#26374C]">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[#CBD5E1]">Reset Token bảo mật (1 giờ):</label>
                        <span className="text-[10px] text-amber-400">Hiệu lực đến {new Date(resetResult.expiresAt).toLocaleTimeString('vi-VN')}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 p-2 rounded-lg bg-[#111E30] border border-[#26374C] text-cyan-400 font-mono text-xs truncate select-all">
                          {resetResult.resetToken}
                        </code>
                        <Button
                          type="button"
                          onClick={() => handleCopyText(resetResult.resetToken)}
                          className="bg-cyan-600 hover:bg-cyan-500 text-white shrink-0"
                        >
                          {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span className="ml-1.5 text-xs">{copiedKey ? 'Đã sao chép' : 'Sao chép'}</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[#26374C] flex justify-end">
                    <Button
                      type="button"
                      onClick={() => setResetModalUser(null)}
                      className="bg-slate-700 hover:bg-slate-600 text-white"
                    >
                      Đóng cửa sổ
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: THU HỒI PHIÊN (REVOKE SESSIONS) ===================== */}
      {revokeConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111E30] border border-[#26374C] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Thu Hồi Toàn Bộ Phiên Làm Việc</h3>
                <p className="text-xs text-[#94A3B8]">{revokeConfirmUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              Bạn có chắc chắn muốn ngắt kết nối và đăng xuất tài khoản này khỏi tất cả các trình duyệt và thiết bị di động đang truy cập? Phiên làm việc hiện tại sẽ bị hủy hiệu lực ngay lập tức.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevokeConfirmUser(null)}
                className="border-[#26374C] text-[#94A3B8] hover:text-white"
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                disabled={busyId === revokeConfirmUser.id}
                onClick={handleRevokeSessions}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                {busyId === revokeConfirmUser.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Thu hồi phiên ngay'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: XEM CHI TIẾT QUYỀN HẠN ===================== */}
      {inspectPermissionsUser && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111E30] border border-[#26374C] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#26374C] flex items-center justify-between bg-[#0C1625]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Quyền Hạn Của {inspectPermissionsUser.fullName || inspectPermissionsUser.email}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold border', ROLE_BADGE_STYLES[inspectPermissionsUser.role])}>
                      {ROLE_LABELS[inspectPermissionsUser.role] || inspectPermissionsUser.role}
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      {getUserPermissions(inspectPermissionsUser).length} / 24 quyền kích hoạt
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectPermissionsUser(null)}
                className="text-[#94A3B8] hover:text-white p-1 rounded-lg hover:bg-[#17263B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {PERMISSION_GROUPS.map((grp) => {
                const effective = getUserPermissions(inspectPermissionsUser);
                const hasAny = grp.permissions.some((p) => effective.includes(p.code));
                return (
                  <div key={grp.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        {grp.name}
                      </p>
                      <span className="text-[10px] text-[#94A3B8]">
                        {grp.permissions.filter((p) => effective.includes(p.code)).length} / {grp.permissions.length}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {grp.permissions.map((p) => {
                        const active = effective.includes(p.code);
                        return (
                          <div
                            key={p.code}
                            className={cn(
                              'p-2 rounded-lg border flex items-center justify-between text-xs',
                              active
                                ? 'bg-[#0C1625] border-emerald-500/30 text-white'
                                : 'bg-[#0C1625]/40 border-[#26374C]/40 text-slate-500'
                            )}
                          >
                            <div>
                              <p className="font-medium">{p.label}</p>
                              <p className="text-[10px] text-[#94A3B8] font-mono">{p.code}</p>
                            </div>
                            {active ? (
                              <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Cho phép
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">Từ chối</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-[#26374C] flex justify-end bg-[#0C1625]">
              <Button
                type="button"
                onClick={() => setInspectPermissionsUser(null)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
