import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Gauge,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sun,
  UserRound,
  Play,
  Trash2
} from 'lucide-react';
import './styles.css';

type Language = 'zh-CN' | 'zh-TW' | 'en';
type AuthMode = 'login' | 'register';
type Tab = 'dashboard' | 'keys' | 'usage' | 'plans' | 'logs' | 'guide';
type PlanView = 'billing' | 'change';
type PurchaseChannelId = 'taobao' | 'xianyu';
type GuideAgentId = 'claude-code' | 'codex';
type GuideOsId = 'windows' | 'macos' | 'linux' | 'macos-linux';
type ThemeMode = 'system' | 'light' | 'dark';
type AccentTheme = 'sun-gold' | 'rose-pink' | 'pine-green' | 'violet' | 'bay-blue';

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

type UserProfile = {
  id: string;
  email: string;
  role: 'admin' | 'member';
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccountState = {
  freeCreditCents: number;
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanRank: number;
  planExpiresAt: string | null;
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
  userId: string | null;
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

type LogRange = '24h' | '3d' | '7d' | '30d';
type LogStatus = 'all' | 'success' | 'failed';

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
  todayInputTokens: number;
  todayCacheCreationInputTokens: number;
  todayCacheReadInputTokens: number;
  accountBalanceCents: number;
  errors: number;
  activeKeys: number;
  series: Array<{ bucket: string; tokens: number; requests: number }>;
};

type Bootstrap = {
  user: UserProfile;
  account: AccountState;
  summary: Summary;
  plans: Plan[];
  keys: ApiKey[];
};

type AuthSession = {
  user: UserProfile;
  token: string;
  expiresAt: string;
};

type SliderChallenge = {
  challengeId: string;
  purpose: AuthMode;
  backgroundImage: string;
  pieceImage: string;
  imageWidth: number;
  imageHeight: number;
  pieceTopPct: number;
  pieceWidthPct: number;
  pieceHeightPct: number;
  expiresAt: string;
};

type LogPage = {
  logs: UsageLog[];
  total: number;
  page: number;
  pageSize: number;
};

type MarkdownHeadingLevel = 1 | 2 | 3 | 4;

type MarkdownBlock =
  | { type: 'heading'; level: MarkdownHeadingLevel; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'divider' };

type MarkdownTocItem = {
  id: string;
  level: MarkdownHeadingLevel;
  text: string;
};

const dictionary = {
  'zh-CN': {
    brand: 'RelayHub',
    subtitle: 'Claude Code / Codex API 满血中转服务',
    dashboard: '概览',
    keys: '密钥',
    usage: '用量',
    plans: '套餐',
    logs: '日志',
    guide: '向导',
    guideTitle: 'RelayHub 向导',
    guideIntroEyebrow: '快速上手',
    guideIntro: '从如何安装 Claude Code / Codex 客户端，到让AI执行第一条命令的五个简单步骤。从下方选择您的操作系统，以获得向导的帮助。',
    guideDocumentTitle: '向导文档',
    guideDocumentHint: '文档更新后，页面会按 Markdown 内容重新渲染。',
    guideLoading: '正在加载向导文档...',
    guideLoadError: '向导文档加载失败，请稍后重试。',
    guideAgentLabel: 'Agent',
    guideOsLabel: '操作系统',
    guideSelectorHint: '请选择当前使用的 Agent 和操作系统，系统会展示对应的安装与配置文档。',
    guideCurrentDocument: '当前文档',
    activeKeys: '活跃密钥',
    requests: '请求数',
    fiveHour: '5 小时滚动',
    weekly: '7 天滚动',
    fiveHourQuota: '5 小时额度',
    weeklyQuota: '每周额度',
    nextReset: '下次重置',
    currentPlan: '当前套餐',
    changePlan: '更换套餐',
    billingLabel: '账单',
    plansAndBilling: '方案与账单',
    billingCurrentPlan: '当前方案',
    freePlan: 'Free',
    currentFreePlan: '您正在使用免费版。',
    upgradePlanHint: '升级以解锁更高速率限制和优先访问权。',
    redeemCard: '礼品卡',
    redeemCardHint: '输入礼品卡卡密，可增加自由额度，或兑换/续期套餐。',
    redeemCardPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
    redeem: '兑换',
    changePlanPage: '更换方案',
    returnBilling: '返回账单',
    upgradeEyebrow: '提升您的限额',
    upgradeTitleBefore: '选择最适合您',
    upgradeTitleAccent: '工作量的方案',
    upgradeUnitBadge: '单价',
    upgradeUnitLine: '低至 ¥0.1 人民币 = $1 美元 API · 充值 ¥10 即可最多获取 $100 美金额度的 API。',
    recommendedUpgrade: 'RECOMMENDED UPGRADE',
    switchToPlan: '切换到 {plan}',
    rateLimitQuota: '限流额度',
    fiveHourShort: '每 5 小时',
    sevenDayShort: '每 7 天',
    monthlyBilling: '每月 · 按月计费',
    planFootnote: '* 适用用量限制。展示价格不含适用税费。价格和方案如有变动，保留最终解释权。升级立即生效，当前方案未使用的时间将折算。',
    purchaseChannelTitle: '选择购买渠道',
    purchaseChannelDescription: '购买 {plan} 后会在新窗口打开对应商品链接。',
    rechargeChannelDescription: '充值额度会在新窗口打开对应商品链接。',
    taobao: '淘宝',
    xianyu: '闲鱼',
    balance: '剩余余额',
    recharge: '充值',
    todayUsage: '今日用量',
    todayRequests: '今日请求',
    todayCacheHitRate: '今日缓存命中率',
    upgrade: '升级',
    overviewWelcome: '欢迎回来',
    overviewWelcomeNamed: '欢迎回来，{name}',
    quickAccess: '快捷入口',
    keyManagement: '密钥管理',
    viewUsage: '查看用量',
    planUpgrade: '套餐升级',
    usageLogs: '使用日志',
    planIncluded: '套餐内额度',
    extraBalance: '自由余额',
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
    allKeys: '全部密钥',
    logKey: '密钥',
    timeRange: '时间范围',
    last24Hours: '最近 24 小时',
    last3Days: '最近 3 天',
    last7Days: '最近 7 天',
    last30Days: '最近 30 天',
    previousPage: '上一页',
    nextPage: '下一页',
    logTotal: '共 {total} 条',
    requestTime: '请求时间',
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
    createdKeySuccess: '密钥创建成功',
    login: '登录',
    register: '注册',
    logout: '退出',
    accountMenu: '个人菜单',
    theme: '主题',
    themeMode: '模式',
    systemMode: '跟随浏览器',
    lightMode: '日间模式',
    darkMode: '夜间模式',
    themeColor: '主题色',
    sunGold: '晨光杏',
    rosePink: '蔷薇雾',
    pineGreen: '松风青',
    violet: '紫藤暮',
    bayBlue: '海盐蓝',
    role: '身份',
    adminRole: '管理员',
    memberRole: '会员',
    email: '邮箱',
    password: '密码',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    displayName: '昵称',
    loginTitle: '登录',
    registerTitle: '加入',
    authHint: '登录后管理自己的 API 密钥、套餐和礼品卡。',
    noAccount: '没有账号？注册',
    haveAccount: '已有账号？登录',
    slideVerify: '拼图验证',
    slideToVerify: '拖动滑块补齐拼图',
    verified: '验证通过',
    verifying: '验证中...',
    verificationRequired: '请先完成拼图验证。',
    verificationFailed: '验证失败，请重试。',
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
    brand: 'RelayHub',
    subtitle: 'Claude Code / Codex API 滿血中轉服務',
    dashboard: '概覽',
    keys: '金鑰',
    usage: '用量',
    plans: '套餐',
    logs: '日誌',
    guide: '向導',
    guideTitle: 'RelayHub 向導',
    guideIntroEyebrow: '快速上手',
    guideIntro: '從如何安裝 Claude Code / Codex 客戶端，到讓 AI 執行第一條命令的五個簡單步驟。從下方選擇您的作業系統，以獲得向導的幫助。',
    guideDocumentTitle: '向導文件',
    guideDocumentHint: '文件更新後，頁面會按 Markdown 內容重新渲染。',
    guideLoading: '正在載入向導文件...',
    guideLoadError: '向導文件載入失敗，請稍後重試。',
    guideAgentLabel: 'Agent',
    guideOsLabel: '作業系統',
    guideSelectorHint: '請選擇目前使用的 Agent 和作業系統，系統會展示對應的安裝與設定文件。',
    guideCurrentDocument: '目前文件',
    activeKeys: '活躍金鑰',
    requests: '請求數',
    fiveHour: '5 小時滾動',
    weekly: '7 天滾動',
    fiveHourQuota: '5 小時額度',
    weeklyQuota: '每週額度',
    nextReset: '下次重置',
    currentPlan: '目前套餐',
    changePlan: '更換套餐',
    billingLabel: '帳單',
    plansAndBilling: '方案與帳單',
    billingCurrentPlan: '目前方案',
    freePlan: 'Free',
    currentFreePlan: '您正在使用免費版。',
    upgradePlanHint: '升級以解鎖更高速率限制和優先存取權。',
    redeemCard: '禮品卡',
    redeemCardHint: '輸入禮品卡卡密，可增加自由額度，或兌換/續期套餐。',
    redeemCardPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
    redeem: '兌換',
    changePlanPage: '更換方案',
    returnBilling: '返回帳單',
    upgradeEyebrow: '提升您的限額',
    upgradeTitleBefore: '選擇最適合您',
    upgradeTitleAccent: '工作量的方案',
    upgradeUnitBadge: '單價',
    upgradeUnitLine: '低至 ¥0.1 人民幣 = $1 美元 API · 儲值 ¥10 即可最多取得 $100 美金額度的 API。',
    recommendedUpgrade: 'RECOMMENDED UPGRADE',
    switchToPlan: '切換到 {plan}',
    rateLimitQuota: '限流額度',
    fiveHourShort: '每 5 小時',
    sevenDayShort: '每 7 天',
    monthlyBilling: '每月 · 按月計費',
    planFootnote: '* 適用用量限制。展示價格不含適用稅費。價格和方案如有變動，保留最終解釋權。升級立即生效，當前方案未使用的時間將折算。',
    purchaseChannelTitle: '選擇購買渠道',
    purchaseChannelDescription: '購買 {plan} 後會在新視窗開啟對應商品連結。',
    rechargeChannelDescription: '儲值額度會在新視窗開啟對應商品連結。',
    taobao: '淘寶',
    xianyu: '閒魚',
    balance: '剩餘餘額',
    recharge: '儲值',
    todayUsage: '今日用量',
    todayRequests: '今日請求',
    todayCacheHitRate: '今日快取命中率',
    upgrade: '升級',
    overviewWelcome: '歡迎回來',
    overviewWelcomeNamed: '歡迎回來，{name}',
    quickAccess: '快捷入口',
    keyManagement: '金鑰管理',
    viewUsage: '查看用量',
    planUpgrade: '套餐升級',
    usageLogs: '使用日誌',
    planIncluded: '套餐內額度',
    extraBalance: '自由餘額',
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
    allKeys: '全部金鑰',
    logKey: '金鑰',
    timeRange: '時間範圍',
    last24Hours: '最近 24 小時',
    last3Days: '最近 3 天',
    last7Days: '最近 7 天',
    last30Days: '最近 30 天',
    previousPage: '上一頁',
    nextPage: '下一頁',
    logTotal: '共 {total} 筆',
    requestTime: '請求時間',
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
    createdKeySuccess: '金鑰建立成功',
    login: '登入',
    register: '註冊',
    logout: '登出',
    accountMenu: '個人選單',
    theme: '主題',
    themeMode: '模式',
    systemMode: '跟隨瀏覽器',
    lightMode: '日間模式',
    darkMode: '夜間模式',
    themeColor: '主題色',
    sunGold: '晨光杏',
    rosePink: '薔薇霧',
    pineGreen: '松風青',
    violet: '紫藤暮',
    bayBlue: '海鹽藍',
    role: '身份',
    adminRole: '管理員',
    memberRole: '會員',
    email: '信箱',
    password: '密碼',
    showPassword: '顯示密碼',
    hidePassword: '隱藏密碼',
    displayName: '暱稱',
    loginTitle: '登入',
    registerTitle: '加入',
    authHint: '登入後管理自己的 API 金鑰、套餐和禮品卡。',
    noAccount: '沒有帳號？註冊',
    haveAccount: '已有帳號？登入',
    slideVerify: '拼圖驗證',
    slideToVerify: '拖動滑塊補齊拼圖',
    verified: '驗證通過',
    verifying: '驗證中...',
    verificationRequired: '請先完成拼圖驗證。',
    verificationFailed: '驗證失敗，請重試。',
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
    brand: 'RelayHub',
    subtitle: 'Claude Code / Codex API full-power relay service',
    dashboard: 'Overview',
    keys: 'Keys',
    usage: 'Usage',
    plans: 'Plans',
    logs: 'Logs',
    guide: 'Guide',
    guideTitle: 'RelayHub Guide',
    guideIntroEyebrow: 'Getting started',
    guideIntro: 'Five simple steps from installing the Claude Code / Codex client to asking AI to run its first command. Choose your operating system below to get guided help.',
    guideDocumentTitle: 'Guide document',
    guideDocumentHint: 'When the document changes, this page renders the updated Markdown content.',
    guideLoading: 'Loading guide document...',
    guideLoadError: 'Unable to load the guide document. Please try again later.',
    guideAgentLabel: 'Agent',
    guideOsLabel: 'Operating system',
    guideSelectorHint: 'Choose your Agent and operating system to view the matching setup and configuration guide.',
    guideCurrentDocument: 'Current document',
    activeKeys: 'Active keys',
    requests: 'Requests',
    fiveHour: '5-hour rolling',
    weekly: '7-day rolling',
    fiveHourQuota: '5-hour quota',
    weeklyQuota: 'Weekly quota',
    nextReset: 'Next reset',
    currentPlan: 'Current plan',
    changePlan: 'Change plan',
    billingLabel: 'Billing',
    plansAndBilling: 'Plans & Billing',
    billingCurrentPlan: 'Current plan',
    freePlan: 'Free',
    currentFreePlan: 'You are using the free plan.',
    upgradePlanHint: 'Upgrade to unlock higher rate limits and priority access.',
    redeemCard: 'Gift card',
    redeemCardHint: 'Enter a gift card code to add free credit or redeem/renew a plan.',
    redeemCardPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
    redeem: 'Redeem',
    changePlanPage: 'Change plan',
    returnBilling: 'Back to billing',
    upgradeEyebrow: 'Increase your limits',
    upgradeTitleBefore: 'Choose the plan that fits',
    upgradeTitleAccent: 'your workload',
    upgradeUnitBadge: 'Unit price',
    upgradeUnitLine: 'As low as RMB ¥0.1 = $1 USD API credit · Recharge ¥10 to get up to $100 API credit.',
    recommendedUpgrade: 'RECOMMENDED UPGRADE',
    switchToPlan: 'Switch to {plan}',
    rateLimitQuota: 'Rate limits',
    fiveHourShort: 'per 5 hours',
    sevenDayShort: 'per 7 days',
    monthlyBilling: 'Monthly · billed monthly',
    planFootnote: '* Usage limits apply. Displayed prices do not include applicable taxes. Prices and plans may change. Upgrades take effect immediately and unused time is prorated.',
    purchaseChannelTitle: 'Choose purchase channel',
    purchaseChannelDescription: 'Buying {plan} opens the matching product link in a new window.',
    rechargeChannelDescription: 'Recharge opens the matching product link in a new window.',
    taobao: 'Taobao',
    xianyu: 'Xianyu',
    balance: 'Remaining balance',
    recharge: 'Recharge',
    todayUsage: 'Today usage',
    todayRequests: 'Today requests',
    todayCacheHitRate: 'Today cache hit rate',
    upgrade: 'Upgrade',
    overviewWelcome: 'Welcome back',
    overviewWelcomeNamed: 'Welcome back, {name}',
    quickAccess: 'Quick access',
    keyManagement: 'Key management',
    viewUsage: 'View usage',
    planUpgrade: 'Upgrade plan',
    usageLogs: 'Usage logs',
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
    allKeys: 'All keys',
    logKey: 'Key',
    timeRange: 'Time range',
    last24Hours: 'Last 24 hours',
    last3Days: 'Last 3 days',
    last7Days: 'Last 7 days',
    last30Days: 'Last 30 days',
    previousPage: 'Previous',
    nextPage: 'Next',
    logTotal: '{total} total',
    requestTime: 'Request time',
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
    createdKeySuccess: 'Key created',
    login: 'Log in',
    register: 'Register',
    logout: 'Log out',
    accountMenu: 'Account menu',
    theme: 'Theme',
    themeMode: 'Mode',
    systemMode: 'Browser',
    lightMode: 'Light',
    darkMode: 'Dark',
    themeColor: 'Theme color',
    sunGold: 'Morning Apricot',
    rosePink: 'Rose Mist',
    pineGreen: 'Pine Breeze',
    violet: 'Wisteria Dusk',
    bayBlue: 'Sea Salt Blue',
    role: 'Role',
    adminRole: 'Admin',
    memberRole: 'Member',
    email: 'Email',
    password: 'Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    displayName: 'Name',
    loginTitle: 'Log in to',
    registerTitle: 'Join',
    authHint: 'Sign in to manage your API keys, plan, and gift cards.',
    noAccount: 'No account? Register',
    haveAccount: 'Have an account? Log in',
    slideVerify: 'Puzzle verification',
    slideToVerify: 'Drag the piece into place',
    verified: 'Verified',
    verifying: 'Verifying...',
    verificationRequired: 'Complete puzzle verification first.',
    verificationFailed: 'Verification failed. Try again.',
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
  todayInputTokens: 0,
  todayCacheCreationInputTokens: 0,
  todayCacheReadInputTokens: 0,
  accountBalanceCents: 0,
  errors: 0,
  activeKeys: 0,
  series: []
};

const defaultAccount: AccountState = {
  freeCreditCents: 0,
  currentPlanId: 'free',
  currentPlanName: 'Free',
  currentPlanRank: 0,
  planExpiresAt: null
};

const defaultUser: UserProfile = {
  id: '',
  email: '',
  role: 'member',
  displayName: null,
  createdAt: '',
  updatedAt: ''
};

const defaultBootstrap: Bootstrap = {
  user: defaultUser,
  account: defaultAccount,
  summary: defaultSummary,
  plans: [],
  keys: []
};

type UpgradePlan = {
  id: string;
  name: string;
  subtitle: string;
  monthlyPriceYuan: number;
  fiveHourCreditUsd: number;
  weeklyCreditUsd: number;
  features: string[];
  recommended?: boolean;
};

type PurchaseChannel = {
  id: PurchaseChannelId;
  iconSrc: string;
  labelKey: 'taobao' | 'xianyu';
};

type GiftCardCard = {
  code: string;
  type: 'credit' | 'plan';
  amountCents: number;
  planId: string | null;
  planName: string | null;
  fiveHourTokenLimit: number;
  weeklyTokenLimit: number;
  planRank: number;
  durationMonths: number;
  redeemedAt: string | null;
};

type GiftCardCurrentPlan = {
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanRank: number;
  planExpiresAt: string | null;
};

type GiftCardPreview = {
  card: GiftCardCard;
  currentPlan: GiftCardCurrentPlan;
  consequence: 'credit' | 'upgrade' | 'extend';
  canUse: boolean;
  message: string;
  requiresConfirmation: boolean;
  redeemed: boolean;
};

const upgradePlans: UpgradePlan[] = [
  {
    id: 'pro',
    name: 'Pro',
    subtitle: '入门版',
    monthlyPriceYuan: 60,
    fiveHourCreditUsd: 20,
    weeklyCreditUsd: 140,
    features: ['$20 / 5 小时 · $140 / 7 天', '完整访问 Claude Code Opus 4.8 和 Gpt 5.5']
  },
  {
    id: 'max',
    name: 'Max',
    subtitle: '专业版',
    monthlyPriceYuan: 119,
    fiveHourCreditUsd: 40,
    weeklyCreditUsd: 264,
    features: ['2 倍 于入门版用量', '开发效率工具', '更高输出限额'],
    recommended: true
  },
  {
    id: 'ultra',
    name: 'Ultra',
    subtitle: '高级版',
    monthlyPriceYuan: 580,
    fiveHourCreditUsd: 200,
    weeklyCreditUsd: 1320,
    features: ['10 倍 于入门版用量', '适合重度开发工作流', '优先体验高级功能', '峰值流量优先访问']
  },
  {
    id: 'power',
    name: 'Power',
    subtitle: '旗舰版 · 团队与高强度工作量',
    monthlyPriceYuan: 1150,
    fiveHourCreditUsd: 400,
    weeklyCreditUsd: 2640,
    features: ['20 倍 于入门版用量', '包含高级版全部权益', '最高输出限制', '专属入门服务']
  }
];

const planPurchaseLinks: Record<PurchaseChannelId, string> = {
  taobao: 'https://www.taobao.com/?transferStationProduct=plan',
  xianyu: 'https://www.goofish.com/?transferStationProduct=plan'
};

const rechargePurchaseLinks: Record<PurchaseChannelId, string> = {
  taobao: 'https://www.taobao.com/?transferStationProduct=recharge',
  xianyu: 'https://www.goofish.com/?transferStationProduct=recharge'
};

const guideIconSrc = '/guide-icon.png';

const guideAgentOptions: Array<{ id: GuideAgentId; label: string }> = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' }
];

const guideOsOptionsByAgent: Record<GuideAgentId, Array<{ id: GuideOsId; label: string }>> = {
  'claude-code': [
    { id: 'windows', label: 'Windows' },
    { id: 'macos', label: 'MacOS' },
    { id: 'linux', label: 'Linux' }
  ],
  codex: [
    { id: 'macos-linux', label: 'MacOS/Linux' },
    { id: 'windows', label: 'Windows' }
  ]
};

const guideDefaultOsByAgent: Record<GuideAgentId, GuideOsId> = {
  'claude-code': 'macos',
  codex: 'macos-linux'
};

const guideDocumentSources: Record<GuideAgentId, Partial<Record<GuideOsId, string>>> = {
  'claude-code': {
    windows: '/guides/claude-code-windows.md',
    macos: '/guides/claude-code-macos.md',
    linux: '/guides/claude-code-linux.md'
  },
  codex: {
    windows: '/guides/codex-windows.md',
    'macos-linux': '/guides/codex-macos-linux.md'
  }
};

const purchaseChannels: PurchaseChannel[] = [
  { id: 'taobao', iconSrc: 'https://www.taobao.com/favicon.ico', labelKey: 'taobao' },
  { id: 'xianyu', iconSrc: 'https://www.goofish.com/favicon.ico', labelKey: 'xianyu' }
];

const themeModeOptions = [
  { id: 'system' as const, labelKey: 'systemMode', icon: Monitor },
  { id: 'light' as const, labelKey: 'lightMode', icon: Sun },
  { id: 'dark' as const, labelKey: 'darkMode', icon: Moon }
];

const accentThemeOptions = [
  { id: 'sun-gold' as const, labelKey: 'sunGold' },
  { id: 'rose-pink' as const, labelKey: 'rosePink' },
  { id: 'pine-green' as const, labelKey: 'pineGreen' },
  { id: 'violet' as const, labelKey: 'violet' },
  { id: 'bay-blue' as const, labelKey: 'bayBlue' }
];

const routeTabSegments: Record<Tab, string> = {
  dashboard: 'dashboard',
  keys: 'keys',
  usage: 'usage',
  plans: 'plans',
  logs: 'logs',
  guide: 'guide'
};

const routeSegmentTabs = Object.entries(routeTabSegments).reduce<Record<string, Tab>>((map, [tab, segment]) => {
  map[segment] = tab as Tab;
  return map;
}, {});

function resolveRoute(route: string): { tab: Tab; planView: PlanView } {
  const normalizedRoute = route.replace(/^\/+/, '').replace(/\/+$/, '');
  const [segment = '', viewSegment = ''] = normalizedRoute.split('/');
  const tab = routeSegmentTabs[segment] || 'dashboard';
  return {
    tab,
    planView: tab === 'plans' && viewSegment === 'change' ? 'change' : 'billing'
  };
}

function readHistoryRoute(): { tab: Tab; planView: PlanView } {
  const legacyHashRoute = window.location.hash.match(/^#\/(.+)/)?.[1];
  if (legacyHashRoute) return resolveRoute(legacyHashRoute);
  return resolveRoute(window.location.pathname);
}

function routeToPath(tab: Tab, planView: PlanView) {
  const segment = routeTabSegments[tab];
  return tab === 'plans' && planView === 'change' ? `/${segment}/change` : `/${segment}`;
}

function writeHistoryRoute(tab: Tab, planView: PlanView, replace = false) {
  const nextPath = routeToPath(tab, planView);
  if (!window.location.hash && window.location.pathname === nextPath) return;
  const nextUrl = `${nextPath}${window.location.search}`;
  if (replace) {
    window.history.replaceState(null, '', nextUrl);
    return;
  }
  window.history.pushState(null, '', nextUrl);
}

function readThemeMode(): ThemeMode {
  const value = localStorage.getItem('themeMode');
  return value === 'system' || value === 'light' || value === 'dark' ? value : 'system';
}

function readAccentTheme(): AccentTheme {
  const value = localStorage.getItem('accentTheme');
  if (
    value === 'sun-gold' ||
    value === 'rose-pink' ||
    value === 'pine-green' ||
    value === 'violet' ||
    value === 'bay-blue'
  ) {
    return value;
  }
  return 'sun-gold';
}

function getBrowserThemeMode(): Exclude<ThemeMode, 'system'> {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveThemeMode(themeMode: ThemeMode): Exclude<ThemeMode, 'system'> {
  return themeMode === 'system' ? getBrowserThemeMode() : themeMode;
}

function BrandMark() {
  return (
    <svg className="brand-mark-icon" viewBox="0 0 44 44" role="img" aria-label="RelayHub">
      <path className="brand-mark-monogram" d="M13.5 33.2V10.9h11.6c5 0 8.2 2.9 8.2 7.3s-3.2 7.3-8.2 7.3H13.5" />
      <path className="brand-mark-leg" d="M22.5 25.7 32 33.2" />
      <path className="brand-mark-relay" d="M23.2 18.2h9.6m-3.5-3.4 3.5 3.4-3.5 3.4" />
      <circle className="brand-mark-core" cx="22.7" cy="18.2" r="3.1" />
    </svg>
  );
}

function BrandSubtitle({ subtitle }: { subtitle: string }) {
  const keyword = subtitle.includes('满血') ? '满血' : subtitle.includes('滿血') ? '滿血' : '';

  if (!keyword) {
    return <p>{subtitle}</p>;
  }

  const [before, after] = subtitle.split(keyword);

  return (
    <p>
      {before}
      <strong className="brand-subtitle-highlight">{keyword}</strong>
      {after}
    </p>
  );
}

function GuideMenuIcon({ size = 18 }: { size?: number }) {
  return <img className="nav-pixel-icon" src={guideIconSrc} alt="" width={size} height={size} />;
}

function getPageTitle(tab: Tab, planView: PlanView, t: Record<string, string>) {
  if (tab === 'plans') return planView === 'change' ? t.changePlanPage : t.plansAndBilling;

  const pageTitles: Record<Exclude<Tab, 'plans'>, string> = {
    dashboard: t.dashboard,
    keys: t.keyManagement,
    usage: t.usage,
    logs: t.usageLogs,
    guide: t.guideTitle
  };

  return pageTitles[tab];
}

function App() {
  const initialRoute = React.useMemo(() => readHistoryRoute(), []);
  const [language, setLanguage] = React.useState<Language>('zh-CN');
  const [activeTab, setActiveTab] = React.useState<Tab>(initialRoute.tab);
  const [planView, setPlanView] = React.useState<PlanView>(initialRoute.planView);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => readThemeMode());
  const [accentTheme, setAccentTheme] = React.useState<AccentTheme>(() => readAccentTheme());
  const [authToken, setAuthToken] = React.useState(localStorage.getItem('authToken') || '');
  const [data, setData] = React.useState<Bootstrap>(defaultBootstrap);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState('');
  const t = dictionary[language];

  const headers = React.useMemo(() => {
    const value: HeadersInit = { 'content-type': 'application/json' };
    if (authToken) value.authorization = `Bearer ${authToken}`;
    return value;
  }, [authToken]);

  const load = React.useCallback(async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const bootstrapRes = await fetch('/api/bootstrap', { headers });
      if (bootstrapRes.status === 401) {
        localStorage.removeItem('authToken');
        setAuthToken('');
        setData(defaultBootstrap);
        setNotice('');
        setLoading(false);
        return;
      }
      const bootstrap = (await bootstrapRes.json()) as Bootstrap;
      setData(bootstrap);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }, [authToken, headers]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    writeHistoryRoute(activeTab, planView, true);

    function syncRouteFromHistory() {
      const nextRoute = readHistoryRoute();
      setActiveTab(nextRoute.tab);
      setPlanView(nextRoute.planView);
    }

    window.addEventListener('popstate', syncRouteFromHistory);
    return () => {
      window.removeEventListener('popstate', syncRouteFromHistory);
    };
  }, [activeTab, planView]);

  React.useEffect(() => {
    const applyThemeMode = () => {
      document.documentElement.dataset.themeMode = resolveThemeMode(themeMode);
    };

    applyThemeMode();
    document.documentElement.dataset.accent = accentTheme;
    localStorage.setItem('themeMode', themeMode);
    localStorage.setItem('accentTheme', accentTheme);

    if (themeMode !== 'system') return undefined;

    const applyWhenVisible = () => {
      if (document.visibilityState === 'visible') applyThemeMode();
    };
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

    mediaQuery?.addEventListener('change', applyThemeMode);
    window.addEventListener('focus', applyThemeMode);
    document.addEventListener('visibilitychange', applyWhenVisible);

    return () => {
      mediaQuery?.removeEventListener('change', applyThemeMode);
      window.removeEventListener('focus', applyThemeMode);
      document.removeEventListener('visibilitychange', applyWhenVisible);
    };
  }, [accentTheme, themeMode]);

  function changeThemeMode(nextThemeMode: ThemeMode) {
    setThemeMode(nextThemeMode);
    document.documentElement.dataset.themeMode = resolveThemeMode(nextThemeMode);
  }

  function logout() {
    localStorage.removeItem('authToken');
    setAuthToken('');
    setData(defaultBootstrap);
  }

  const isPlansPage = activeTab === 'plans';
  const pageTitle = getPageTitle(activeTab, planView, t);
  const nav = [
    { id: 'dashboard' as const, label: t.dashboard, icon: LayoutDashboard },
    { id: 'keys' as const, label: t.keys, icon: KeyRound },
    { id: 'usage' as const, label: t.usage, icon: BarChart3 },
    { id: 'plans' as const, label: t.plans, icon: CreditCard },
    { id: 'logs' as const, label: t.logs, icon: Activity },
    { id: 'guide' as const, label: t.guide, icon: GuideMenuIcon }
  ];

  function navigate(tab: Tab, nextPlanView: PlanView = 'billing') {
    setActiveTab(tab);
    setPlanView(tab === 'plans' ? nextPlanView : 'billing');
    writeHistoryRoute(tab, tab === 'plans' ? nextPlanView : 'billing');
  }

  function openPlanChange() {
    navigate('plans', 'change');
  }

  function changePlanView(nextPlanView: PlanView) {
    setPlanView(nextPlanView);
    writeHistoryRoute('plans', nextPlanView);
  }

  if (!authToken) {
    return (
      <AuthPage
        t={t}
        language={language}
        setLanguage={setLanguage}
        themeMode={themeMode}
        setThemeMode={changeThemeMode}
        accentTheme={accentTheme}
        setAccentTheme={setAccentTheme}
        onAuthenticated={(session) => {
          localStorage.setItem('authToken', session.token);
          setAuthToken(session.token);
          setData({ ...defaultBootstrap, user: session.user });
          setNotice('');
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <BrandMark />
          </div>
          <div>
            <h1>{t.brand}</h1>
            <BrandSubtitle subtitle={t.subtitle} />
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
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className={isPlansPage ? 'main-panel plans-main-panel' : 'main-panel'}>
        <header className="topbar">
          <div className="topbar-title">
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <LanguageMenu language={language} setLanguage={setLanguage} />
            <ThemeMenu
              themeMode={themeMode}
              setThemeMode={changeThemeMode}
              accentTheme={accentTheme}
              setAccentTheme={setAccentTheme}
              t={t}
            />
            <button type="button" className="icon-button" onClick={() => void load()} title={t.refresh}>
              <RefreshCcw size={17} />
            </button>
            <AccountMenu user={data.user} t={t} onLogout={logout} />
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}
        {loading ? <div className="loading-line" /> : null}

        {activeTab === 'dashboard' ? (
          <OverviewPage data={data} t={t} onNavigate={navigate} onUpgradePlan={openPlanChange} />
        ) : null}
        {activeTab === 'keys' ? <KeysPanel data={data} headers={headers} reload={load} t={t} /> : null}
        {activeTab === 'usage' ? <UsagePage data={data} t={t} onChangePlan={openPlanChange} /> : null}
        {activeTab === 'plans' ? (
          <PlansPanel
            data={data}
            headers={headers}
            reload={load}
            t={t}
            view={planView}
            setView={changePlanView}
          />
        ) : null}
        {activeTab === 'logs' ? <LogsPanel keys={data.keys} headers={headers} t={t} /> : null}
        {activeTab === 'guide' ? <GuidePage t={t} /> : null}
      </main>
    </div>
  );
}

function AuthPage({
  t,
  language,
  setLanguage,
  themeMode,
  setThemeMode,
  accentTheme,
  setAccentTheme,
  onAuthenticated
}: {
  t: Record<string, string>;
  language: Language;
  setLanguage: (language: Language) => void;
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accentTheme: AccentTheme) => void;
  onAuthenticated: (session: AuthSession) => void;
}) {
  const [mode, setMode] = React.useState<AuthMode>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [captchaToken, setCaptchaToken] = React.useState('');
  const [verificationResetKey, setVerificationResetKey] = React.useState(0);
  const [isVerificationOpen, setIsVerificationOpen] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function authenticate(verifiedToken: string) {
    setSubmitting(true);
    setNotice('');
    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          captchaToken: verifiedToken,
          ...(mode === 'register' ? { displayName } : {})
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(typeof payload.error === 'string' ? payload.error : t.keyUnavailable);
        setCaptchaToken('');
        setVerificationResetKey((value) => value + 1);
        return;
      }
      onAuthenticated(payload as AuthSession);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.keyUnavailable);
      setCaptchaToken('');
      setVerificationResetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!captchaToken) {
      setNotice('');
      setIsVerificationOpen(true);
      return;
    }
    await authenticate(captchaToken);
  }

  function handleVerificationToken(token: string) {
    setCaptchaToken(token);
    if (token) {
      setIsVerificationOpen(false);
      void authenticate(token);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setNotice('');
    setCaptchaToken('');
    setVerificationResetKey((value) => value + 1);
    setIsVerificationOpen(false);
    setIsPasswordVisible(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark">
            <BrandMark />
          </div>
          <div>
            <h1 className="auth-title">
              <span>{mode === 'login' ? t.loginTitle : t.registerTitle}</span>
              <span className="auth-title-brand">{t.brand}</span>
            </h1>
            <p>{t.authHint}</p>
          </div>
        </div>
        <form className="auth-form" onSubmit={submit} autoComplete="on">
          {notice ? <div className="notice inline">{notice}</div> : null}
          <label>
            {t.email}
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              name="email"
              autoComplete={mode === 'login' ? 'username' : 'email'}
              inputMode="email"
              required
              autoFocus
            />
          </label>
          {mode === 'register' ? (
            <label>
              {t.displayName}
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                name="name"
                autoComplete="name"
              />
            </label>
          ) : null}
          <label>
            {t.password}
            <span className="password-input-shell">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={isPasswordVisible ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 8 : undefined}
                required
              />
              <button
                type="button"
                className="password-visibility-button"
                onClick={() => setIsPasswordVisible((value) => !value)}
                aria-label={isPasswordVisible ? t.hidePassword : t.showPassword}
                title={isPasswordVisible ? t.hidePassword : t.showPassword}
              >
                {isPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          <button type="submit" className="primary-button" disabled={submitting}>
            {mode === 'login' ? t.login : t.register}
          </button>
        </form>
        <div className="auth-footer">
          <button type="button" className="upgrade-link-button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? t.noAccount : t.haveAccount}
          </button>
          <div className="auth-footer-actions">
            <LanguageMenu language={language} setLanguage={setLanguage} />
            <ThemeMenu
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              accentTheme={accentTheme}
              setAccentTheme={setAccentTheme}
              t={t}
            />
          </div>
        </div>
      </section>
      {isVerificationOpen ? (
        <div className="modal-backdrop" onClick={() => setIsVerificationOpen(false)}>
          <section
            className="modal-panel auth-verification-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.slideVerify}
            onClick={(event) => event.stopPropagation()}
          >
            <SliderVerification
              key={`${mode}-${verificationResetKey}`}
              mode={mode}
              t={t}
              onTokenChange={handleVerificationToken}
            />
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setIsVerificationOpen(false)}>
                {t.cancel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
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

function ThemeMenu({
  themeMode,
  setThemeMode,
  accentTheme,
  setAccentTheme,
  t
}: {
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accentTheme: AccentTheme) => void;
  t: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="theme-menu" ref={menuRef}>
      <button
        type="button"
        className="icon-button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={t.theme}
      >
        <Palette size={17} />
      </button>
      {isOpen ? (
        <div className="theme-menu-panel" role="menu" aria-label={t.theme}>
          <div className="theme-menu-section">
            <span>{t.themeMode}</span>
            <div className="theme-mode-control">
              {themeModeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    type="button"
                    className={themeMode === option.id ? 'theme-mode-button active' : 'theme-mode-button'}
                    key={option.id}
                    onClick={() => setThemeMode(option.id)}
                    title={t[option.labelKey]}
                  >
                    <Icon size={15} />
                    <span>{t[option.labelKey]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="theme-menu-section">
            <span>{t.themeColor}</span>
            <div className="accent-grid">
              {accentThemeOptions.map((option) => (
                <button
                  type="button"
                  className={accentTheme === option.id ? 'accent-swatch active' : 'accent-swatch'}
                  data-accent-option={option.id}
                  key={option.id}
                  onClick={() => setAccentTheme(option.id)}
                  title={t[option.labelKey]}
                  aria-label={t[option.labelKey]}
                >
                  <span />
                  <strong>{t[option.labelKey]}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountMenu({
  user,
  t,
  onLogout
}: {
  user: UserProfile;
  t: Record<string, string>;
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const roleLabel = user.role === 'admin' ? t.adminRole : t.memberRole;
  const userName = user.displayName?.trim() || user.email.split('@')[0] || '-';

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={t.accountMenu}
      >
        <UserRound size={16} />
      </button>
      {isOpen ? (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-profile">
            <div className="account-menu-profile-row">
              <span>{t.displayName}</span>
              <strong>{userName}</strong>
            </div>
            <div className="account-menu-profile-row">
              <span>{t.email}</span>
              <strong>{user.email || '-'}</strong>
            </div>
            <div className="account-menu-profile-row">
              <span>{t.role}</span>
              <strong>{roleLabel}</strong>
            </div>
          </div>
          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            <LogOut size={15} />
            {t.logout}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SliderVerification({
  mode,
  t,
  onTokenChange
}: {
  mode: AuthMode;
  t: Record<string, string>;
  onTokenChange: (token: string) => void;
}) {
  const [challenge, setChallenge] = React.useState<SliderChallenge | null>(null);
  const [value, setValue] = React.useState(0);
  const [status, setStatus] = React.useState(t.slideToVerify);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isVerified, setIsVerified] = React.useState(false);

  const loadChallenge = React.useCallback(async () => {
    onTokenChange('');
    setChallenge(null);
    setValue(0);
    setIsVerified(false);
    setIsLoading(true);
    setStatus(t.slideToVerify);

    try {
      const response = await fetch('/api/auth/slider-challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ purpose: mode })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(typeof payload.error === 'string' ? payload.error : t.verificationFailed);
        return;
      }
      setChallenge(payload as SliderChallenge);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.verificationFailed);
    } finally {
      setIsLoading(false);
    }
  }, [mode, onTokenChange, t.slideToVerify, t.verificationFailed]);

  React.useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  async function verify(nextValue: number) {
    if (!challenge || isVerifying || isVerified) return;
    setIsVerifying(true);
    setStatus(t.verifying);
    try {
      const response = await fetch('/api/auth/slider-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          purpose: mode,
          positionPct: nextValue
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(typeof payload.error === 'string' ? payload.error : t.verificationFailed);
        setValue(0);
        onTokenChange('');
        void loadChallenge();
        return;
      }
      setIsVerified(true);
      setValue(nextValue);
      setStatus(t.verified);
      onTokenChange(payload.captchaToken || '');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.verificationFailed);
      setValue(0);
      onTokenChange('');
      void loadChallenge();
    } finally {
      setIsVerifying(false);
    }
  }

  function updateSlider(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = Number(event.target.value);
    setValue(nextValue);
  }

  function releaseSlider() {
    if (!disabled) {
      void verify(value);
    }
  }

  const disabled = isLoading || isVerifying || isVerified || !challenge;
  const pieceLeftPct = challenge ? (value / 100) * (100 - challenge.pieceWidthPct) : 0;
  const trackStyle = {
    '--slider-progress': `${value}%`,
    '--piece-left': `${pieceLeftPct}%`,
    '--piece-top': `${challenge?.pieceTopPct ?? 34}%`,
    '--piece-width': `${challenge?.pieceWidthPct ?? 13.75}%`,
    '--piece-height': `${challenge?.pieceHeightPct ?? 29.33}%`
  } as React.CSSProperties;

  return (
    <div className={isVerified ? 'slider-verify verified' : 'slider-verify'}>
      <div className="slider-verify-head">
        <span>
          <ShieldCheck size={14} />
          {t.slideVerify}
        </span>
        <button type="button" onClick={() => void loadChallenge()} disabled={isLoading || isVerifying}>
          <RefreshCcw size={13} />
        </button>
      </div>
      <div className="puzzle-board" style={trackStyle}>
        {challenge ? (
          <>
            <img className="puzzle-image" src={challenge.backgroundImage} alt="" draggable={false} />
            <img className="puzzle-piece" src={challenge.pieceImage} alt="" draggable={false} />
          </>
        ) : (
          <span className="puzzle-loading">{t.verifying}</span>
        )}
      </div>
      <div className="slider-track" style={trackStyle}>
        <span className="slider-fill" />
        <span className="slider-thumb" />
        <span className="slider-copy">{isVerified ? t.verified : t.slideToVerify}</span>
        <input
          aria-label={t.slideVerify}
          type="range"
          min="0"
          max="100"
          step="1"
          value={value}
          onChange={updateSlider}
          onPointerUp={releaseSlider}
          onKeyUp={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              releaseSlider();
            }
          }}
          disabled={disabled}
        />
      </div>
      <span className="slider-status">{status}</span>
    </div>
  );
}

function OverviewPage({
  data,
  t,
  onNavigate,
  onUpgradePlan
}: {
  data: Bootstrap;
  t: Record<string, string>;
  onNavigate: (tab: Tab, planView?: PlanView) => void;
  onUpgradePlan: () => void;
}) {
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false);
  const currentPlan =
    data.plans.find((plan) => plan.id === data.account.currentPlanId) ||
    data.plans.find((plan) => plan.id === 'free') ||
    data.plans[0];
  const currentPlanName =
    data.account.currentPlanRank > 0 ? data.account.currentPlanName || currentPlan?.name : currentPlan?.name || t.freePlan;
  const currencyCode = currentPlan?.currency || 'CNY';
  const todayCacheBase =
    data.summary.todayInputTokens +
    data.summary.todayCacheCreationInputTokens +
    data.summary.todayCacheReadInputTokens;
  const todayCacheHitRate = todayCacheBase ? data.summary.todayCacheReadInputTokens / todayCacheBase : 0;
  const welcomeName = data.user.displayName?.trim() || data.user.email.split('@')[0];
  const welcomeMessage = welcomeName ? t.overviewWelcomeNamed.replace('{name}', welcomeName) : t.overviewWelcome;

  function openRechargeLink(channelId: PurchaseChannelId) {
    window.open(rechargePurchaseLinks[channelId], '_blank', 'noopener,noreferrer');
    setIsRechargeOpen(false);
  }

  const quickEntries = [
    { label: t.keyManagement, icon: KeyRound, onClick: () => onNavigate('keys') },
    { label: t.viewUsage, icon: BarChart3, onClick: () => onNavigate('usage') },
    { label: t.planUpgrade, icon: CreditCard, onClick: onUpgradePlan },
    { label: t.usageLogs, icon: Activity, onClick: () => onNavigate('logs') }
  ];

  return (
    <section className="overview-page">
      <p className="overview-welcome">{welcomeMessage}</p>

      <div className="overview-card-grid">
        <article className="overview-card current-plan-overview">
          <div className="overview-card-icon">
            <CreditCard size={20} />
          </div>
          <span>{t.billingCurrentPlan}</span>
          <strong>{currentPlanName}</strong>
          <p>{currentPlan?.description || t.upgradePlanHint}</p>
          <button type="button" className="secondary-button" onClick={onUpgradePlan}>
            <CreditCard size={16} />
            {t.upgrade}
          </button>
        </article>

        <article className="overview-card">
          <div className="overview-card-icon blue">
            <BarChart3 size={20} />
          </div>
          <span>{t.todayRequests}</span>
          <strong>{compact(data.summary.todayRequests)}</strong>
          <p>{t.todayUsage}: {currency(data.summary.todayCostCents, currencyCode)}</p>
        </article>

        <article className="overview-card">
          <div className="overview-card-icon amber">
            <Gauge size={20} />
          </div>
          <span>{t.todayCacheHitRate}</span>
          <strong>{percent(todayCacheHitRate)}</strong>
          <p>{t.cacheHit}: {tokenK(data.summary.todayCacheReadInputTokens)}</p>
        </article>

        <article className="overview-card">
          <div className="overview-card-icon rose">
            <DollarSign size={20} />
          </div>
          <span>{t.balance}</span>
          <strong>{currency(data.summary.accountBalanceCents, currencyCode)}</strong>
          <p>{t.extraBalance}</p>
          <button type="button" className="primary-button" onClick={() => setIsRechargeOpen(true)}>
            <Plus size={17} />
            {t.recharge}
          </button>
        </article>
      </div>

      <section className="quick-access-panel">
        <div className="section-heading">
          <h2>{t.quickAccess}</h2>
        </div>
        <div className="quick-access-grid">
          {quickEntries.map((entry) => {
            const Icon = entry.icon;
            return (
              <button type="button" className="quick-access-card" key={entry.label} onClick={entry.onClick}>
                <Icon size={20} />
                <strong>{entry.label}</strong>
              </button>
            );
          })}
        </div>
      </section>

      {isRechargeOpen ? (
        <PurchaseChannelModal
          description={t.rechargeChannelDescription}
          onClose={() => setIsRechargeOpen(false)}
          onOpenChannel={openRechargeLink}
          t={t}
        />
      ) : null}
    </section>
  );
}

function UsagePage({ data, t, onChangePlan }: { data: Bootstrap; t: Record<string, string>; onChangePlan: () => void }) {
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false);
  const primaryKey = data.keys.find((key) => key.status === 'active') || data.keys[0];
  const currentPlan =
    data.plans.find((plan) => plan.id === data.account.currentPlanId) ||
    data.plans.find((plan) => plan.id === 'free') ||
    data.plans[0];
  const quota = buildAccountQuota(data, currentPlan, primaryKey?.usage);
  const currentPlanName =
    data.account.currentPlanRank > 0 ? data.account.currentPlanName || currentPlan?.name : currentPlan?.name;
  const balance = currency(data.summary.accountBalanceCents, currentPlan?.currency || 'CNY');
  const todayAverage = data.summary.todayRequests
    ? Math.round(data.summary.todayCostCents / data.summary.todayRequests)
    : 0;
  const currencyCode = currentPlan?.currency || 'CNY';

  function openRechargeLink(channelId: PurchaseChannelId) {
    window.open(rechargePurchaseLinks[channelId], '_blank', 'noopener,noreferrer');
    setIsRechargeOpen(false);
  }

  return (
    <section className="content-grid">
      <section className="overview-hero">
        <article className="plan-summary">
          <span>{t.currentPlan}</span>
          <div>
            <h2>{currentPlanName || '-'}</h2>
            <button type="button" className="secondary-button" onClick={onChangePlan}>
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
          <button type="button" className="primary-button" onClick={() => setIsRechargeOpen(true)}>
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
      {isRechargeOpen ? (
        <PurchaseChannelModal
          description={t.rechargeChannelDescription}
          onClose={() => setIsRechargeOpen(false)}
          onOpenChannel={openRechargeLink}
          t={t}
        />
      ) : null}
    </section>
  );
}

function GuidePage({ t }: { t: Record<string, string> }) {
  const [selectedAgent, setSelectedAgent] = React.useState<GuideAgentId>('claude-code');
  const [selectedOs, setSelectedOs] = React.useState<GuideOsId>('macos');
  const [markdown, setMarkdown] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState('');
  const availableOsOptions = guideOsOptionsByAgent[selectedAgent];
  const selectedOsOption = availableOsOptions.find((option) => option.id === selectedOs) || availableOsOptions[0];
  const documentSrc = guideDocumentSources[selectedAgent][selectedOsOption.id] || '';
  const selectedAgentLabel = guideAgentOptions.find((option) => option.id === selectedAgent)?.label || selectedAgent;
  const selectedOsLabel = selectedOsOption.label;

  React.useEffect(() => {
    if (!availableOsOptions.some((option) => option.id === selectedOs)) {
      setSelectedOs(guideDefaultOsByAgent[selectedAgent]);
    }
  }, [availableOsOptions, selectedAgent, selectedOs]);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotice('');
    setMarkdown('');

    fetch(documentSrc, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(t.guideLoadError);
        return response.text();
      })
      .then((content) => setMarkdown(content))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setNotice(error instanceof Error ? error.message : t.guideLoadError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [documentSrc, t.guideLoadError]);

  return (
    <section className="guide-page">
      <section className="guide-intro">
        <div className="guide-intro-icon">
          <img src={guideIconSrc} alt="" />
        </div>
        <div>
          <span>{t.guideIntroEyebrow}</span>
          <h1>{t.guideTitle}</h1>
          <p>{t.guideIntro}</p>
        </div>
      </section>

      <section className="guide-selector-panel">
        <div>
          <span>{t.guideAgentLabel}</span>
          <div className="guide-segmented-control">
            {guideAgentOptions.map((option) => (
              <button
                type="button"
                className={selectedAgent === option.id ? 'active' : ''}
                key={option.id}
                onClick={() => setSelectedAgent(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span>{t.guideOsLabel}</span>
          <div className="guide-segmented-control">
            {availableOsOptions.map((option) => (
              <button
                type="button"
                className={selectedOsOption.id === option.id ? 'active' : ''}
                key={option.id}
                onClick={() => setSelectedOs(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p>{t.guideSelectorHint}</p>
      </section>

      <section className="guide-document">
        <div className="section-heading">
          <div>
            <h2>
              {selectedAgentLabel} - {selectedOsLabel}
            </h2>
            <p>{t.guideDocumentHint}</p>
          </div>
        </div>
        {notice ? <div className="notice inline">{notice}</div> : null}
        {loading ? (
          <>
            <div className="loading-line" />
            <p className="guide-loading-text">{t.guideLoading}</p>
          </>
        ) : null}
        {!loading && markdown ? <MarkdownRenderer source={markdown} copyLabel={t.copy} copiedLabel={t.copied} /> : null}
      </section>
    </section>
  );
}

function MarkdownRenderer({ source, copyLabel, copiedLabel }: { source: string; copyLabel: string; copiedLabel: string }) {
  const blocks = React.useMemo(() => parseMarkdownBlocks(source), [source]);
  const { headingIds, tocItems } = React.useMemo(() => buildMarkdownNavigation(blocks), [blocks]);

  function scrollToHeading(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="markdown-layout">
      <aside className="markdown-toc" aria-label="文档目录">
        {tocItems.map((item) => (
          <button
            type="button"
            className={`markdown-toc-item level-${item.level}`}
            key={item.id}
            onClick={() => scrollToHeading(item.id)}
          >
            {item.text}
          </button>
        ))}
      </aside>

      <article className="markdown-body">
        {blocks.map((block, index) => {
          if (block.type === 'heading') {
            const tagName = `h${block.level}`;
            return React.createElement(
              tagName,
              { id: headingIds.get(index), key: `${block.type}-${index}` },
              renderInlineMarkdown(block.text)
            );
          }

          if (block.type === 'paragraph') {
            return <p key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</p>;
          }

          if (block.type === 'quote') {
            return <blockquote key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</blockquote>;
          }

          if (block.type === 'divider') {
            return <hr key={`${block.type}-${index}`} />;
          }

          if (block.type === 'code') {
            return (
              <MarkdownCodeBlock
                code={block.code}
                copiedLabel={copiedLabel}
                copyLabel={copyLabel}
                key={`${block.type}-${index}`}
                language={block.language}
              />
            );
          }

          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ListTag>
          );
        })}
      </article>
    </div>
  );
}

function MarkdownCodeBlock({
  code,
  language,
  copyLabel,
  copiedLabel
}: {
  code: string;
  language: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const resetTimerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function copyCode() {
    await copyTextToClipboard(code);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    setCopied(true);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-topbar">
        {language ? <span className="markdown-code-label">{language}</span> : <span aria-hidden="true" />}
        <button
          type="button"
          className="markdown-code-copy"
          onClick={copyCode}
          aria-label={copied ? copiedLabel : copyLabel}
          title={copied ? copiedLabel : copyLabel}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy copy path.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function buildMarkdownNavigation(blocks: MarkdownBlock[]) {
  const slugCounts = new Map<string, number>();
  const headingIds = new Map<number, string>();
  const tocItems: MarkdownTocItem[] = [];

  blocks.forEach((block, index) => {
    if (block.type !== 'heading') return;
    const baseSlug = slugifyHeading(block.text) || `section-${index + 1}`;
    const seen = slugCounts.get(baseSlug) || 0;
    const id = seen ? `${baseSlug}-${seen + 1}` : baseSlug;
    slugCounts.set(baseSlug, seen + 1);
    headingIds.set(index, id);
    tocItems.push({ id, level: block.level, text: stripMarkdownTokens(block.text) });
  });

  return { headingIds, tocItems };
}

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language: fence[1] || '', code: codeLines.join('\n') });
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 4) as MarkdownHeadingLevel, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: 'divider' });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = isOrdered ? current.match(/^\d+[.)]\s+(.+)$/) : current.match(/^[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || isMarkdownBlockStart(current)) break;
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

function isMarkdownBlockStart(line: string) {
  return (
    line.startsWith('```') ||
    /^(#{1,4})\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+[.)]\s+/.test(line) ||
    line.startsWith('>') ||
    /^(-{3,}|\*{3,})$/.test(line)
  );
}

function slugifyHeading(text: string) {
  return stripMarkdownTokens(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function stripMarkdownTokens(text: string) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index || 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(<code key={`code-${start}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={`strong-${start}`}>{renderInlineMarkdown(token.slice(2, -2))}</strong>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = link[2];
        const isExternal = /^https?:\/\//.test(href);
        nodes.push(
          <a
            key={`link-${start}`}
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noreferrer' : undefined}
          >
            {renderInlineMarkdown(link[1])}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
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
                {t.remaining}: {currency(row.remaining, 'USD')}
                {row.resetAt ? ` · ${t.nextReset}: ${fullDate(row.resetAt)}` : ''}
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
    const response = await fetch('/api/user/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name })
    });
    const payload = await response.json();
    if (response.ok) {
      setIsCreateOpen(false);
      setName('');
      await reload();
      setNotice(t.createdKeySuccess);
    } else {
      setNotice(payload.error || t.keyUnavailable);
    }
  }

  async function fetchSecret(id: string): Promise<KeySecret | null> {
    const response = await fetch(`/api/user/keys/${id}/secret`, { headers });
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
    const response = await fetch(`/api/user/keys/${apiKey.id}`, { method: 'DELETE', headers });
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
          onCreate={() => setIsCreateOpen(true)}
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
  onCreate,
  onRevoke
}: {
  keys: ApiKey[];
  t: Record<string, string>;
  copiedId: string;
  onCopy: (apiKey: ApiKey) => Promise<void>;
  onUse: (apiKey: ApiKey) => void;
  onCreate: () => void;
  onRevoke?: (apiKey: ApiKey) => void;
}) {
  if (!keys.length) {
    return (
      <Empty t={t} className="key-table-empty">
        <button type="button" className="primary-button" onClick={onCreate}>
          <Plus size={17} />
          {t.createKey}
        </button>
      </Empty>
    );
  }

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
  data,
  headers,
  reload,
  t,
  view,
  setView
}: {
  data: Bootstrap;
  headers: HeadersInit;
  reload: () => Promise<void>;
  t: Record<string, string>;
  view: PlanView;
  setView: (view: PlanView) => void;
}) {
  const [redeemCode, setRedeemCode] = React.useState('');
  const [redeemNotice, setRedeemNotice] = React.useState('');
  const [giftPreview, setGiftPreview] = React.useState<GiftCardPreview | null>(null);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [purchaseTarget, setPurchaseTarget] = React.useState<UpgradePlan | null>(null);
  const primaryKey = data.keys.find((key) => key.status === 'active') || data.keys[0];
  const accountPlan =
    data.plans.find((plan) => plan.id === data.account.currentPlanId) ||
    data.plans.find((plan) => plan.id === 'free');
  const quota = buildAccountQuota(data, accountPlan, primaryKey?.usage) || emptyQuota();

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    const code = redeemCode.trim();
    if (!code) return;
    setIsRedeeming(true);
    setRedeemNotice('');
    try {
      const response = await fetch('/api/user/gift-cards/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });
      const payload = await response.json();
      if (!response.ok) {
        setRedeemNotice(payload.error || t.keyUnavailable);
        return;
      }
      const result = payload as GiftCardPreview;
      if (result.requiresConfirmation) {
        setGiftPreview(result);
        return;
      }
      await redeemCreditGiftCard(code);
    } catch (error) {
      setRedeemNotice(error instanceof Error ? error.message : t.keyUnavailable);
    } finally {
      setIsRedeeming(false);
    }
  }

  async function redeemCreditGiftCard(code: string) {
    const response = await fetch('/api/user/gift-cards/redeem', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code })
    });
    const payload = await response.json();
    if (!response.ok) {
      setRedeemNotice(payload.error || t.keyUnavailable);
      return;
    }
    setRedeemNotice(payload.message || t.redeem);
    setRedeemCode('');
    await reload();
  }

  async function confirmGiftCard() {
    if (!giftPreview) return;
    setIsRedeeming(true);
    try {
      const response = await fetch('/api/user/gift-cards/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: giftPreview.card.code, confirm: true })
      });
      const payload = await response.json();
      if (!response.ok) {
        setRedeemNotice(payload.error || t.keyUnavailable);
        return;
      }
      setGiftPreview(null);
      setRedeemCode('');
      setRedeemNotice(payload.message || t.redeem);
      await reload();
    } catch (error) {
      setRedeemNotice(error instanceof Error ? error.message : t.keyUnavailable);
    } finally {
      setIsRedeeming(false);
    }
  }

  function openPurchaseLink(channelId: PurchaseChannelId) {
    window.open(planPurchaseLinks[channelId], '_blank', 'noopener,noreferrer');
    setPurchaseTarget(null);
  }

  if (view === 'change') {
    return (
      <>
        <PlanChangePage
          currentPlanId={data.account.currentPlanId || undefined}
          openPurchaseDialog={setPurchaseTarget}
          setView={setView}
          t={t}
        />
        {purchaseTarget ? (
          <PurchaseChannelModal
            description={t.purchaseChannelDescription.replace('{plan}', purchaseTarget.name)}
            onClose={() => setPurchaseTarget(null)}
            onOpenChannel={openPurchaseLink}
            t={t}
          />
        ) : null}
      </>
    );
  }

  return (
    <section className="billing-page">
      <section className="billing-section">
        <div className="billing-section-head">
          <h2>{t.billingCurrentPlan}</h2>
          <button type="button" className="secondary-button" onClick={() => setView('change')}>
            {t.changePlanPage}
          </button>
        </div>
        <article className="current-plan-card">
          <div className="free-plan-badge">{accountPlan?.name || t.freePlan}</div>
          <div className="current-plan-copy">
            <strong>{data.account.currentPlanRank > 0 ? data.account.currentPlanName || accountPlan?.name : t.currentFreePlan}</strong>
            <p>
              {data.account.planExpiresAt ? `${t.nextReset}: ${fullDate(data.account.planExpiresAt)}` : t.upgradePlanHint}
            </p>
          </div>
          <div className="current-plan-quotas">
            <div>
              <span>{t.fiveHourQuota}</span>
              <strong>
                {currency(quota.fiveHourUsed, 'USD')} / {currency(quota.fiveHourLimit, 'USD')}
              </strong>
            </div>
            <div>
              <span>{t.weeklyQuota}</span>
              <strong>
                {currency(quota.weeklyUsed, 'USD')} / {currency(quota.weeklyLimit, 'USD')}
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="billing-section redeem-card-section">
        <h2>{t.redeemCard}</h2>
        <form className="redeem-card-panel" onSubmit={redeem}>
          <p>{t.redeemCardHint}</p>
          {redeemNotice ? <div className="notice inline">{redeemNotice}</div> : null}
          <div className="redeem-row">
            <input
              className="redeem-card-input"
              value={redeemCode}
              onChange={(event) => setRedeemCode(event.target.value)}
              placeholder={t.redeemCardPlaceholder}
            />
            <button type="submit" disabled={!redeemCode.trim() || isRedeeming}>
              {t.redeem}
            </button>
          </div>
        </form>
      </section>
      {giftPreview ? (
        <GiftCardConfirmModal
          preview={giftPreview}
          t={t}
          disabled={isRedeeming}
          onConfirm={confirmGiftCard}
          onClose={() => setGiftPreview(null)}
        />
      ) : null}
    </section>
  );
}

function PlanChangePage({
  currentPlanId,
  openPurchaseDialog,
  setView,
  t
}: {
  currentPlanId?: string;
  openPurchaseDialog: (plan: UpgradePlan) => void;
  setView: (view: PlanView) => void;
  t: Record<string, string>;
}) {
  return (
    <section className="upgrade-page">
      <header className="upgrade-topbar">
        <button type="button" className="upgrade-link-button" onClick={() => setView('billing')}>
          <ArrowLeft size={15} />
          {t.returnBilling}
        </button>
      </header>

      <section className="upgrade-hero">
        <p>{t.upgradeEyebrow}</p>
        <h1>
          {t.upgradeTitleBefore} <span>{t.upgradeTitleAccent}</span>。
        </h1>
        <div className="upgrade-price-note">
          <span>{t.upgradeUnitBadge}</span>
          <strong>{t.upgradeUnitLine}</strong>
        </div>
      </section>

      <div className="upgrade-plan-grid">
        {upgradePlans.map((plan) => (
          <article
            className={plan.recommended ? 'upgrade-card recommended' : 'upgrade-card'}
            key={plan.id}
          >
            {plan.recommended ? <div className="recommended-badge">{t.recommendedUpgrade}</div> : null}
            <div className="upgrade-card-head">
              <h2>{plan.name}</h2>
              <p>{plan.subtitle}</p>
            </div>
            <div className="upgrade-price">
              <span>￥</span>
              <strong>{plan.monthlyPriceYuan}</strong>
            </div>
            <p className="upgrade-billing">{t.monthlyBilling}</p>
            <button
              type="button"
              className={plan.recommended ? 'primary-button upgrade-cta' : 'secondary-button upgrade-cta'}
              onClick={() => openPurchaseDialog(plan)}
              aria-pressed={currentPlanId === plan.id}
            >
              {t.switchToPlan.replace('{plan}', plan.name)}
            </button>
            <div className="upgrade-quota-box">
              <span>{t.rateLimitQuota}</span>
              <div>
                <strong>{currencyNoDecimals(dollarsToCents(plan.fiveHourCreditUsd), 'USD')}</strong>
                <strong>{currencyNoDecimals(dollarsToCents(plan.weeklyCreditUsd), 'USD')}</strong>
              </div>
              <div>
                <small>{t.fiveHourShort}</small>
                <small>{t.sevenDayShort}</small>
              </div>
            </div>
            <ul className="upgrade-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={14} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="upgrade-footnote">{t.planFootnote}</p>
    </section>
  );
}

function PurchaseChannelModal({
  description,
  onClose,
  onOpenChannel,
  t
}: {
  description: string;
  onClose: () => void;
  onOpenChannel: (channelId: PurchaseChannelId) => void;
  t: Record<string, string>;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-panel purchase-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-channel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <h2 id="purchase-channel-title">{t.purchaseChannelTitle}</h2>
            <p>{description}</p>
          </div>
        </div>
        <div className="purchase-channel-grid">
          {purchaseChannels.map((channel) => {
            return (
              <button
                type="button"
                className="purchase-channel-card"
                key={channel.id}
                onClick={() => onOpenChannel(channel.id)}
              >
                <span className="purchase-channel-icon">
                  <img src={channel.iconSrc} alt="" />
                </span>
                <strong>{t[channel.labelKey]}</strong>
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </section>
    </div>
  );
}

function GiftCardConfirmModal({
  preview,
  t,
  disabled,
  onConfirm,
  onClose
}: {
  preview: GiftCardPreview;
  t: Record<string, string>;
  disabled: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-panel gift-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-card-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <h2 id="gift-card-confirm-title">{t.redeemCard}</h2>
            <p>{preview.message}</p>
          </div>
        </div>
        <div className="gift-card-summary">
          <div>
            <span>{t.plan}</span>
            <strong>{preview.card.planName || '-'}</strong>
          </div>
          <div>
            <span>{t.fiveHourQuota}</span>
            <strong>{currency(preview.card.fiveHourTokenLimit, 'USD')}</strong>
          </div>
          <div>
            <span>{t.weeklyQuota}</span>
            <strong>{currency(preview.card.weeklyTokenLimit, 'USD')}</strong>
          </div>
        </div>
        <p className="gift-card-warning">
          {preview.consequence === 'extend'
            ? '同级套餐将延长一个月。'
            : '立即使用后，此前更低级的套餐将被覆盖且无法恢复。'}
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={disabled}>
            {t.cancel}
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={disabled}>
            {t.redeem}
          </button>
        </div>
      </section>
    </div>
  );
}

function LogsPanel({ keys, headers, t }: { keys: ApiKey[]; headers: HeadersInit; t: Record<string, string> }) {
  const [status, setStatus] = React.useState<LogStatus>('all');
  const [apiKeyId, setApiKeyId] = React.useState('all');
  const [range, setRange] = React.useState<LogRange>('24h');
  const [page, setPage] = React.useState(1);
  const [logPage, setLogPage] = React.useState<LogPage>({ logs: [], total: 0, page: 1, pageSize: 20 });
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(logPage.total / logPage.pageSize));

  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(logPage.pageSize),
        status,
        range
      });
      if (apiKeyId !== 'all') params.set('apiKeyId', apiKeyId);
      const response = await fetch(`/api/user/logs?${params.toString()}`, { headers });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || t.noData);
        return;
      }
      setLogPage(payload as LogPage);
      setExpandedId(null);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.noData);
    } finally {
      setLoading(false);
    }
  }, [apiKeyId, headers, logPage.pageSize, page, range, status, t.noData]);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function updateStatus(value: LogStatus) {
    setStatus(value);
    setPage(1);
  }

  function updateApiKey(value: string) {
    setApiKeyId(value);
    setPage(1);
  }

  function updateRange(value: LogRange) {
    setRange(value);
    setPage(1);
  }

  return (
    <section className="content-grid">
      <div className="log-filters">
        <label>
          {t.logKey}
          <select value={apiKeyId} onChange={(event) => updateApiKey(event.target.value)}>
            <option value="all">{t.allKeys}</option>
            {keys.map((apiKey) => (
              <option value={apiKey.id} key={apiKey.id}>
                {apiKey.name || apiKey.keyPreview || apiKey.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.status}
          <select value={status} onChange={(event) => updateStatus(event.target.value as LogStatus)}>
            <option value="all">{t.allStatuses}</option>
            <option value="success">{t.successOnly}</option>
            <option value="failed">{t.failedOnly}</option>
          </select>
        </label>
        <label>
          {t.timeRange}
          <select value={range} onChange={(event) => updateRange(event.target.value as LogRange)}>
            <option value="24h">{t.last24Hours}</option>
            <option value="3d">{t.last3Days}</option>
            <option value="7d">{t.last7Days}</option>
            <option value="30d">{t.last30Days}</option>
          </select>
        </label>
      </div>
      <section className="table-panel">
        {notice ? <div className="notice inline">{notice}</div> : null}
        {loading ? <div className="loading-line" /> : null}
        <LogRows logs={logPage.logs} t={t} expandedId={expandedId} setExpandedId={setExpandedId} />
        <div className="pagination-bar">
          <span>{t.logTotal.replace('{total}', String(logPage.total))}</span>
          <div>
            <button type="button" className="secondary-button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>
              {t.previousPage}
            </button>
            <strong>
              {page} / {pageCount}
            </strong>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPage((value) => value + 1)}
              disabled={page >= pageCount}
            >
              {t.nextPage}
            </button>
          </div>
        </div>
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

function buildAccountQuota(data: Bootstrap, plan?: Plan, fallback?: QuotaSnapshot): QuotaSnapshot | null {
  if (!plan) return fallback || null;
  const fiveHourUsed = Math.max(0, Number(data.summary.fiveHourCostCents || fallback?.fiveHourUsed || 0));
  const weeklyUsed = Math.max(0, Number(data.summary.weeklyCostCents || fallback?.weeklyUsed || 0));
  const fiveHourLimit = Math.max(0, Number(plan.fiveHourTokenLimit || fallback?.fiveHourLimit || 0));
  const weeklyLimit = Math.max(0, Number(plan.weeklyTokenLimit || fallback?.weeklyLimit || 0));

  return {
    fiveHourUsed,
    fiveHourLimit,
    weeklyUsed,
    weeklyLimit,
    remainingFiveHour: Math.max(0, fiveHourLimit - fiveHourUsed),
    remainingWeekly: Math.max(0, weeklyLimit - weeklyUsed),
    fiveHourResetAt: fallback?.fiveHourResetAt || '',
    weeklyResetAt: fallback?.weeklyResetAt || ''
  };
}

function emptyQuota(): QuotaSnapshot {
  return {
    fiveHourUsed: 0,
    fiveHourLimit: 0,
    weeklyUsed: 0,
    weeklyLimit: 0,
    remainingFiveHour: 0,
    remainingWeekly: 0,
    fiveHourResetAt: '',
    weeklyResetAt: ''
  };
}

function Empty({ t, children, className = '' }: { t: Record<string, string>; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <span>{t.noData}</span>
      {children}
    </div>
  );
}

function compact(value: number) {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function percent(value: number) {
  return `${Intl.NumberFormat('en', { maximumFractionDigits: value >= 0.1 ? 1 : 2 }).format((value || 0) * 100)}%`;
}

function currency(cents: number, currencyCode: string) {
  void currencyCode;
  const value = Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format((cents || 0) / 100);
  return `$${value}`;
}

function currencyNoDecimals(cents: number, currencyCode: string) {
  void currencyCode;
  const value = Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format((cents || 0) / 100);
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
