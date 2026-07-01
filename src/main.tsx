import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Gauge,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Plus,
  RefreshCcw,
  Save,
  Play,
  Trash2
} from 'lucide-react';
import './styles.css';

type Language = 'zh-CN' | 'zh-TW' | 'en';
type Tab = 'dashboard' | 'keys' | 'plans' | 'logs';

type Plan = {
  id: string;
  name: string;
  description: string;
  fiveHourTokenLimit: number;
  weeklyTokenLimit: number;
  priceCents: number;
  currency: string;
  isActive: number;
};

type QuotaSnapshot = {
  fiveHourUsed: number;
  fiveHourLimit: number;
  weeklyUsed: number;
  weeklyLimit: number;
  remainingFiveHour: number;
  remainingWeekly: number;
  fiveHourResetAt: string;
  weeklyResetAt: string;
};

type ApiKey = {
  id: string;
  name: string;
  keyPreview: string;
  planId: string;
  planName: string;
  status: 'active' | 'paused' | 'revoked';
  ownerEmail: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  usage: QuotaSnapshot;
  todayUsageCents: number;
};

type KeySecret = {
  key: string;
  keyPreview: string;
  ccSwitch: {
    codex: string;
    claude: string;
  };
};

type UsageLog = {
  id: string;
  apiKeyId: string | null;
  model: string;
  path: string;
  method: string;
  statusCode: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalTokens: number;
  inputCostCents: number;
  outputCostCents: number;
  cacheCreationCostCents: number;
  cacheReadCostCents: number;
  totalCostCents: number;
  latencyMs: number;
  errorMessage: string | null;
  requestId: string;
  createdAt: string;
};

type Summary = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalCostCents: number;
  requests: number;
  fiveHourTokens: number;
  weeklyTokens: number;
  fiveHourCostCents: number;
  weeklyCostCents: number;
  todayTokens: number;
  todayCostCents: number;
  todayRequests: number;
  accountBalanceCents: number;
  errors: number;
  activeKeys: number;
  series: Array<{ bucket: string; tokens: number; requests: number }>;
};

type Bootstrap = {
  summary: Summary;
  plans: Plan[];
  keys: ApiKey[];
  logs: UsageLog[];
};

const dictionary = {
  'zh-CN': {
    brand: 'Claude Code 中转站',
    subtitle: 'API 密钥、Token 用量、日志与双滚动套餐管理',
    dashboard: '总览',
    keys: '密钥',
    plans: '套餐',
    logs: '日志',
    activeKeys: '活跃密钥',
    requests: '请求数',
    fiveHour: '5 小时滚动',
    weekly: '7 天滚动',
    fiveHourQuota: '5 小时额度',
    weeklyQuota: '每周额度',
    nextReset: '下次重置',
    currentPlan: '当前套餐',
    changePlan: '更换套餐',
    balance: '剩余余额',
    recharge: '充值',
    todayUsage: '今日用量',
    todayRequests: '今日请求',
    planIncluded: '套餐内额度',
    extraBalance: '非套餐内余额',
    tokenUsage: 'Token 用量',
    costUsage: '用量',
    used: '已用',
    remaining: '剩余',
    averageCost: '单次均摊',
    adminOnly: '仅管理员可创建套餐',
    cost: '消耗',
    success: '成功',
    failed: '失败',
    allStatuses: '全部状态',
    successOnly: '仅成功',
    failedOnly: '仅失败',
    requestTime: '请求时间',
    fromTime: '开始时间',
    toTime: '结束时间',
    cacheCreation: '创建缓存',
    cacheHit: '命中缓存',
    failureReason: '失败描述',
    expand: '展开',
    collapse: '收起',
    input: '输入',
    output: '输出',
    total: '总计',
    errors: '错误',
    status: '状态',
    model: '模型',
    latency: '延迟',
    keyName: '密钥名称',
    keyValue: '密钥',
    createdAt: '创建时间',
    action: '操作',
    use: '使用',
    delete: '删除',
    createApiKey: '创建 API 密钥',
    createApiKeyDescription: '给密钥起一个描述性名称，便于日后识别。请勿随意分享给他人或在第三方网站使用，防止泄露。',
    importToCcSwitch: '导入到 CC-Switch',
    selectAgent: '选择 Agent',
    confirmImport: '确认导入',
    cancel: '取消',
    copiedSecret: '密钥已复制',
    deleteConfirm: '确认删除这个密钥？',
    useWithCodex: '导入 Codex',
    useWithClaude: '导入 Claude Code',
    keyUnavailable: '完整密钥不可用，请重新创建密钥。',
    owner: '负责人邮箱',
    plan: '套餐',
    createKey: '创建密钥',
    createdKey: '新密钥',
    copy: '复制',
    copied: '已复制',
    pause: '暂停',
    resume: '启用',
    revoke: '吊销',
    savePlan: '保存套餐',
    newPlan: '新套餐',
    planName: '套餐名称',
    description: '描述',
    fiveHourLimit: '5 小时额度',
    weeklyLimit: '每周额度',
    price: '价格',
    currency: '币种',
    refresh: '刷新',
    search: '搜索日志',
    lastUsed: '最后使用',
    never: '未使用',
    noData: '暂无数据',
    adminToken: '管理员 Token',
    unlock: '连接管理台',
    localMode: '本地开发模式',
    proxyEndpoint: '中转端点',
    planGuard: '双滚动限制',
    quotaHint: '任一窗口耗尽都会拦截请求',
    upstreamMissing: '上游 Key 未配置',
    upstreamReady: '上游已配置'
  },
  'zh-TW': {
    brand: 'Claude Code 中轉站',
    subtitle: 'API 金鑰、Token 用量、日誌與雙滾動套餐管理',
    dashboard: '總覽',
    keys: '金鑰',
    plans: '套餐',
    logs: '日誌',
    activeKeys: '活躍金鑰',
    requests: '請求數',
    fiveHour: '5 小時滾動',
    weekly: '7 天滾動',
    fiveHourQuota: '5 小時額度',
    weeklyQuota: '每週額度',
    nextReset: '下次重置',
    currentPlan: '目前套餐',
    changePlan: '更換套餐',
    balance: '剩餘餘額',
    recharge: '儲值',
    todayUsage: '今日用量',
    todayRequests: '今日請求',
    planIncluded: '套餐內額度',
    extraBalance: '非套餐內餘額',
    tokenUsage: 'Token 用量',
    costUsage: '用量',
    used: '已用',
    remaining: '剩餘',
    averageCost: '單次均攤',
    adminOnly: '僅管理員可建立套餐',
    cost: '消耗',
    success: '成功',
    failed: '失敗',
    allStatuses: '全部狀態',
    successOnly: '僅成功',
    failedOnly: '僅失敗',
    requestTime: '請求時間',
    fromTime: '開始時間',
    toTime: '結束時間',
    cacheCreation: '建立快取',
    cacheHit: '命中快取',
    failureReason: '失敗描述',
    expand: '展開',
    collapse: '收起',
    input: '輸入',
    output: '輸出',
    total: '總計',
    errors: '錯誤',
    status: '狀態',
    model: '模型',
    latency: '延遲',
    keyName: '金鑰名稱',
    keyValue: '金鑰',
    createdAt: '建立時間',
    action: '操作',
    use: '使用',
    delete: '刪除',
    createApiKey: '建立 API 金鑰',
    createApiKeyDescription: '給金鑰起一個描述性名稱，便於日後識別。請勿隨意分享給他人或在第三方網站使用，防止洩露。',
    importToCcSwitch: '匯入到 CC-Switch',
    selectAgent: '選擇 Agent',
    confirmImport: '確認匯入',
    cancel: '取消',
    copiedSecret: '金鑰已複製',
    deleteConfirm: '確認刪除這個金鑰？',
    useWithCodex: '匯入 Codex',
    useWithClaude: '匯入 Claude Code',
    keyUnavailable: '完整金鑰不可用，請重新建立金鑰。',
    owner: '負責人信箱',
    plan: '套餐',
    createKey: '建立金鑰',
    createdKey: '新金鑰',
    copy: '複製',
    copied: '已複製',
    pause: '暫停',
    resume: '啟用',
    revoke: '吊銷',
    savePlan: '儲存套餐',
    newPlan: '新套餐',
    planName: '套餐名稱',
    description: '描述',
    fiveHourLimit: '5 小時額度',
    weeklyLimit: '每週額度',
    price: '價格',
    currency: '幣種',
    refresh: '重新整理',
    search: '搜尋日誌',
    lastUsed: '最後使用',
    never: '未使用',
    noData: '暫無資料',
    adminToken: '管理員 Token',
    unlock: '連接管理台',
    localMode: '本機開發模式',
    proxyEndpoint: '中轉端點',
    planGuard: '雙滾動限制',
    quotaHint: '任一視窗耗盡都會攔截請求',
    upstreamMissing: '上游 Key 未設定',
    upstreamReady: '上游已設定'
  },
  en: {
    brand: 'Claude Code Transfer Station',
    subtitle: 'API keys, token usage, logs, and dual rolling quota plans',
    dashboard: 'Dashboard',
    keys: 'Keys',
    plans: 'Plans',
    logs: 'Logs',
    activeKeys: 'Active keys',
    requests: 'Requests',
    fiveHour: '5-hour rolling',
    weekly: '7-day rolling',
    fiveHourQuota: '5-hour quota',
    weeklyQuota: 'Weekly quota',
    nextReset: 'Next reset',
    currentPlan: 'Current plan',
    changePlan: 'Change plan',
    balance: 'Remaining balance',
    recharge: 'Recharge',
    todayUsage: 'Today usage',
    todayRequests: 'Today requests',
    planIncluded: 'Included quota',
    extraBalance: 'Extra balance',
    tokenUsage: 'Token usage',
    costUsage: 'Usage',
    used: 'Used',
    remaining: 'Remaining',
    averageCost: 'Average cost',
    adminOnly: 'Admins only can create plans',
    cost: 'Cost',
    success: 'Success',
    failed: 'Failed',
    allStatuses: 'All statuses',
    successOnly: 'Success only',
    failedOnly: 'Failed only',
    requestTime: 'Request time',
    fromTime: 'From',
    toTime: 'To',
    cacheCreation: 'Cache creation',
    cacheHit: 'Cache hit',
    failureReason: 'Failure reason',
    expand: 'Expand',
    collapse: 'Collapse',
    input: 'Input',
    output: 'Output',
    total: 'Total',
    errors: 'Errors',
    status: 'Status',
    model: 'Model',
    latency: 'Latency',
    keyName: 'Key name',
    keyValue: 'Key',
    createdAt: 'Created',
    action: 'Actions',
    use: 'Use',
    delete: 'Delete',
    createApiKey: 'Create API key',
    createApiKeyDescription: 'Give your key a descriptive name so you can identify it later. Do not share it with others or use it on third-party websites to prevent leaks.',
    importToCcSwitch: 'Import to CC-Switch',
    selectAgent: 'Select Agent',
    confirmImport: 'Confirm import',
    cancel: 'Cancel',
    copiedSecret: 'Key copied',
    deleteConfirm: 'Delete this key?',
    useWithCodex: 'Import Codex',
    useWithClaude: 'Import Claude Code',
    keyUnavailable: 'Full key is unavailable. Create a new key.',
    owner: 'Owner email',
    plan: 'Plan',
    createKey: 'Create key',
    createdKey: 'New key',
    copy: 'Copy',
    copied: 'Copied',
    pause: 'Pause',
    resume: 'Resume',
    revoke: 'Revoke',
    savePlan: 'Save plan',
    newPlan: 'New plan',
    planName: 'Plan name',
    description: 'Description',
    fiveHourLimit: '5-hour limit',
    weeklyLimit: 'Weekly limit',
    price: 'Price',
    currency: 'Currency',
    refresh: 'Refresh',
    search: 'Search logs',
    lastUsed: 'Last used',
    never: 'Never',
    noData: 'No data',
    adminToken: 'Admin token',
    unlock: 'Connect admin',
    localMode: 'Local development mode',
    proxyEndpoint: 'Proxy endpoint',
    planGuard: 'Dual rolling limits',
    quotaHint: 'Requests are blocked when either window is exhausted',
    upstreamMissing: 'Upstream key missing',
    upstreamReady: 'Upstream configured'
  }
} satisfies Record<Language, Record<string, string>>;

const defaultSummary: Summary = {
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  totalCostCents: 0,
  requests: 0,
  fiveHourTokens: 0,
  weeklyTokens: 0,
  fiveHourCostCents: 0,
  weeklyCostCents: 0,
  todayTokens: 0,
  todayCostCents: 0,
  todayRequests: 0,
  accountBalanceCents: 0,
  errors: 0,
  activeKeys: 0,
  series: []
};

function App() {
  const [language, setLanguage] = React.useState<Language>('zh-CN');
  const [activeTab, setActiveTab] = React.useState<Tab>('dashboard');
  const [adminToken, setAdminToken] = React.useState(localStorage.getItem('adminToken') || '');
  const [data, setData] = React.useState<Bootstrap>({ summary: defaultSummary, plans: [], keys: [], logs: [] });
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState('');
  const t = dictionary[language];

  const headers = React.useMemo(() => {
    const value: HeadersInit = { 'content-type': 'application/json' };
    if (adminToken) value['x-admin-token'] = adminToken;
    return value;
  }, [adminToken]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const bootstrapRes = await fetch('/api/bootstrap', { headers });
      if (bootstrapRes.status === 401) {
        setNotice('Admin token required.');
        setLoading(false);
        return;
      }
      const bootstrap = (await bootstrapRes.json()) as Bootstrap;
      setData(bootstrap);
      setNotice('');
      localStorage.setItem('adminToken', adminToken);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }, [adminToken, headers]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const nav = [
    { id: 'dashboard' as const, label: t.dashboard, icon: LayoutDashboard },
    { id: 'keys' as const, label: t.keys, icon: KeyRound },
    { id: 'plans' as const, label: t.plans, icon: CreditCard },
    { id: 'logs' as const, label: t.logs, icon: Activity }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">CC</div>
          <div>
            <h1>{t.brand}</h1>
            <p>{t.subtitle}</p>
          </div>
        </div>
        <nav className="nav-list">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={activeTab === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="proxy-box">
          <span>{t.proxyEndpoint}</span>
          <strong>/v1/messages</strong>
          <code>{window.location.origin.replace('5173', '8787')}</code>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div />
          <div className="topbar-actions">
            <div className="admin-token">
              <input
                aria-label={t.adminToken}
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder={t.localMode}
                type="password"
              />
              <button type="button" className="icon-button" onClick={() => void load()} title={t.unlock}>
                <Check size={16} />
              </button>
            </div>
            <LanguageMenu language={language} setLanguage={setLanguage} />
            <button type="button" className="icon-button" onClick={() => void load()} title={t.refresh}>
              <RefreshCcw size={17} />
            </button>
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}
        {loading ? <div className="loading-line" /> : null}

        {activeTab === 'dashboard' ? <Dashboard data={data} t={t} /> : null}
        {activeTab === 'keys' ? <KeysPanel data={data} headers={headers} reload={load} t={t} /> : null}
        {activeTab === 'plans' ? <PlansPanel plans={data.plans} headers={headers} reload={load} t={t} /> : null}
        {activeTab === 'logs' ? <LogsPanel logs={data.logs} t={t} /> : null}
      </main>
    </div>
  );
}

function LanguageMenu(props: { language: Language; setLanguage: (language: Language) => void }) {
  return (
    <div className="select-shell">
      <Globe2 size={16} />
      <select value={props.language} onChange={(event) => props.setLanguage(event.target.value as Language)}>
        <option value="zh-CN">简体中文</option>
        <option value="zh-TW">繁體中文</option>
        <option value="en">English</option>
      </select>
      <ChevronDown size={14} />
    </div>
  );
}

function Dashboard({ data, t }: { data: Bootstrap; t: Record<string, string> }) {
  const primaryKey = data.keys.find((key) => key.status === 'active') || data.keys[0];
  const currentPlan =
    data.plans.find((plan) => plan.id === primaryKey?.planId) ||
    data.plans.find((plan) => plan.isActive) ||
    data.plans[0];
  const quota = primaryKey?.usage;
  const balance = currency(data.summary.accountBalanceCents, currentPlan?.currency || 'USD');
  const todayAverage = data.summary.todayRequests
    ? Math.round(data.summary.todayCostCents / data.summary.todayRequests)
    : 0;
  const currencyCode = currentPlan?.currency || 'USD';

  return (
    <section className="content-grid">
      <section className="overview-hero">
        <article className="plan-summary">
          <span>{t.currentPlan}</span>
          <div>
            <h2>{currentPlan?.name || '-'}</h2>
            <button type="button" className="secondary-button">
              <CreditCard size={16} />
              {t.changePlan}
            </button>
          </div>
          <p>{currentPlan?.description || t.noData}</p>
          <div className="plan-limit-pair">
            <span>
              {t.fiveHourLimit}: <strong>{currency(currentPlan?.fiveHourTokenLimit || 0, currencyCode)}</strong>
            </span>
            <span>
              {t.weeklyLimit}: <strong>{currency(currentPlan?.weeklyTokenLimit || 0, currencyCode)}</strong>
            </span>
          </div>
        </article>

        <article className="balance-summary">
          <span>{t.balance}</span>
          <strong>{balance}</strong>
          <p>{t.extraBalance}</p>
          <button type="button" className="primary-button">
            <Plus size={17} />
            {t.recharge}
          </button>
        </article>
      </section>

      <div className="metric-grid overview-metrics">
        <article className="metric-tile teal">
          <Activity size={20} />
          <span>{t.todayUsage}</span>
          <strong>{currency(data.summary.todayCostCents, currencyCode)}</strong>
        </article>
        <article className="metric-tile blue">
          <BarChart3 size={20} />
          <span>{t.todayRequests}</span>
          <strong>{compact(data.summary.todayRequests)}</strong>
        </article>
        <article className="metric-tile amber">
          <Gauge size={20} />
          <span>{t.averageCost}</span>
          <strong>{currency(todayAverage, currencyCode)}</strong>
        </article>
      </div>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>{t.tokenUsage}</h2>
            <p>{t.quotaHint}</p>
          </div>
        </div>
        {quota ? <QuotaUsagePanel quota={quota} t={t} /> : <Empty t={t} />}
      </section>
    </section>
  );
}

function QuotaUsagePanel({ quota, t }: { quota: QuotaSnapshot; t: Record<string, string> }) {
  const rows = [
    {
      label: t.fiveHourQuota,
      used: quota.fiveHourUsed,
      limit: quota.fiveHourLimit,
      remaining: quota.remainingFiveHour,
      resetAt: quota.fiveHourResetAt
    },
    {
      label: t.weeklyQuota,
      used: quota.weeklyUsed,
      limit: quota.weeklyLimit,
      remaining: quota.remainingWeekly,
      resetAt: quota.weeklyResetAt
    }
  ];

  return (
    <div className="quota-overview-list">
      {rows.map((row) => {
        const value = pct(row.used, row.limit);
        return (
          <article className="quota-overview-row" key={row.label}>
            <div className="quota-overview-head">
              <div>
                <strong>{row.label}</strong>
                <span>
                  {currency(row.used, 'USD')} / {currency(row.limit, 'USD')}
                </span>
              </div>
              <strong>{currency(row.remaining, 'USD')}</strong>
            </div>
            <div className="bar-track">
              <div style={{ width: `${Math.min(value, 100)}%`, background: usageColor(value) }} />
            </div>
            <div className="quota-overview-foot">
              <span>{Math.round(value)}%</span>
              <span>
                {t.remaining}: {currency(row.remaining, 'USD')} · {t.nextReset}: {fullDate(row.resetAt)}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function KeysPanel({
  data,
  headers,
  reload,
  t
}: {
  data: Bootstrap;
  headers: HeadersInit;
  reload: () => Promise<void>;
  t: Record<string, string>;
}) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [useTarget, setUseTarget] = React.useState<ApiKey | null>(null);
  const [selectedAgent, setSelectedAgent] = React.useState<'claude' | 'codex'>('claude');
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [name, setName] = React.useState('');
  const [copiedId, setCopiedId] = React.useState('');
  const [notice, setNotice] = React.useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name })
    });
    const payload = await response.json();
    if (response.ok) {
      setIsCreateOpen(false);
      setName('');
      await reload();
    } else {
      setNotice(payload.error || t.keyUnavailable);
    }
  }

  async function fetchSecret(id: string): Promise<KeySecret | null> {
    const response = await fetch(`/api/keys/${id}/secret`, { headers });
    const payload = await response.json();
    if (!response.ok) {
      setNotice(payload.error || t.keyUnavailable);
      return null;
    }
    setNotice('');
    return payload as KeySecret;
  }

  async function revoke(apiKey: ApiKey) {
    setIsRevoking(true);
    const response = await fetch(`/api/keys/${apiKey.id}`, { method: 'DELETE', headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(payload.error || t.keyUnavailable);
      setIsRevoking(false);
      return;
    }
    setNotice('');
    setRevokeTarget(null);
    await reload();
    setIsRevoking(false);
  }

  async function copyExistingKey(apiKey: ApiKey) {
    const secret = await fetchSecret(apiKey.id);
    if (!secret) return;
    await navigator.clipboard.writeText(secret.key);
    setCopiedId(apiKey.id);
    window.setTimeout(() => setCopiedId(''), 1400);
  }

  async function useWithCcSwitch(apiKey: ApiKey, app: 'codex' | 'claude') {
    const secret = await fetchSecret(apiKey.id);
    if (!secret) return;
    window.location.href = secret.ccSwitch[app];
    setUseTarget(null);
  }

  return (
    <section className="content-grid">
      <section className="table-panel">
        <div className="section-heading">
          <h2>{t.keys}</h2>
          <button type="button" className="primary-button" onClick={() => setIsCreateOpen(true)}>
            <Plus size={17} />
            {t.createKey}
          </button>
        </div>
        {notice ? <div className="notice inline">{notice}</div> : null}
        <KeyRows
          keys={data.keys}
          t={t}
          copiedId={copiedId}
          onCopy={copyExistingKey}
          onUse={(apiKey) => {
            setUseTarget(apiKey);
            setSelectedAgent('claude');
          }}
          onRevoke={setRevokeTarget}
        />
      </section>

      {isCreateOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submit}>
            <div className="section-heading">
              <div>
                <h2>{t.createApiKey}</h2>
                <p>{t.createApiKeyDescription}</p>
              </div>
            </div>
            <label>
              {t.keyName}
              <input value={name} onChange={(event) => setName(event.target.value)} autoFocus required />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setName('');
                }}
              >
                {t.cancel}
              </button>
              <button type="submit" className="primary-button">
                <Plus size={17} />
                {t.createKey}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {useTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel">
            <div className="section-heading">
              <div>
                <h2>{t.importToCcSwitch}</h2>
                <p>{useTarget.name || useTarget.keyPreview || '-'}</p>
              </div>
            </div>
            <div className="agent-options" role="radiogroup" aria-label={t.selectAgent}>
              <button
                type="button"
                className={selectedAgent === 'claude' ? 'agent-option active' : 'agent-option'}
                onClick={() => setSelectedAgent('claude')}
              >
                Claude Code
              </button>
              <button
                type="button"
                className={selectedAgent === 'codex' ? 'agent-option active' : 'agent-option'}
                onClick={() => setSelectedAgent('codex')}
              >
                Codex
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setUseTarget(null)}>
                {t.cancel}
              </button>
              <button type="button" className="primary-button" onClick={() => useWithCcSwitch(useTarget, selectedAgent)}>
                <Play size={16} />
                {t.confirmImport}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revokeTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel modal-panel-danger" role="dialog" aria-modal="true" aria-labelledby="delete-key-title">
            <div className="section-heading">
              <div>
                <h2 id="delete-key-title">{t.deleteConfirm}</h2>
                <p>{revokeTarget.name || revokeTarget.keyPreview || '-'}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setRevokeTarget(null)}
                disabled={isRevoking}
              >
                {t.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => revoke(revokeTarget)} disabled={isRevoking}>
                <Trash2 size={16} />
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function KeyRows({
  keys,
  t,
  copiedId,
  onCopy,
  onUse,
  onRevoke
}: {
  keys: ApiKey[];
  t: Record<string, string>;
  copiedId: string;
  onCopy: (apiKey: ApiKey) => Promise<void>;
  onUse: (apiKey: ApiKey) => void;
  onRevoke?: (apiKey: ApiKey) => void;
}) {
  if (!keys.length) return <Empty t={t} />;

  return (
    <div className="key-table">
      <div className="key-table-head">
        <span>{t.keyName}</span>
        <span>{t.keyValue}</span>
        <span>{t.createdAt}</span>
        <span>{t.lastUsed}</span>
        <span>{t.todayUsage}</span>
        <span>{t.action}</span>
      </div>
      {keys.map((apiKey) => (
        <article className="key-table-row" key={apiKey.id}>
          <div className="key-main">
            <div>
              <strong>{apiKey.name || '-'}</strong>
            </div>
          </div>
          <div className="key-secret-cell">
            <code>{apiKey.keyPreview || '-'}</code>
            <button type="button" className="icon-button compact" onClick={() => onCopy(apiKey)} title={t.copy}>
              {copiedId === apiKey.id ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <span>{apiKey.createdAt ? fullDate(apiKey.createdAt) : '-'}</span>
          <span>{apiKey.lastUsedAt ? fullDate(apiKey.lastUsedAt) : '-'}</span>
          <span>{currency(apiKey.todayUsageCents, 'USD')}</span>
          <div className="row-actions">
            <button type="button" className="secondary-button" onClick={() => onUse(apiKey)}>
              <Play size={15} />
              {t.use}
            </button>
            <button type="button" className="icon-button danger" onClick={() => onRevoke?.(apiKey)} title={t.delete}>
              <Trash2 size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function QuotaMeters({ quota }: { quota: QuotaSnapshot }) {
  const fiveHourPct = pct(quota.fiveHourUsed, quota.fiveHourLimit);
  const weeklyPct = pct(quota.weeklyUsed, quota.weeklyLimit);
  return (
    <div className="quota-pair">
      <Meter label="5h" value={fiveHourPct} used={quota.fiveHourUsed} limit={quota.fiveHourLimit} />
      <Meter label="7d" value={weeklyPct} used={quota.weeklyUsed} limit={quota.weeklyLimit} />
    </div>
  );
}

function Meter({ label, value, used, limit }: { label: string; value: number; used: number; limit: number }) {
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <strong>{Math.round(value)}%</strong>
      </div>
      <div className="meter-track">
        <div style={{ width: `${Math.min(value, 100)}%`, background: usageColor(value) }} />
      </div>
      <small>
        {currency(used, 'USD')} / {currency(limit, 'USD')}
      </small>
    </div>
  );
}

function PlansPanel({
  plans,
  headers,
  reload,
  t
}: {
  plans: Plan[];
  headers: HeadersInit;
  reload: () => Promise<void>;
  t: Record<string, string>;
}) {
  const [draft, setDraft] = React.useState({
    name: '',
    fiveHourLimitDollars: 49,
    weeklyLimitDollars: 380
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    await fetch('/api/plans', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: draft.name,
        description: '',
        fiveHourTokenLimit: dollarsToCents(draft.fiveHourLimitDollars),
        weeklyTokenLimit: dollarsToCents(draft.weeklyLimitDollars),
        priceCents: 0,
        currency: 'USD',
        isActive: true
      })
    });
    setDraft({
      name: '',
      fiveHourLimitDollars: 49,
      weeklyLimitDollars: 380
    });
    await reload();
  }

  return (
    <section className="content-grid">
      <form className="form-panel" onSubmit={save}>
        <div className="section-heading">
          <div>
            <h2>{t.newPlan}</h2>
            <p>{t.adminOnly}</p>
          </div>
        </div>
        <div className="form-row plan-form-row">
          <label>
            {t.planName}
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
          </label>
          <label>
            {t.fiveHourLimit}
            <input
              value={draft.fiveHourLimitDollars}
              onChange={(event) => setDraft({ ...draft, fiveHourLimitDollars: Number(event.target.value) })}
              type="number"
              min="0.01"
              step="0.01"
            />
          </label>
          <label>
            {t.weeklyLimit}
            <input
              value={draft.weeklyLimitDollars}
              onChange={(event) => setDraft({ ...draft, weeklyLimitDollars: Number(event.target.value) })}
              type="number"
              min="0.01"
              step="0.01"
            />
          </label>
          <button type="submit" className="primary-button">
            <Save size={17} />
            {t.savePlan}
          </button>
        </div>
      </form>

      <div className="plan-grid">
        {plans.map((plan) => (
          <article className="plan-card" key={plan.id}>
            <div>
              <span className="plan-price">{plan.isActive ? t.status : '-'}</span>
              <h2>{plan.name}</h2>
              <p>{plan.description || t.adminOnly}</p>
            </div>
            <div className="plan-limits">
              <Meter label="5h" value={100} used={plan.fiveHourTokenLimit} limit={plan.fiveHourTokenLimit} />
              <Meter label="7d" value={100} used={plan.weeklyTokenLimit} limit={plan.weeklyTokenLimit} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LogsPanel({ logs, t }: { logs: UsageLog[]; t: Record<string, string> }) {
  const [status, setStatus] = React.useState<'all' | 'success' | 'failed'>('all');
  const [fromTime, setFromTime] = React.useState('');
  const [toTime, setToTime] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const filtered = logs.filter((log) => {
    const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
    if (status === 'success' && !isSuccess) return false;
    if (status === 'failed' && isSuccess) return false;

    const createdAt = new Date(log.createdAt).getTime();
    if (fromTime && createdAt < new Date(fromTime).getTime()) return false;
    if (toTime && createdAt > new Date(toTime).getTime()) return false;
    return true;
  });

  return (
    <section className="content-grid">
      <div className="log-filters">
        <label>
          {t.status}
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">{t.allStatuses}</option>
            <option value="success">{t.successOnly}</option>
            <option value="failed">{t.failedOnly}</option>
          </select>
        </label>
        <label>
          {t.fromTime}
          <input value={fromTime} onChange={(event) => setFromTime(event.target.value)} type="datetime-local" />
        </label>
        <label>
          {t.toTime}
          <input value={toTime} onChange={(event) => setToTime(event.target.value)} type="datetime-local" />
        </label>
      </div>
      <section className="table-panel">
        <LogRows logs={filtered} t={t} expandedId={expandedId} setExpandedId={setExpandedId} />
      </section>
    </section>
  );
}

function LogRows({
  logs,
  t,
  compactMode,
  expandedId,
  setExpandedId
}: {
  logs: UsageLog[];
  t: Record<string, string>;
  compactMode?: boolean;
  expandedId?: string | null;
  setExpandedId?: (id: string | null) => void;
}) {
  if (!logs.length) return <Empty t={t} />;

  return (
    <div className="log-list">
      {logs.map((log) => {
        const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
        const isExpanded = expandedId === log.id;
        const toggle = () => setExpandedId?.(isExpanded ? null : log.id);

        return (
          <article className="log-record" key={log.id}>
            <button type="button" className="log-summary" onClick={toggle} aria-expanded={isExpanded}>
              <div>
                <strong>{log.model}</strong>
              </div>
              <span className="log-cost">{currency(log.totalCostCents, 'USD')}</span>
              <span className={isSuccess ? 'status-code ok' : 'status-code error'}>{isSuccess ? t.success : t.failed}</span>
              <span>{fullDate(log.createdAt)}</span>
              <span>{log.latencyMs}ms</span>
              {!compactMode ? <ChevronDown className={isExpanded ? 'chevron open' : 'chevron'} size={16} /> : null}
            </button>

            {isExpanded && !compactMode ? (
              <div className="log-detail">
                {isSuccess ? (
                  <div className="cost-breakdown">
                    <BreakdownItem label={t.input} tokens={log.inputTokens} cents={log.inputCostCents} />
                    <BreakdownItem label={t.output} tokens={log.outputTokens} cents={log.outputCostCents} />
                    <BreakdownItem
                      label={t.cacheCreation}
                      tokens={log.cacheCreationInputTokens}
                      cents={log.cacheCreationCostCents}
                    />
                    <BreakdownItem label={t.cacheHit} tokens={log.cacheReadInputTokens} cents={log.cacheReadCostCents} />
                  </div>
                ) : (
                  <div className="failure-detail">
                    <span>{t.failureReason}</span>
                    <strong>{log.errorMessage || '-'}</strong>
                  </div>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function BreakdownItem({ label, tokens, cents }: { label: string; tokens: number; cents: number }) {
  return (
    <div className="breakdown-item">
      <span>{label}</span>
      <strong>{tokenK(tokens)}</strong>
      <em>{currency(cents, 'USD')}</em>
    </div>
  );
}

function Empty({ t }: { t: Record<string, string> }) {
  return <div className="empty-state">{t.noData}</div>;
}

function compact(value: number) {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function currency(cents: number, currencyCode: string) {
  void currencyCode;
  const value = Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format((cents || 0) / 100);
  return `$${value}`;
}

function dollarsToCents(value: number) {
  return Math.max(1, Math.round((value || 0) * 100));
}

function tokenK(value: number) {
  const amount = (value || 0) / 1000;
  return `${Intl.NumberFormat('en', { maximumFractionDigits: amount >= 10 ? 1 : 2 }).format(amount)}k`;
}

function usageColor(value: number) {
  if (value <= 20) return 'var(--usage-green)';
  if (value <= 40) return 'var(--usage-blue)';
  if (value <= 60) return 'var(--usage-yellow)';
  if (value <= 80) return 'var(--usage-orange)';
  return 'var(--usage-red)';
}

function pct(used: number, limit: number) {
  if (!limit) return 0;
  return (used / limit) * 100;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

createRoot(document.getElementById('root')!).render(<App />);
