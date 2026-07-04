import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole
} from '@floating-ui/react';
import {
  Activity,
  ArrowLeft,
  Ban,
  BarChart3,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Gauge,
  Gift,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Sun,
  UserRound,
  Play,
  Route,
  Trash2,
  X
} from 'lucide-react';
import './styles.css';
import { RechargeModal } from './components/RechargeModal.js';

const officialQqGroupQrSrc = '/relayhub-qq-group-2.jpg';
const officialQqGroupNumber = '1050784021';

type Language = 'zh-CN' | 'zh-TW' | 'en';
type AuthMode = 'login' | 'register';
type Tab = 'dashboard' | 'keys' | 'usage' | 'plans' | 'orders' | 'logs' | 'gift-cards' | 'products' | 'channels' | 'users' | 'user-detail' | 'guide';
type PlanView = 'billing' | 'change';
type PurchaseChannelId = 'taobao' | 'xianyu';
type ProductItemType = 'plan' | 'credit';
type GuideAgentId = 'claude-code' | 'codex';
type UpstreamKeyAgentType = 'shared' | GuideAgentId;
type GuideOsId = 'windows' | 'macos' | 'linux' | 'macos-linux';
type ThemeMode = 'system' | 'light' | 'dark';
type AccentTheme = 'sun-gold' | 'rose-pink' | 'pine-green' | 'violet' | 'bay-blue';

type NavMenuItem = {
  id: Tab;
  label: string;
  icon: React.ElementType<{ size?: number }>;
};

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

type ProductLink = {
  itemType: ProductItemType;
  itemId: string;
  channel: PurchaseChannelId;
  url: string;
  createdAt: string;
  updatedAt: string;
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
  balanceCents: number;
  quotaSource: 'plan' | 'balance' | 'none';
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
  channelGroupId: string | null;
  channelNumber: number | null;
  usageSource: 'plan' | 'balance' | 'none';
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
  productLinks: ProductLink[];
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

type ClaimedOrder = {
  id?: string;
  orderId: string;
  subOrderId: string;
  platform: PurchaseChannelId;
  title: string;
  giftCardType?: 'credit' | 'plan' | null;
  giftCardCode: string | null;
  deliveryStatus: 'pending' | 'ready' | 'claimed' | 'skipped' | 'failed';
  claimedAt: string | null;
  updatedAt: string;
};

type Paginated<T> = {
  total: number;
  page: number;
  pageSize: number;
} & T;

type UserListItem = UserProfile & {
  currentPlanId: string | null;
  currentPlanName: string | null;
  freeCreditCents: number;
  planExpiresAt: string | null;
};

type UserListPage = Paginated<{ users: UserListItem[] }> & {
  sortField: 'freeCreditCents' | 'createdAt';
  sortOrder: 'asc' | 'desc';
};

type GiftCardRedemptionPage = Paginated<{ giftCards: GiftCardCard[] }> & {
  days: number;
};

type UpstreamChannelKey = {
  id: string;
  channelGroupId: string;
  name: string;
  agentType: UpstreamKeyAgentType;
  keyPreview: string;
  status: 'active' | 'paused' | 'revoked' | 'banned';
  sortOrder: number;
  expiresAt: string | null;
  exhaustedUntil: string | null;
  failureReason: string | null;
  failureStatusCode: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UpstreamModelRate = {
  id: string;
  channelGroupId: string;
  agentType: GuideAgentId;
  model: string;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  cacheCreationRatePerMillion: number;
  cacheReadRatePerMillion: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type UpstreamChannel = {
  id: string;
  channelNumber: number;
  name: string;
  status: 'active' | 'paused';
  claudeApiUrl: string;
  codexApiUrl: string;
  useIndependentAgentKeys: boolean;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  cacheCreationRatePerMillion: number;
  cacheReadRatePerMillion: number;
  serverErrorRecoveryMinutes: number;
  displayUsageMultiplier: number;
  sortOrder: number;
  degradedUntil: string | null;
  degradedReason: string | null;
  degradedStatusCode: number | null;
  keys: UpstreamChannelKey[];
  modelRates: UpstreamModelRate[];
  keyCounts: Record<UpstreamKeyAgentType, number>;
  createdAt: string;
  updatedAt: string;
};

type UpstreamChannelAgentTab = GuideAgentId;

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
    plans: '套餐/余额',
    logs: '日志',
    guide: '向导',
    openMenu: '打开菜单',
    closeMenu: '关闭菜单',
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
    plansAndBilling: '套餐/余额',
    myOrders: '我的订单',
    claimOrderCode: '领取兑换码',
    claimOrderTitle: '订单取码',
    claimOrderHint: '输入已付款订单号，领取系统自动生成的兑换码。',
    orderNumber: '订单号',
    orderNumberPlaceholder: '请输入订单号',
    claimRecordTitle: '领取记录',
    claimRecordHint: '仅展示近 30 天内由当前账号领取的订单。',
    orderItem: '商品',
    claimTime: '领取时间',
    claimSuccess: '兑换码已领取。',
    copyCodes: '复制兑换码',
    copiedCodes: '已复制兑换码',
    deliveryStatus_pending: '待处理',
    deliveryStatus_ready: '待领取',
    deliveryStatus_claimed: '已领取',
    deliveryStatus_skipped: '已跳过',
    deliveryStatus_failed: '失败',
    billingCurrentPlan: '余额详情',
    freePlan: 'Free',
    currentFreePlan: '您正在使用免费版。',
    upgradePlanHint: '升级以解锁更高速率限制和优先访问权。',
    redeemCard: '礼品卡',
    giftCards: '礼品码',
    giftCardManagement: '礼品码管理',
    giftCardManagementHint: '创建套餐卡或余额卡，复制生成的卡密后发放给用户兑换。',
    createGiftCard: '生成礼品码',
    giftCardType: '礼品卡类型',
    giftCardPlanType: '套餐',
    giftCardCreditType: '余额',
    giftCardAmount: '余额金额',
    giftCardQuantity: '生成数量',
    giftCardDuration: '有效月份',
    giftCardPrefix: '卡密前缀',
    generatedGiftCards: '本次生成',
    createdBy: '创建人',
    giftCardTotal: '共 {total} 个礼品码',
    redeemed: '已兑换',
    unredeemed: '未兑换',
    revoked: '已撤销',
    revokedBy: '撤销人',
    giftCardRevoked: '兑换码已撤销。',
    revokeGiftCard: '撤销兑换码',
    revokeGiftCardConfirm: '确认撤销这个未使用的兑换码？撤销后用户将无法兑换。',
    redeemedBy: '使用人',
    redeemCardHint: '输入礼品卡卡密，可增加自由额度，或兑换/续期套餐。',
    redeemCardPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
    redeem: '兑换',
    changePlanPage: '更换方案',
    returnBilling: '返回账单',
    upgradeEyebrow: '提升您的限额',
    upgradeTitleBefore: '选择最适合您',
    upgradeTitleAccent: '工作量的方案',
    upgradeUnitBadge: '单价',
    upgradeUnitLine: '低至 ¥1 人民币 = $5 美元 API · 充值 ¥10 即可最多获取 $50 美金额度的 API。',
    recommendedUpgrade: 'RECOMMENDED UPGRADE',
    switchToPlan: '切换到 {plan}',
    rateLimitQuota: '限流额度',
    fiveHourShort: '每 5 小时',
    sevenDayShort: '每 7 天',
    monthlyBilling: '每月 · 按月计费',
    planFootnote: '* 适用用量限制。展示价格不含适用税费。价格和方案如有变动，保留最终解释权。升级立即生效，当前方案未使用的时间将折算。',
    purchaseChannelTitle: '选择购买渠道',
    purchaseChannelDescription: '选择购买渠道和套餐后，点击去购买打开对应商品链接。',
    rechargeChannelDescription: '选择购买渠道和额度后，点击去购买打开对应商品链接。',
    purchaseSuspendedTitle: '购买渠道暂停通知',
    purchaseSuspendedDescription: '由于淘宝和闲鱼禁止上架 GPT 和 Claude Code 商品，现已暂停该购买渠道，请加入官方 QQ 交流群找群主进行购买。',
    officialQQGroup: '官方 QQ 交流群',
    officialQQGroupNumber: '群号',
    purchaseProductTitle: '选择商品',
    purchasePlanTitle: '套餐',
    purchaseCreditTitle: '额度',
    goPurchase: '去购买',
    productManagement: '商品管理',
    productManagementHint: '维护套餐和额度在淘宝、闲鱼的商品链接。',
    saveProducts: '保存商品链接',
    productLinksSaved: '商品链接已保存。',
    channelManagement: '渠道管理',
    taobao: '淘宝',
    xianyu: '闲鱼',
    balance: '余额',
    recharge: '充值',
    todayUsage: '今日用量',
    todayRequests: '今日请求',
    todayCacheHitRate: '今日缓存复用率',
    todayCacheReuseHint: '按今日全部请求汇总计算',
    requestCacheHitRate: '本次缓存命中率',
    requestCacheHitHint: '按当前请求单次计算',
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
    upstreamReady: '上游已配置',
    requestFailed: '请求失败，请稍后重试。',
    available: '可用',
    quotaInsufficient: '额度不足',
    channelInternalError: '渠道内部错误',
    autoResetAt: '自动重置时间',
    ban: '封禁',
    unban: '解封',
    banned: '封禁',
    notAvailable: '-'
  },
  'zh-TW': {
    brand: 'RelayHub',
    subtitle: 'Claude Code / Codex API 滿血中轉服務',
    dashboard: '概覽',
    keys: '金鑰',
    usage: '用量',
    plans: '套餐/餘額',
    logs: '日誌',
    guide: '向導',
    openMenu: '開啟選單',
    closeMenu: '關閉選單',
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
    plansAndBilling: '套餐/餘額',
    myOrders: '我的訂單',
    claimOrderCode: '領取兌換碼',
    claimOrderTitle: '訂單取碼',
    claimOrderHint: '輸入已付款訂單號，領取系統自動生成的兌換碼。',
    orderNumber: '訂單號',
    orderNumberPlaceholder: '請輸入訂單號',
    claimRecordTitle: '領取記錄',
    claimRecordHint: '僅展示近 30 天內由目前帳號領取的訂單。',
    orderItem: '商品',
    claimTime: '領取時間',
    claimSuccess: '兌換碼已領取。',
    copyCodes: '複製兌換碼',
    copiedCodes: '已複製兌換碼',
    deliveryStatus_pending: '待處理',
    deliveryStatus_ready: '待領取',
    deliveryStatus_claimed: '已領取',
    deliveryStatus_skipped: '已略過',
    deliveryStatus_failed: '失敗',
    billingCurrentPlan: '餘額詳情',
    freePlan: 'Free',
    currentFreePlan: '您正在使用免費版。',
    upgradePlanHint: '升級以解鎖更高速率限制和優先存取權。',
    redeemCard: '禮品卡',
    giftCards: '禮品碼',
    giftCardManagement: '禮品碼管理',
    giftCardManagementHint: '建立套餐卡或餘額卡，複製生成的卡密後發放給用戶兌換。',
    createGiftCard: '生成禮品碼',
    giftCardType: '禮品卡類型',
    giftCardPlanType: '套餐',
    giftCardCreditType: '餘額',
    giftCardAmount: '餘額金額',
    giftCardQuantity: '生成數量',
    giftCardDuration: '有效月份',
    giftCardPrefix: '卡密前綴',
    generatedGiftCards: '本次生成',
    createdBy: '建立人',
    giftCardTotal: '共 {total} 個禮品碼',
    redeemed: '已兌換',
    unredeemed: '未兌換',
    revoked: '已撤銷',
    revokedBy: '撤銷人',
    giftCardRevoked: '兌換碼已撤銷。',
    revokeGiftCard: '撤銷兌換碼',
    revokeGiftCardConfirm: '確認撤銷這個未使用的兌換碼？撤銷後用戶將無法兌換。',
    redeemedBy: '使用人',
    redeemCardHint: '輸入禮品卡卡密，可增加自由額度，或兌換/續期套餐。',
    redeemCardPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
    redeem: '兌換',
    changePlanPage: '更換方案',
    returnBilling: '返回帳單',
    upgradeEyebrow: '提升您的限額',
    upgradeTitleBefore: '選擇最適合您',
    upgradeTitleAccent: '工作量的方案',
    upgradeUnitBadge: '單價',
    upgradeUnitLine: '低至 ¥1 人民幣 = $5 美元 API · 儲值 ¥10 即可最多取得 $50 美金額度的 API。',
    recommendedUpgrade: 'RECOMMENDED UPGRADE',
    switchToPlan: '切換到 {plan}',
    rateLimitQuota: '限流額度',
    fiveHourShort: '每 5 小時',
    sevenDayShort: '每 7 天',
    monthlyBilling: '每月 · 按月計費',
    planFootnote: '* 適用用量限制。展示價格不含適用稅費。價格和方案如有變動，保留最終解釋權。升級立即生效，當前方案未使用的時間將折算。',
    purchaseChannelTitle: '選擇購買渠道',
    purchaseChannelDescription: '選擇購買渠道和套餐後，點擊去購買開啟對應商品連結。',
    rechargeChannelDescription: '選擇購買渠道和額度後，點擊去購買開啟對應商品連結。',
    purchaseSuspendedTitle: '購買渠道暫停通知',
    purchaseSuspendedDescription: '由於淘寶和閒魚禁止上架 GPT 和 Claude Code 商品，現已暫停該購買渠道，請加入官方 QQ 交流群找群主進行購買。',
    officialQQGroup: '官方 QQ 交流群',
    officialQQGroupNumber: '群號',
    purchaseProductTitle: '選擇商品',
    purchasePlanTitle: '套餐',
    purchaseCreditTitle: '額度',
    goPurchase: '去購買',
    productManagement: '商品管理',
    productManagementHint: '維護套餐和額度在淘寶、閒魚的商品連結。',
    saveProducts: '儲存商品連結',
    productLinksSaved: '商品連結已儲存。',
    channelManagement: '渠道管理',
    taobao: '淘寶',
    xianyu: '閒魚',
    balance: '餘額',
    recharge: '儲值',
    todayUsage: '今日用量',
    todayRequests: '今日請求',
    todayCacheHitRate: '今日快取複用率',
    todayCacheReuseHint: '按今日全部請求彙總計算',
    requestCacheHitRate: '本次快取命中率',
    requestCacheHitHint: '按目前請求單次計算',
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
    upstreamReady: '上游已設定',
    requestFailed: '請求失敗，請稍後再試。',
    available: '可用',
    quotaInsufficient: '額度不足',
    channelInternalError: '渠道內部錯誤',
    autoResetAt: '自動重置時間',
    ban: '封禁',
    unban: '解封',
    banned: '封禁',
    notAvailable: '-'
  },
  en: {
    brand: 'RelayHub',
    subtitle: 'Claude Code / Codex API full-power relay service',
    dashboard: 'Overview',
    keys: 'Keys',
    usage: 'Usage',
    plans: 'Plans / Balance',
    logs: 'Logs',
    guide: 'Guide',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
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
    plansAndBilling: 'Plans / Balance',
    myOrders: 'My orders',
    claimOrderCode: 'Claim code',
    claimOrderTitle: 'Order code claim',
    claimOrderHint: 'Enter a paid order number to claim the gift code generated for it.',
    orderNumber: 'Order number',
    orderNumberPlaceholder: 'Enter order number',
    claimRecordTitle: 'Claim records',
    claimRecordHint: 'Shows orders claimed by this account in the last 30 days.',
    orderItem: 'Item',
    claimTime: 'Claimed at',
    claimSuccess: 'Gift code claimed.',
    copyCodes: 'Copy codes',
    copiedCodes: 'Codes copied',
    deliveryStatus_pending: 'Pending',
    deliveryStatus_ready: 'Ready',
    deliveryStatus_claimed: 'Claimed',
    deliveryStatus_skipped: 'Skipped',
    deliveryStatus_failed: 'Failed',
    billingCurrentPlan: 'Balance details',
    freePlan: 'Free',
    currentFreePlan: 'You are using the free plan.',
    upgradePlanHint: 'Upgrade to unlock higher rate limits and priority access.',
    redeemCard: 'Gift card',
    giftCards: 'Gift codes',
    giftCardManagement: 'Gift code management',
    giftCardManagementHint: 'Create plan cards or balance cards, then copy the generated codes for users to redeem.',
    createGiftCard: 'Generate gift codes',
    giftCardType: 'Gift card type',
    giftCardPlanType: 'Plan',
    giftCardCreditType: 'Balance',
    giftCardAmount: 'Balance amount',
    giftCardQuantity: 'Quantity',
    giftCardDuration: 'Months',
    giftCardPrefix: 'Code prefix',
    generatedGiftCards: 'Generated now',
    createdBy: 'Created by',
    giftCardTotal: '{total} gift codes',
    redeemed: 'Redeemed',
    unredeemed: 'Available',
    revoked: 'Revoked',
    revokedBy: 'Revoked by',
    giftCardRevoked: 'Gift code revoked.',
    revokeGiftCard: 'Revoke gift code',
    revokeGiftCardConfirm: 'Revoke this unused gift code? Users will not be able to redeem it afterward.',
    redeemedBy: 'Used by',
    redeemCardHint: 'Enter a gift card code to add free credit or redeem/renew a plan.',
    redeemCardPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
    redeem: 'Redeem',
    changePlanPage: 'Change plan',
    returnBilling: 'Back to billing',
    upgradeEyebrow: 'Increase your limits',
    upgradeTitleBefore: 'Choose the plan that fits',
    upgradeTitleAccent: 'your workload',
    upgradeUnitBadge: 'Unit price',
    upgradeUnitLine: 'As low as RMB ¥1 = $5 USD API credit · Recharge ¥10 to get up to $50 API credit.',
    recommendedUpgrade: 'RECOMMENDED UPGRADE',
    switchToPlan: 'Switch to {plan}',
    rateLimitQuota: 'Rate limits',
    fiveHourShort: 'per 5 hours',
    sevenDayShort: 'per 7 days',
    monthlyBilling: 'Monthly · billed monthly',
    planFootnote: '* Usage limits apply. Displayed prices do not include applicable taxes. Prices and plans may change. Upgrades take effect immediately and unused time is prorated.',
    purchaseChannelTitle: 'Choose purchase channel',
    purchaseChannelDescription: 'Choose a channel and plan, then click Buy to open the matching product link.',
    rechargeChannelDescription: 'Choose a channel and credit amount, then click Buy to open the matching product link.',
    purchaseSuspendedTitle: 'Purchase channel suspended',
    purchaseSuspendedDescription: 'Because Taobao and Xianyu prohibit listing GPT and Claude Code products, this purchase channel is currently suspended. Please join the official QQ group and contact the group owner to make a purchase.',
    officialQQGroup: 'Official QQ group',
    officialQQGroupNumber: 'Group number',
    purchaseProductTitle: 'Choose product',
    purchasePlanTitle: 'Plan',
    purchaseCreditTitle: 'Credit',
    goPurchase: 'Buy',
    productManagement: 'Product management',
    productManagementHint: 'Maintain Taobao and Xianyu product links for plans and credit packs.',
    saveProducts: 'Save product links',
    productLinksSaved: 'Product links saved.',
    channelManagement: 'Channel management',
    taobao: 'Taobao',
    xianyu: 'Xianyu',
    balance: 'Remaining balance',
    recharge: 'Recharge',
    todayUsage: 'Today usage',
    todayRequests: 'Today requests',
    todayCacheHitRate: 'Today cache reuse rate',
    todayCacheReuseHint: 'Calculated from all requests today',
    requestCacheHitRate: 'Per-request cache hit rate',
    requestCacheHitHint: 'Calculated from this request only',
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
    upstreamReady: 'Upstream configured',
    requestFailed: 'Request failed. Please try again.',
    available: 'Available',
    quotaInsufficient: 'Quota exhausted',
    channelInternalError: 'Internal channel error',
    autoResetAt: 'Auto reset time',
    ban: 'Ban',
    unban: 'Unban',
    banned: 'Banned',
    notAvailable: '-'
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
  productLinks: [],
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

type CreditProduct = {
  id: string;
  amountUsd: number;
  priceCents: number;
};

type PurchaseProductOption = {
  itemType: ProductItemType;
  itemId: string;
  name: string;
  priceLabel: string;
  description?: string;
};

type PlanProductOption = PurchaseProductOption & {
  itemType: 'plan';
  plan: UpgradePlan;
};

type PurchaseMode = ProductItemType;

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
  revokedAt: string | null;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  redeemedByUserId?: string | null;
  redeemedByEmail?: string | null;
  revokedByUserId?: string | null;
  revokedByEmail?: string | null;
  createdAt?: string;
};

type AdminGiftCard = Required<Pick<GiftCardCard, 'code' | 'type' | 'amountCents' | 'planId' | 'planName' | 'fiveHourTokenLimit' | 'weeklyTokenLimit' | 'planRank' | 'durationMonths' | 'redeemedAt' | 'revokedAt'>> & {
  createdByUserId: string | null;
  createdByEmail: string | null;
  redeemedByUserId: string | null;
  redeemedByEmail: string | null;
  revokedByUserId: string | null;
  revokedByEmail: string | null;
  createdAt: string;
};

type GiftCardPage = {
  giftCards: AdminGiftCard[];
  total: number;
  typeCounts: Record<GiftCardFormType, number>;
  page: number;
  pageSize: number;
};

type TaobaoProductMapping = {
  id: string;
  numIid: string;
  skuId: string | null;
  title: string;
  giftType: 'credit' | 'plan';
  amountCents: number;
  planId: string | null;
  durationMonths: number;
  quantity: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

type TaobaoShop = {
  id: string;
  nick: string;
  sessionExpiresAt: string | null;
  messagePermittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlatformOrder = {
  id: string;
  platform: PurchaseChannelId;
  shopId: string | null;
  orderId: string;
  subOrderId: string;
  buyerNick: string;
  itemId: string;
  skuId: string | null;
  title: string;
  status: string;
  giftCardCode: string | null;
  deliveryStatus: 'pending' | 'ready' | 'claimed' | 'skipped' | 'failed';
  deliveryMessage: string | null;
  claimedAt: string | null;
  claimedByUserId: string | null;
  lastEventAt: string | null;
  createdAt: string;
  updatedAt: string;
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

const creditProducts: CreditProduct[] = [
  { id: '20', amountUsd: 20, priceCents: 599 },
  { id: '50', amountUsd: 50, priceCents: 1199 },
  { id: '100', amountUsd: 100, priceCents: 2199 },
  { id: '200', amountUsd: 200, priceCents: 4699 }
];

const defaultPurchaseLinks: Record<PurchaseChannelId, string> = {
  taobao: 'https://www.taobao.com/',
  xianyu: 'https://www.goofish.com/'
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

function extractErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  if (typeof record.detail === 'string') return record.detail;
  if (typeof record.details === 'string') return record.details;

  if (record.error) {
    const nested = extractErrorMessage(record.error);
    if (nested) return nested;
  }

  if (record.detail) {
    const nested = extractErrorMessage(record.detail);
    if (nested) return nested;
  }

  if (record.details) {
    const nested = extractErrorMessage(record.details);
    if (nested) return nested;
  }

  if (typeof record.invalidMessage === 'string') return record.invalidMessage;

  if (Array.isArray(record.errors)) {
    const messages = record.errors
      .map((entry) => extractErrorMessage(entry))
      .filter((entry) => entry.length > 0);
    if (messages.length > 0) return messages.join(' ');
  }

  const fieldErrors = record.fieldErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const messages = Object.values(fieldErrors as Record<string, unknown>)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    if (messages.length > 0) return messages.join(' ');
  }

  const formErrors = record.formErrors;
  if (Array.isArray(formErrors)) {
    const messages = formErrors.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    if (messages.length > 0) return messages.join(' ');
  }

  return '';
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function responseErrorMessage(response: Response, payload: unknown, fallback: string) {
  const message = extractErrorMessage(payload) || response.statusText || fallback;
  const statusText = response.statusText ? ` ${response.statusText}` : '';
  return `${message} (${response.status}${statusText})`;
}

function unknownErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function tr(t: Record<string, string>, key: string, fallback: string) {
  return t[key] || fallback;
}

type ToastVariant = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastListener = (toast: ToastItem) => void;

const toastListeners = new Set<ToastListener>();
let nextToastId = 0;

function showToast(message: string, variant: ToastVariant = 'info') {
  const text = message.trim();
  if (!text) return;

  const toast: ToastItem = {
    id: Date.now() + nextToastId,
    message: text,
    variant
  };
  nextToastId += 1;
  toastListeners.forEach((listener) => listener(toast));
}

function showErrorToast(message: string) {
  showToast(message, 'error');
}

function showSuccessToast(message: string) {
  showToast(message, 'success');
}

function buildRechargeModalProps(t: Record<string, string>, onClose: () => void) {
  return {
    onClose,
    t,
    officialQqGroupNumber,
    officialQqGroupQrSrc,
    onCopyGroupNumber: async () => {
      await copyTextToClipboard(officialQqGroupNumber);
      showSuccessToast(`${tr(t, 'officialQQGroupNumber', '群号')}已复制`);
    }
  };
}

function ToastViewport() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const listener: ToastListener = (toast) => {
      setToasts((current) => [...current, toast].slice(-4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 4200);
    };

    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.variant}`} role={toast.variant === 'error' ? 'alert' : 'status'} key={toast.id}>
          <span className="toast-mark">
            {toast.variant === 'success' ? <Check size={14} /> : toast.variant === 'error' ? <Ban size={14} /> : <Activity size={14} />}
          </span>
          <p>{toast.message}</p>
          <button type="button" className="toast-close-button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Close notification">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function productLinkUrl(
  productLinks: ProductLink[],
  itemType: ProductItemType,
  itemId: string,
  channel: PurchaseChannelId
) {
  return (
    productLinks.find((link) => link.itemType === itemType && link.itemId === itemId && link.channel === channel)?.url ||
    defaultPurchaseLinks[channel]
  );
}

function planProductOptions(): PlanProductOption[] {
  return upgradePlans.map((plan) => ({
    itemType: 'plan' as const,
    itemId: plan.id,
    name: plan.name,
    priceLabel: `￥${plan.monthlyPriceYuan}`,
    description: plan.subtitle,
    plan
  }));
}

function creditProductOptions() {
  return creditProducts.map((credit) => ({
    itemType: 'credit' as const,
    itemId: credit.id,
    name: `$${credit.amountUsd}`,
    priceLabel: `￥${(credit.priceCents / 100).toFixed(2)}`
  }));
}

function giftPlanProductOptions(plans: Plan[]) {
  const activePlanIds = new Set(plans.filter((plan) => plan.isActive && plan.id !== 'free').map((plan) => plan.id));
  return planProductOptions().filter((option) => activePlanIds.has(option.itemId));
}

function planProductOptionLabel(option: PlanProductOption) {
  return `${option.name} · ${option.description || option.plan.subtitle} · ${option.priceLabel}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function ChevronUpIcon() {
  return <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />;
}

function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement<any> }) {
  const [open, setOpen] = React.useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })]
  });

  const hover = useHover(context, { move: false, delay: { open: 120, close: 80 } });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  const child = React.Children.only(children) as React.ReactElement<any>;

  return (
    <>
      {React.cloneElement(child, {
        ref: refs.setReference,
        ...getReferenceProps(child.props)
      })}
      {open ? (
        <FloatingPortal>
          <div ref={refs.setFloating} style={floatingStyles} className="floating-tooltip" {...getFloatingProps()}>
            {content}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}

const routeTabSegments: Record<Tab, string> = {
  dashboard: 'dashboard',
  keys: 'keys',
  usage: 'usage',
  plans: 'plans',
  orders: 'orders',
  logs: 'logs',
  'gift-cards': 'gift-cards',
  products: 'products',
  channels: 'channels',
  users: 'users',
  'user-detail': 'users',
  guide: 'guide'
};

const routeSegmentTabs = Object.entries(routeTabSegments).reduce<Record<string, Tab>>((map, [tab, segment]) => {
  map[segment] = tab as Tab;
  return map;
}, {});

function resolveRoute(route: string): { tab: Tab; planView: PlanView; userId?: string } {
  const normalizedRoute = route.replace(/^\/+/, '').replace(/\/+$/, '');
  const [segment = '', viewSegment = ''] = normalizedRoute.split('/');
  if (segment === 'taobao-claim' || segment === 'claim-code') {
    return { tab: 'orders', planView: 'billing' };
  }
  if (segment === 'users' && viewSegment) {
    return { tab: 'user-detail', planView: 'billing', userId: decodeURIComponent(viewSegment) };
  }
  const tab = routeSegmentTabs[segment] || 'dashboard';
  return {
    tab,
    planView: tab === 'plans' && viewSegment === 'change' ? 'change' : 'billing'
  };
}

function readHistoryRoute(): { tab: Tab; planView: PlanView; userId?: string } {
  const legacyHashRoute = window.location.hash.match(/^#\/(.+)/)?.[1];
  if (legacyHashRoute) return resolveRoute(legacyHashRoute);
  return resolveRoute(window.location.pathname);
}

function routeToPath(tab: Tab, planView: PlanView, userId?: string | null) {
  if (tab === 'user-detail' && userId) {
    return `/users/${encodeURIComponent(userId)}`;
  }
  const segment = routeTabSegments[tab];
  return tab === 'plans' && planView === 'change' ? `/${segment}/change` : `/${segment}`;
}

function writeHistoryRoute(tab: Tab, planView: PlanView, replace = false, userId?: string | null) {
  const nextPath = routeToPath(tab, planView, userId);
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
    orders: tr(t, 'myOrders', '我的订单'),
    logs: t.usageLogs,
    'gift-cards': tr(t, 'giftCardManagement', '礼品码管理'),
    products: tr(t, 'productManagement', '商品管理'),
    channels: tr(t, 'channelManagement', '渠道管理'),
    users: tr(t, 'userCenter', '用户中心'),
    'user-detail': tr(t, 'userDetail', '用户详情'),
    guide: t.guideTitle
  };

  return pageTitles[tab];
}

function MobileMenuButton({
  isOpen,
  label,
  onClick
}: {
  isOpen: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="mobile-menu-button icon-button"
      aria-controls="app-sidebar"
      aria-expanded={isOpen}
      aria-label={label}
      onClick={onClick}
    >
      <Menu size={18} />
    </button>
  );
}

function AppSidebar({
  activeTab,
  brand,
  closeLabel,
  isOpen,
  nav,
  onClose,
  onNavigate,
  subtitle
}: {
  activeTab: Tab;
  brand: string;
  closeLabel: string;
  isOpen: boolean;
  nav: NavMenuItem[];
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  subtitle: string;
}) {
  return (
    <>
      <button
        type="button"
        className={isOpen ? 'sidebar-scrim is-open' : 'sidebar-scrim'}
        aria-hidden={!isOpen}
        aria-label={closeLabel}
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
      />
      <aside id="app-sidebar" className={isOpen ? 'sidebar is-open' : 'sidebar'}>
        <div className="sidebar-head">
          <div className="brand-block">
            <div className="brand-mark">
              <BrandMark />
            </div>
            <div>
              <h1>{brand}</h1>
              <BrandSubtitle subtitle={subtitle} />
            </div>
          </div>
          <button type="button" className="sidebar-close-button icon-button" aria-label={closeLabel} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <nav className="nav-list">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={activeTab === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function App() {
  const initialRoute = React.useMemo(() => readHistoryRoute(), []);
  const [language, setLanguage] = React.useState<Language>('zh-CN');
  const [activeTab, setActiveTab] = React.useState<Tab>(initialRoute.tab);
  const [planView, setPlanView] = React.useState<PlanView>(initialRoute.planView);
  const [activeUserId, setActiveUserId] = React.useState<string | null>(initialRoute.userId || null);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => readThemeMode());
  const [accentTheme, setAccentTheme] = React.useState<AccentTheme>(() => readAccentTheme());
  const [authToken, setAuthToken] = React.useState(localStorage.getItem('authToken') || '');
  const [data, setData] = React.useState<Bootstrap>(defaultBootstrap);
  const [loading, setLoading] = React.useState(true);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
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
        setLoading(false);
        return;
      }
      const payload = await readJsonResponse(bootstrapRes);
      if (!bootstrapRes.ok) {
        throw new Error(responseErrorMessage(bootstrapRes, payload, t.requestFailed));
      }
      const bootstrap = payload as Bootstrap;
      setData(bootstrap);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [authToken, headers, t.requestFailed]);

  React.useEffect(() => {
    void load();
  }, [load, refreshTick]);

  React.useEffect(() => {
    writeHistoryRoute(activeTab, planView, true, activeUserId);

    function syncRouteFromHistory() {
      const nextRoute = readHistoryRoute();
      setActiveTab(nextRoute.tab);
      setPlanView(nextRoute.planView);
      setActiveUserId(nextRoute.userId || null);
      setIsNavDrawerOpen(false);
    }

    window.addEventListener('popstate', syncRouteFromHistory);
    return () => {
      window.removeEventListener('popstate', syncRouteFromHistory);
    };
  }, [activeTab, activeUserId, planView]);

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

  React.useEffect(() => {
    if (!isNavDrawerOpen) return undefined;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsNavDrawerOpen(false);
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isNavDrawerOpen]);

  function changeThemeMode(nextThemeMode: ThemeMode) {
    setThemeMode(nextThemeMode);
    document.documentElement.dataset.themeMode = resolveThemeMode(nextThemeMode);
  }

  const handleRefresh = React.useCallback(async () => {
    await load();
    setRefreshTick((value) => value + 1);
  }, [load]);

  function logout() {
    localStorage.removeItem('authToken');
    setAuthToken('');
    setData(defaultBootstrap);
    setIsNavDrawerOpen(false);
  }

  const isPlansPage = activeTab === 'plans';
  const pageTitle = activeTab === 'user-detail' ? tr(t, 'userDetail', '用户详情') : getPageTitle(activeTab, planView, t);
  const showPageBackButton = activeTab === 'user-detail' || (activeTab === 'plans' && planView === 'change');
  const nav: NavMenuItem[] = [
    { id: 'dashboard' as const, label: t.dashboard, icon: LayoutDashboard },
    { id: 'keys' as const, label: t.keys, icon: KeyRound },
    { id: 'usage' as const, label: t.usage, icon: BarChart3 },
    { id: 'plans' as const, label: t.plans, icon: CreditCard },
    { id: 'orders' as const, label: tr(t, 'myOrders', '我的订单'), icon: ShoppingBag },
    { id: 'logs' as const, label: t.logs, icon: Activity },
    ...(data.user.role === 'admin' ? [{ id: 'gift-cards' as const, label: tr(t, 'giftCards', '礼品码'), icon: Gift }] : []),
    ...(data.user.role === 'admin' ? [{ id: 'products' as const, label: tr(t, 'productManagement', '商品管理'), icon: ShoppingBag }] : []),
    ...(data.user.role === 'admin' ? [{ id: 'channels' as const, label: tr(t, 'channelManagement', '渠道管理'), icon: Route }] : []),
    ...(data.user.role === 'admin' ? [{ id: 'users' as const, label: tr(t, 'userCenter', '用户中心'), icon: UserRound }] : []),
    { id: 'guide' as const, label: t.guide, icon: GuideMenuIcon }
  ];
  const openMenuLabel = t.openMenu;
  const closeMenuLabel = t.closeMenu;

  React.useEffect(() => {
    if ((activeTab === 'channels' || activeTab === 'gift-cards' || activeTab === 'products' || activeTab === 'users' || activeTab === 'user-detail') && data.user.role !== 'admin') {
      navigate('dashboard');
    }
  }, [activeTab, data.user.role]);

  function navigate(tab: Tab, nextPlanView: PlanView = 'billing', userId?: string | null) {
    setActiveTab(tab);
    setActiveUserId(userId || null);
    setPlanView(tab === 'plans' ? nextPlanView : 'billing');
    setIsNavDrawerOpen(false);
    writeHistoryRoute(tab, tab === 'plans' ? nextPlanView : 'billing', false, userId);
  }

  function openPlanChange() {
    navigate('plans', 'change');
  }

  function changePlanView(nextPlanView: PlanView) {
    setPlanView(nextPlanView);
    writeHistoryRoute('plans', nextPlanView);
  }

  if (!authToken && activeTab === 'guide') {
    return (
      <div className="app-shell public-guide-shell">
        <AppSidebar
          activeTab={activeTab}
          brand={t.brand}
          closeLabel={closeMenuLabel}
          isOpen={isNavDrawerOpen}
          nav={[{ id: 'guide', label: t.guide, icon: GuideMenuIcon }]}
          onClose={() => setIsNavDrawerOpen(false)}
          onNavigate={navigate}
          subtitle={t.subtitle}
        />

        <main className="main-panel">
          <header className="topbar">
            <div className="topbar-title-row">
              <MobileMenuButton
                isOpen={isNavDrawerOpen}
                label={isNavDrawerOpen ? closeMenuLabel : openMenuLabel}
                onClick={() => setIsNavDrawerOpen((isOpen) => !isOpen)}
              />
              <div className="topbar-title">
                <h1>{t.guideTitle}</h1>
              </div>
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
              <button type="button" className="secondary-button" onClick={() => navigate('dashboard')}>
                {t.login}
              </button>
            </div>
          </header>
          <GuidePage t={t} />
        </main>
      </div>
    );
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
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <AppSidebar
        activeTab={activeTab}
        brand={t.brand}
        closeLabel={closeMenuLabel}
        isOpen={isNavDrawerOpen}
        nav={nav}
        onClose={() => setIsNavDrawerOpen(false)}
        onNavigate={navigate}
        subtitle={t.subtitle}
      />

      <main className={isPlansPage ? 'main-panel plans-main-panel' : 'main-panel'}>
        <header className="topbar">
          <div className="topbar-title-row">
            <MobileMenuButton
              isOpen={isNavDrawerOpen}
              label={isNavDrawerOpen ? closeMenuLabel : openMenuLabel}
              onClick={() => setIsNavDrawerOpen((isOpen) => !isOpen)}
            />
              <div className="topbar-title">
                {showPageBackButton ? (
                  <button
                    type="button"
                    className="page-back-button"
                    onClick={() => {
                      if (activeTab === 'user-detail') {
                        navigate('users');
                        return;
                      }
                      navigate('plans', 'billing');
                    }}
                    aria-label={activeTab === 'user-detail' ? '返回用户列表' : t.returnBilling}
                  >
                    <ArrowLeft size={16} />
                  </button>
                ) : null}
                <h1>{pageTitle}</h1>
              </div>
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
            <button type="button" className="icon-button" onClick={() => void handleRefresh()} title={t.refresh}>
              <RefreshCcw size={17} />
            </button>
            <AccountMenu user={data.user} t={t} onLogout={logout} />
          </div>
        </header>
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
        {activeTab === 'orders' ? <OrdersPanel headers={headers} refreshTick={refreshTick} t={t} /> : null}
        {activeTab === 'logs' ? <LogsPanel keys={data.keys} headers={headers} refreshTick={refreshTick} t={t} /> : null}
        {activeTab === 'gift-cards' && data.user.role === 'admin' ? (
          <GiftCardsPanel headers={headers} plans={data.plans} refreshTick={refreshTick} t={t} />
        ) : null}
        {activeTab === 'products' && data.user.role === 'admin' ? (
          <ProductLinksPanel headers={headers} initialProductLinks={data.productLinks} refreshTick={refreshTick} t={t} />
        ) : null}
        {activeTab === 'channels' && data.user.role === 'admin' ? <ChannelsPanel headers={headers} refreshTick={refreshTick} t={t} /> : null}
        {activeTab === 'users' && data.user.role === 'admin' ? <UsersCenterPanel headers={headers} refreshTick={refreshTick} t={t} onOpenUser={(userId) => navigate('user-detail', 'billing', userId)} /> : null}
        {activeTab === 'user-detail' && data.user.role === 'admin' && activeUserId ? <UserDetailPanel headers={headers} userId={activeUserId} onBack={() => navigate('users')} t={t} /> : null}
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
  const [submitting, setSubmitting] = React.useState(false);

  async function authenticate(verifiedToken: string) {
    setSubmitting(true);
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
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        setCaptchaToken('');
        setVerificationResetKey((value) => value + 1);
        return;
      }
      onAuthenticated(payload as AuthSession);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
      setCaptchaToken('');
      setVerificationResetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!captchaToken) {
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

function OrdersPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const [orderId, setOrderId] = React.useState('');
  const [claimResult, setClaimResult] = React.useState<ClaimedOrder[]>([]);
  const [claimedOrders, setClaimedOrders] = React.useState<ClaimedOrder[]>([]);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState('');

  const loadClaimHistory = React.useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/user/orders/claims?days=30', { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setClaimedOrders((payload as { orders: ClaimedOrder[] }).orders || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [headers, t.requestFailed]);

  React.useEffect(() => {
    void loadClaimHistory();
  }, [loadClaimHistory, refreshTick]);

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    setIsClaiming(true);
    setClaimResult([]);
    try {
      const response = await fetch('/api/user/orders/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setClaimResult((payload as { orders: ClaimedOrder[] }).orders || []);
      showSuccessToast(tr(t, 'claimSuccess', '兑换码已领取。'));
      await loadClaimHistory();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsClaiming(false);
    }
  }

  async function copyCodes(orders: ClaimedOrder[], key: string) {
    const codes = orders.map((order) => order.giftCardCode).filter(Boolean).join('\n');
    if (!codes) return;
    await copyTextToClipboard(codes);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1400);
  }

  function orderKey(order: ClaimedOrder) {
    return `${order.platform}:${order.orderId}:${order.subOrderId}`;
  }

  function statusLabel(status: ClaimedOrder['deliveryStatus']) {
    return tr(t, `deliveryStatus_${status}`, status);
  }

  return (
    <div className="orders-panel">
      <section className="table-panel">
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'claimOrderTitle', '订单取码')}</h2>
            <p>{tr(t, 'claimOrderHint', '输入已付款订单号，领取系统自动生成的兑换码。')}</p>
          </div>
        </div>
        <form className="claim-form" onSubmit={claim}>
          <input
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder={tr(t, 'orderNumberPlaceholder', '请输入订单号')}
            aria-label={tr(t, 'orderNumber', '订单号')}
            required
          />
          <button type="submit" className="primary-button" disabled={isClaiming || !orderId.trim()}>
            {isClaiming ? tr(t, 'verifying', '验证中...') : tr(t, 'claimOrderCode', '领取兑换码')}
          </button>
        </form>
        {claimResult.length ? (
          <div className="claim-result">
            <div className="generated-gift-cards-head">
              <strong>{tr(t, 'giftCards', '礼品码')}</strong>
              <button type="button" className="secondary-button" onClick={() => void copyCodes(claimResult, 'claim-result')}>
                {copiedKey === 'claim-result' ? <Check size={15} /> : <Copy size={15} />}
                {copiedKey === 'claim-result' ? tr(t, 'copiedCodes', '已复制兑换码') : tr(t, 'copyCodes', '复制兑换码')}
              </button>
            </div>
            {claimResult.map((order) => (
              <article className="claim-code-row" key={orderKey(order)}>
                <span>{order.title || order.subOrderId}</span>
                <code>{order.giftCardCode}</code>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="table-panel">
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'claimRecordTitle', '领取记录')}</h2>
            <p>{tr(t, 'claimRecordHint', '仅展示近 30 天内由当前账号领取的订单。')}</p>
          </div>
          <button type="button" className="secondary-button" onClick={() => void loadClaimHistory()}>
            <RefreshCcw size={16} />
            {t.refresh}
          </button>
        </div>
        {isLoadingHistory ? <div className="loading-line" /> : null}
        {claimedOrders.length ? (
          <div className="order-history-table">
            <div className="order-history-head">
              <span>{tr(t, 'orderNumber', '订单号')}</span>
              <span>{tr(t, 'taobao', '淘宝')}</span>
              <span>{tr(t, 'orderItem', '商品')}</span>
              <span>{tr(t, 'giftCards', '礼品码')}</span>
              <span>{tr(t, 'claimTime', '领取时间')}</span>
              <span>{t.status}</span>
              <span>{t.copy}</span>
            </div>
            {claimedOrders.map((order) => {
              const key = orderKey(order);
              return (
                <article className="order-history-row" key={key}>
                  <strong>{order.orderId}</strong>
                  <span>{t[order.platform] || order.platform}</span>
                  <span>{order.title || order.subOrderId}</span>
                  <code>{order.giftCardCode || '-'}</code>
                  <span>{order.claimedAt ? fullDate(order.claimedAt) : '-'}</span>
                  <span className={order.deliveryStatus === 'claimed' ? 'status-code ok' : 'status-code'}>
                    {statusLabel(order.deliveryStatus)}
                  </span>
                  <button type="button" className="icon-button" onClick={() => void copyCodes([order], key)} title={t.copy}>
                    {copiedKey === key ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty t={t} />
        )}
      </section>
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
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.verificationFailed));
        return;
      }
      setChallenge(payload as SliderChallenge);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.verificationFailed));
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
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.verificationFailed));
        setStatus(t.slideToVerify);
        setValue(0);
        onTokenChange('');
        void loadChallenge();
        return;
      }
      setIsVerified(true);
      setValue(nextValue);
      setStatus(t.verified);
      onTokenChange((payload as { captchaToken?: string }).captchaToken || '');
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.verificationFailed));
      setStatus(t.slideToVerify);
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
          <p>{tr(t, 'todayCacheReuseHint', '按今日全部请求汇总计算')} · {t.cacheHit}: {tokenK(data.summary.todayCacheReadInputTokens)}</p>
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
        <RechargeModal {...buildRechargeModalProps(t, () => setIsRechargeOpen(false))} />
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
        <RechargeModal {...buildRechargeModalProps(t, () => setIsRechargeOpen(false))} />
      ) : null}
    </section>
  );
}

function GuidePage({ t }: { t: Record<string, string> }) {
  const [selectedAgent, setSelectedAgent] = React.useState<GuideAgentId>('claude-code');
  const [selectedOs, setSelectedOs] = React.useState<GuideOsId>('macos');
  const [markdown, setMarkdown] = React.useState('');
  const [loading, setLoading] = React.useState(true);
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
    setMarkdown('');

    fetch(documentSrc, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(t.guideLoadError);
        return response.text();
      })
      .then((content) => setMarkdown(content))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        showErrorToast(error instanceof Error ? error.message : t.guideLoadError);
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch('/api/user/keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setIsCreateOpen(false);
      setName('');
      await reload();
      showSuccessToast(t.createdKeySuccess);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function fetchSecret(id: string): Promise<KeySecret | null> {
    try {
      const response = await fetch(`/api/user/keys/${id}/secret`, { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.keyUnavailable));
        return null;
      }
      return payload as KeySecret;
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
      return null;
    }
  }

  async function revoke(apiKey: ApiKey) {
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/user/keys/${apiKey.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setRevokeTarget(null);
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRevoking(false);
    }
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

type GiftCardFormType = 'plan' | 'credit';

function GiftCardsPanel({ headers, plans, refreshTick, t }: { headers: HeadersInit; plans: Plan[]; refreshTick: number; t: Record<string, string> }) {
  const eligiblePlans = React.useMemo(() => giftPlanProductOptions(plans), [plans]);
  const defaultPlanId = eligiblePlans[0]?.itemId || '';
  const [giftCardPage, setGiftCardPage] = React.useState<GiftCardPage>({
    giftCards: [],
    total: 0,
    typeCounts: { plan: 0, credit: 0 },
    page: 1,
    pageSize: 20
  });
  const [generatedCards, setGeneratedCards] = React.useState<AdminGiftCard[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState('');
  const [revokeTarget, setRevokeTarget] = React.useState<AdminGiftCard | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [isGiftCardManagementExpanded, setIsGiftCardManagementExpanded] = React.useState(true);
  const [activeGiftCardType, setActiveGiftCardType] = React.useState<GiftCardFormType>('plan');
  const [giftCardPageNumber, setGiftCardPageNumber] = React.useState(1);
  const [formType, setFormType] = React.useState<GiftCardFormType>('plan');
  const [planId, setPlanId] = React.useState(defaultPlanId);
  const [amountYuan, setAmountYuan] = React.useState('100');
  const [durationMonths, setDurationMonths] = React.useState(1);
  const [quantity, setQuantity] = React.useState(1);
  const [prefix, setPrefix] = React.useState('RH');

  React.useEffect(() => {
    if (!planId && defaultPlanId) setPlanId(defaultPlanId);
  }, [defaultPlanId, planId]);

  const loadGiftCards = React.useCallback(async (nextPage = giftCardPageNumber, nextType = activeGiftCardType) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: nextType,
        page: String(nextPage),
        pageSize: '20'
      });
      const response = await fetch(`/api/gift-cards?${params.toString()}`, { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const result = payload as GiftCardPage;
      setGiftCardPage({
        giftCards: result.giftCards || [],
        total: result.total || 0,
        typeCounts: result.typeCounts || { plan: 0, credit: 0 },
        page: result.page || nextPage,
        pageSize: result.pageSize || 20
      });
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [activeGiftCardType, giftCardPageNumber, headers, t.requestFailed]);

  React.useEffect(() => {
    void loadGiftCards();
  }, [loadGiftCards, refreshTick]);

  function openCreate(nextType: GiftCardFormType = formType) {
    setFormType(nextType);
    setPlanId((current) => current || defaultPlanId);
    setGeneratedCards([]);
    setIsCreateOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body =
      formType === 'credit'
        ? {
            type: 'credit',
            amountCents: Math.max(1, Math.round(Number(amountYuan || 0) * 100)),
            quantity,
            prefix
          }
        : {
            type: 'plan',
            planId,
            durationMonths,
            quantity,
            prefix
          };

    try {
      const response = await fetch('/api/gift-cards', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const result = payload as { giftCards: AdminGiftCard[] };
      setGeneratedCards(result.giftCards || []);
      setActiveGiftCardType(formType);
      setGiftCardPageNumber(1);
      await loadGiftCards(1, formType);
      showSuccessToast(tr(t, 'giftCardsCreated', '礼品码已生成。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function copyCode(code: string) {
    await copyTextToClipboard(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(''), 1400);
  }

  async function copyGeneratedCodes() {
    if (!generatedCards.length) return;
    await copyTextToClipboard(generatedCards.map((card) => card.code).join('\n'));
    setCopiedCode('__generated__');
    window.setTimeout(() => setCopiedCode(''), 1400);
  }

  async function revokeGiftCard(card: AdminGiftCard) {
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/gift-cards/${encodeURIComponent(card.code)}/revoke`, {
        method: 'PATCH',
        headers
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setRevokeTarget(null);
      await loadGiftCards();
      showSuccessToast(tr(t, 'giftCardRevoked', '兑换码已撤销。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRevoking(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(giftCardPage.total / giftCardPage.pageSize));
  const planGiftCardCount = giftCardPage.typeCounts.plan || 0;
  const creditGiftCardCount = giftCardPage.typeCounts.credit || 0;

  function changeGiftCardType(nextType: GiftCardFormType) {
    setActiveGiftCardType(nextType);
    setGiftCardPageNumber(1);
  }

  return (
    <section className="content-grid">
      <section className="table-panel collapsible-panel">
        <div className="section-heading">
          <div>
            <div className="channel-title-row">
              <button
                type="button"
                className="channel-toggle-button"
                onClick={() => setIsGiftCardManagementExpanded((value) => !value)}
                aria-expanded={isGiftCardManagementExpanded}
                title={isGiftCardManagementExpanded ? t.collapse : t.expand}
              >
                <ChevronDown size={16} className={isGiftCardManagementExpanded ? 'rotate-icon open' : 'rotate-icon'} />
              </button>
              <h2>{tr(t, 'giftCardManagement', '礼品码管理')}</h2>
            </div>
            <p>{tr(t, 'giftCardManagementHint', '创建套餐卡或余额卡，复制生成的卡密后发放给用户兑换。')}</p>
          </div>
          <button type="button" className="primary-button" onClick={() => openCreate()}>
            <Plus size={17} />
            {tr(t, 'createGiftCard', '生成礼品码')}
          </button>
        </div>
        {isGiftCardManagementExpanded ? (
          <div className="collapsible-panel-body">
            {loading ? <div className="loading-line" /> : null}
            <div className="gift-card-tabs" role="tablist" aria-label={tr(t, 'giftCardType', '礼品卡类型')}>
              <button
                type="button"
                className={activeGiftCardType === 'plan' ? 'gift-card-tab active' : 'gift-card-tab'}
                onClick={() => changeGiftCardType('plan')}
              >
                {tr(t, 'giftCardPlanType', '套餐')}
                <span>{planGiftCardCount}</span>
              </button>
              <button
                type="button"
                className={activeGiftCardType === 'credit' ? 'gift-card-tab active' : 'gift-card-tab'}
                onClick={() => changeGiftCardType('credit')}
              >
                {tr(t, 'giftCardCreditType', '余额')}
                <span>{creditGiftCardCount}</span>
              </button>
            </div>
            <GiftCardRows
              giftCards={giftCardPage.giftCards}
              copiedCode={copiedCode}
              onCopy={copyCode}
              onRequestRevoke={setRevokeTarget}
              t={t}
            />
            <div className="pagination-bar">
              <span>{tr(t, 'giftCardTotal', '共 {total} 个礼品码').replace('{total}', String(giftCardPage.total))}</span>
              <div>
                <button
                  type="button"
                  className="icon-button compact"
                  onClick={() => setGiftCardPageNumber((value) => value - 1)}
                  disabled={giftCardPageNumber <= 1}
                  title={t.previousPage}
                >
                  <ChevronLeft size={16} />
                </button>
                <strong>
                  {giftCardPageNumber} / {pageCount}
                </strong>
                <button
                  type="button"
                  className="icon-button compact"
                  onClick={() => setGiftCardPageNumber((value) => value + 1)}
                  disabled={giftCardPageNumber >= pageCount}
                  title={t.nextPage}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
      <TaobaoAutomationPanel headers={headers} plans={eligiblePlans} refreshTick={refreshTick} t={t} />

      {isCreateOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel gift-card-create-panel" onSubmit={submit}>
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'createGiftCard', '生成礼品码')}</h2>
                <p>{formType === 'plan' ? tr(t, 'giftCardPlanType', '套餐') : tr(t, 'giftCardCreditType', '余额')}</p>
              </div>
            </div>
            <label>
              {tr(t, 'giftCardType', '礼品卡类型')}
              <div className="agent-options gift-card-type-options" role="radiogroup" aria-label={tr(t, 'giftCardType', '礼品卡类型')}>
                <button
                  type="button"
                  className={formType === 'plan' ? 'agent-option active' : 'agent-option'}
                  onClick={() => setFormType('plan')}
                >
                  {tr(t, 'giftCardPlanType', '套餐')}
                </button>
                <button
                  type="button"
                  className={formType === 'credit' ? 'agent-option active' : 'agent-option'}
                  onClick={() => setFormType('credit')}
                >
                  {tr(t, 'giftCardCreditType', '余额')}
                </button>
              </div>
            </label>
            {formType === 'plan' ? (
              <>
                <label>
                  {t.plan}
                  <select value={planId} onChange={(event) => setPlanId(event.target.value)} required>
                    {eligiblePlans.map((plan) => (
                      <option value={plan.itemId} key={plan.itemId}>
                        {planProductOptionLabel(plan)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr(t, 'giftCardDuration', '有效月份')}
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={durationMonths}
                    onChange={(event) => setDurationMonths(Number(event.target.value))}
                    required
                  />
                </label>
              </>
            ) : (
              <label>
                {tr(t, 'giftCardAmount', '余额金额')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountYuan}
                  onChange={(event) => setAmountYuan(event.target.value)}
                  required
                />
              </label>
            )}
            <div className="gift-card-form-grid">
              <label>
                {tr(t, 'giftCardQuantity', '生成数量')}
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  required
                />
              </label>
              <label>
                {tr(t, 'giftCardPrefix', '卡密前缀')}
                <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="RH" />
              </label>
            </div>
            {generatedCards.length ? (
              <div className="generated-gift-cards">
                <div className="generated-gift-cards-head">
                  <strong>{tr(t, 'generatedGiftCards', '本次生成')}</strong>
                  <button type="button" className="secondary-button" onClick={copyGeneratedCodes}>
                    {copiedCode === '__generated__' ? <Check size={15} /> : <Copy size={15} />}
                    {t.copy}
                  </button>
                </div>
                <div className="generated-code-list">
                  {generatedCards.map((card) => (
                    <code key={card.code}>{card.code}</code>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setIsCreateOpen(false)}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button" disabled={formType === 'plan' && !eligiblePlans.length}>
                <Gift size={16} />
                {tr(t, 'createGiftCard', '生成礼品码')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {revokeTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel">
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'revokeGiftCard', '撤销兑换码')}</h2>
                <p>{revokeTarget.code}</p>
              </div>
            </div>
            <p className="modal-copy">{tr(t, 'revokeGiftCardConfirm', '确认撤销这个未使用的兑换码？撤销后用户将无法兑换。')}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setRevokeTarget(null)} disabled={isRevoking}>
                {t.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => revokeGiftCard(revokeTarget)} disabled={isRevoking}>
                <Ban size={16} />
                {tr(t, 'revokeGiftCard', '撤销兑换码')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GiftCardRows({
  giftCards,
  copiedCode,
  onCopy,
  onRequestRevoke,
  t
}: {
  giftCards: AdminGiftCard[];
  copiedCode: string;
  onCopy: (code: string) => Promise<void>;
  onRequestRevoke: (card: AdminGiftCard) => void;
  t: Record<string, string>;
}) {
  if (!giftCards.length) return <Empty t={t} />;

  return (
    <div className="gift-card-table">
      <div className="gift-card-table-head">
        <span>{t.keyValue}</span>
        <span>{tr(t, 'giftCardType', '礼品卡类型')}</span>
        <span>{t.plan}</span>
        <span>{tr(t, 'giftCardAmount', '余额金额')}</span>
        <span>{t.status}</span>
        <span>{tr(t, 'createdBy', '创建人')}</span>
        <span>{tr(t, 'redeemedBy', '使用人')}</span>
        <span>{t.createdAt}</span>
        <span>{t.action}</span>
      </div>
      {giftCards.map((card) => (
        <article className="gift-card-row" key={card.code}>
          <div className="key-secret-cell">
            <code>{card.code}</code>
            <button type="button" className="icon-button compact" onClick={() => onCopy(card.code)} title={t.copy}>
              {copiedCode === card.code ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <span>{card.type === 'plan' ? tr(t, 'giftCardPlanType', '套餐') : tr(t, 'giftCardCreditType', '余额')}</span>
          <div className="gift-card-plan-cell">
            <strong>{card.planName || '-'}</strong>
            {card.type === 'plan' ? (
              <small>
                {card.durationMonths} {tr(t, 'giftCardDuration', '有效月份')} · {currency(card.fiveHourTokenLimit, 'USD')} / 5h
              </small>
            ) : null}
          </div>
          <span>{card.type === 'credit' ? currency(card.amountCents, 'CNY') : '-'}</span>
          <div className="gift-card-status-cell">
            <span className={card.revokedAt ? 'status-pill danger' : card.redeemedAt ? 'status-pill warn' : 'status-pill'}>
              {card.revokedAt ? tr(t, 'revoked', '已撤销') : card.redeemedAt ? tr(t, 'redeemed', '已兑换') : tr(t, 'unredeemed', '未兑换')}
            </span>
            {card.revokedAt ? (
              <small>
                {tr(t, 'revokedBy', '撤销人')}: {card.revokedByEmail || card.revokedByUserId || '-'}
              </small>
            ) : null}
          </div>
          <span>{card.createdByEmail || card.createdByUserId || '-'}</span>
          <span>{card.redeemedByEmail || card.redeemedByUserId || '-'}</span>
          <span>{card.createdAt ? fullDate(card.createdAt) : '-'}</span>
          <div className="row-actions">
            <button type="button" className="icon-button compact" onClick={() => onCopy(card.code)} title={t.copy} aria-label={t.copy}>
              {copiedCode === card.code ? <Check size={15} /> : <Copy size={15} />}
            </button>
            {!card.redeemedAt && !card.revokedAt ? (
              <button
                type="button"
                className="icon-button danger compact"
                onClick={() => onRequestRevoke(card)}
                title={tr(t, 'revokeGiftCard', '撤销兑换码')}
                aria-label={tr(t, 'revokeGiftCard', '撤销兑换码')}
              >
                <Ban size={15} />
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function TaobaoAutomationPanel({ headers, plans, refreshTick, t }: { headers: HeadersInit; plans: PlanProductOption[]; refreshTick: number; t: Record<string, string> }) {
  const [shops, setShops] = React.useState<TaobaoShop[]>([]);
  const [mappings, setMappings] = React.useState<TaobaoProductMapping[]>([]);
  const [orders, setOrders] = React.useState<PlatformOrder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [shopId, setShopId] = React.useState('');
  const [shopNick, setShopNick] = React.useState('');
  const [sessionKey, setSessionKey] = React.useState('');
  const [sessionExpiresAt, setSessionExpiresAt] = React.useState('');
  const [permitShopId, setPermitShopId] = React.useState('');
  const [authorizingTaobao, setAuthorizingTaobao] = React.useState(false);
  const taobaoProducts = React.useMemo<PurchaseProductOption[]>(() => [...plans, ...creditProductOptions()], [plans]);
  const [selectedProductKey, setSelectedProductKey] = React.useState(() => {
    const first = plans[0] || creditProductOptions()[0];
    return first ? `${first.itemType}:${first.itemId}` : '';
  });
  const [giftType, setGiftType] = React.useState<GiftCardFormType>('plan');
  const [numIid, setNumIid] = React.useState('');
  const [skuId, setSkuId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [planId, setPlanId] = React.useState(plans[0]?.itemId || '');
  const [amountYuan, setAmountYuan] = React.useState('100');
  const [durationMonths, setDurationMonths] = React.useState(1);
  const [quantity, setQuantity] = React.useState(1);

  React.useEffect(() => {
    if (!planId && plans[0]?.itemId) setPlanId(plans[0].itemId);
  }, [planId, plans]);

  const selectedProduct = taobaoProducts.find((product) => `${product.itemType}:${product.itemId}` === selectedProductKey) || taobaoProducts[0];

  React.useEffect(() => {
    if (!selectedProduct && taobaoProducts[0]) {
      setSelectedProductKey(`${taobaoProducts[0].itemType}:${taobaoProducts[0].itemId}`);
      return;
    }
    if (!selectedProduct) return;
    setGiftType(selectedProduct.itemType);
    if (selectedProduct.itemType === 'plan') {
      setPlanId(selectedProduct.itemId);
    } else {
      setAmountYuan(selectedProduct.itemId);
    }
    setTitle((current) => current || selectedProduct.name);
  }, [selectedProduct, taobaoProducts]);

  function selectTaobaoProduct(product: PurchaseProductOption) {
    setSelectedProductKey(`${product.itemType}:${product.itemId}`);
    setGiftType(product.itemType);
    setTitle(product.name);
    if (product.itemType === 'plan') {
      setPlanId(product.itemId);
    } else {
      setAmountYuan(product.itemId);
    }
  }

  function mappingProductLabel(mapping: TaobaoProductMapping) {
    if (mapping.giftType === 'plan') {
      const option = plans.find((plan) => plan.itemId === mapping.planId);
      return option ? option.name : mapping.planId || '-';
    }
    return currency(mapping.amountCents, 'CNY');
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [shopRes, mappingRes, orderRes] = await Promise.all([
        fetch('/api/taobao/shops', { headers }),
        fetch('/api/taobao/product-mappings', { headers }),
        fetch('/api/taobao/orders?limit=50', { headers })
      ]);
      const shopPayload = await readJsonResponse(shopRes);
      const mappingPayload = await readJsonResponse(mappingRes);
      const orderPayload = await readJsonResponse(orderRes);
      if (!shopRes.ok) throw new Error(responseErrorMessage(shopRes, shopPayload, t.requestFailed));
      if (!mappingRes.ok) throw new Error(responseErrorMessage(mappingRes, mappingPayload, t.requestFailed));
      if (!orderRes.ok) throw new Error(responseErrorMessage(orderRes, orderPayload, t.requestFailed));
      const nextShops = (shopPayload as { shops: TaobaoShop[] }).shops || [];
      setShops(nextShops);
      setPermitShopId((current) => current || nextShops[0]?.id || '');
      setMappings((mappingPayload as { mappings: TaobaoProductMapping[] }).mappings || []);
      setOrders((orderPayload as { orders: PlatformOrder[] }).orders || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [headers, t.requestFailed]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    function handleTaobaoOauthMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || typeof payload !== 'object' || payload.type !== 'taobao-oauth-complete') return;
      setAuthorizingTaobao(false);
      if (payload.ok) {
        showSuccessToast(typeof payload.title === 'string' ? payload.title : '淘宝店铺授权已保存。');
        void load();
        return;
      }
      showErrorToast(typeof payload.detail === 'string' ? payload.detail : '淘宝授权失败。');
    }

    window.addEventListener('message', handleTaobaoOauthMessage);
    return () => window.removeEventListener('message', handleTaobaoOauthMessage);
  }, [load]);

  async function saveShop(event: React.FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch('/api/taobao/shops', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: shopId,
          nick: shopNick,
          sessionKey,
          sessionExpiresAt: sessionExpiresAt || null
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const nextShops = (payload as { shops: TaobaoShop[] }).shops || [];
      setShops(nextShops);
      setPermitShopId(shopId || nextShops[0]?.id || '');
      setShopId('');
      setShopNick('');
      setSessionKey('');
      setSessionExpiresAt('');
      showSuccessToast(tr(t, 'taobaoShopSaved', '淘宝店铺授权已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function startTaobaoOauth() {
    try {
      setAuthorizingTaobao(true);
      const response = await fetch('/api/taobao/oauth/start', { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        setAuthorizingTaobao(false);
        return;
      }
      const authorizeUrl = (payload as { authorizeUrl?: string }).authorizeUrl;
      if (!authorizeUrl) throw new Error('获取淘宝授权链接失败。');
      const popup = window.open(authorizeUrl, 'taobao-oauth', 'width=720,height=760');
      if (!popup) throw new Error('浏览器拦截了授权窗口，请允许弹窗后重试。');
    } catch (error) {
      setAuthorizingTaobao(false);
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function permitMessages(targetShopId = permitShopId) {
    if (!targetShopId) return;
    try {
      const response = await fetch(`/api/taobao/shops/${encodeURIComponent(targetShopId)}/permit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setShops((payload as { shops: TaobaoShop[] }).shops || []);
      showSuccessToast(tr(t, 'taobaoPermitSaved', '淘宝 TMC 消息服务已开通。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function saveMapping(event: React.FormEvent) {
    event.preventDefault();
    const body =
      giftType === 'credit'
        ? {
            numIid,
            skuId: skuId || null,
            title,
            giftType: 'credit',
            amountCents: Math.max(1, Math.round(Number(amountYuan || 0) * 100)),
            quantity,
            isActive: true
          }
        : {
            numIid,
            skuId: skuId || null,
            title,
            giftType: 'plan',
            planId,
            durationMonths,
            quantity,
            isActive: true
          };
    try {
      const response = await fetch('/api/taobao/product-mappings', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setMappings((payload as { mappings: TaobaoProductMapping[] }).mappings || []);
      setNumIid('');
      setSkuId('');
      setTitle('');
      showSuccessToast(tr(t, 'taobaoMappingSaved', '淘宝商品映射已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function deleteMapping(mapping: TaobaoProductMapping) {
    try {
      const response = await fetch(`/api/taobao/product-mappings/${mapping.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setMappings((payload as { mappings: TaobaoProductMapping[] }).mappings || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  return (
    <section className="table-panel taobao-automation-panel collapsible-panel">
      <div className="section-heading">
        <div>
          <div className="channel-title-row">
            <button
              type="button"
              className="channel-toggle-button"
              onClick={() => setIsExpanded((value) => !value)}
              aria-expanded={isExpanded}
              title={isExpanded ? t.collapse : t.expand}
            >
              <ChevronDown size={16} className={isExpanded ? 'rotate-icon open' : 'rotate-icon'} />
            </button>
            <h2>{tr(t, 'taobaoAutomation', '淘宝自动发码')}</h2>
          </div>
          <p>{tr(t, 'taobaoAutomationHint', 'TMC 消息触发后按商品/SKU 映射自动生成兑换码，买家登录后可到「我的订单」自助领取。')}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void load()}>
          <RefreshCcw size={16} />
          {t.refresh}
        </button>
      </div>
      {isExpanded ? (
        <div className="collapsible-panel-body">
          {loading ? <div className="loading-line" /> : null}
          <div className="taobao-split-grid">
            <form className="taobao-mapping-form taobao-shop-form" onSubmit={saveShop}>
              <div className="taobao-permit-panel taobao-oauth-panel">
                <div>
                  <h3>授权淘宝店铺</h3>
                  <p>推荐直接跳转淘宝授权，系统会自动写入 SessionKey 和过期时间。</p>
                </div>
                <button type="button" className="secondary-button taobao-oauth-button" onClick={() => void startTaobaoOauth()} disabled={authorizingTaobao}>
                  <KeyRound size={16} />
                  {authorizingTaobao ? '等待淘宝授权…' : '点击授权淘宝店铺'}
                </button>
              </div>
              <label>
                店铺 ID
                <input value={shopId} onChange={(event) => setShopId(event.target.value)} required />
              </label>
              <label>
                店铺昵称
                <input value={shopNick} onChange={(event) => setShopNick(event.target.value)} placeholder={tr(t, 'optional', '可选')} />
              </label>
              <label>
                Session Key
                <input value={sessionKey} onChange={(event) => setSessionKey(event.target.value)} required />
              </label>
              <label>
                过期时间
                <input type="datetime-local" value={sessionExpiresAt} onChange={(event) => setSessionExpiresAt(event.target.value)} />
              </label>
              <button type="submit" className="primary-button">
                <KeyRound size={16} />
                保存授权
              </button>
            </form>

            <div className="taobao-permit-panel">
              <div>
                <h3>{tr(t, 'taobaoShopPermit', '店铺消息服务')}</h3>
                <p>{tr(t, 'taobaoShopPermitHint', '保存店铺 Session 后开通 TMC，淘宝付款消息会触发自动生成兑换码。')}</p>
              </div>
              <div className="taobao-permit-row">
                <select value={permitShopId} onChange={(event) => setPermitShopId(event.target.value)}>
                  <option value="">{tr(t, 'selectShop', '选择店铺')}</option>
                  {shops.map((shop) => (
                    <option value={shop.id} key={shop.id}>
                      {shop.nick || shop.id}
                    </option>
                  ))}
                </select>
                <button type="button" className="secondary-button" disabled={!permitShopId} onClick={() => void permitMessages()}>
                  <ShieldCheck size={16} />
                  开通 TMC
                </button>
              </div>
            </div>
          </div>
          <form className="taobao-mapping-form" onSubmit={saveMapping}>
            <div className="taobao-product-picker">
              <span>{tr(t, 'purchaseProductTitle', '选择商品')}</span>
              <div className="taobao-product-grid">
                {taobaoProducts.map((product) => {
                  const productKey = `${product.itemType}:${product.itemId}`;
                  return (
                    <button
                      type="button"
                      className={selectedProductKey === productKey ? 'taobao-product-card active' : 'taobao-product-card'}
                      key={productKey}
                      onClick={() => selectTaobaoProduct(product)}
                    >
                      <strong>{product.name}</strong>
                      <span>{product.itemType === 'plan' ? tr(t, 'giftCardPlanType', '套餐') : tr(t, 'giftCardCreditType', '余额')}</span>
                      <small>{product.description || product.priceLabel}</small>
                    </button>
                  );
                })}
              </div>
            </div>
            <label>
              淘宝商品 ID
              <input value={numIid} onChange={(event) => setNumIid(event.target.value)} required />
            </label>
            <label>
              SKU ID
              <input value={skuId} onChange={(event) => setSkuId(event.target.value)} placeholder={tr(t, 'optional', '可选')} />
            </label>
            <label>
              {t.description}
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              {tr(t, 'giftCardType', '礼品卡类型')}
              <select value={giftType} onChange={(event) => setGiftType(event.target.value as GiftCardFormType)}>
                <option value="plan">{tr(t, 'giftCardPlanType', '套餐')}</option>
                <option value="credit">{tr(t, 'giftCardCreditType', '余额')}</option>
              </select>
            </label>
            {giftType === 'plan' ? (
              <>
                <label>
                  {t.plan}
                  <select value={planId} onChange={(event) => setPlanId(event.target.value)} required>
                    {plans.map((plan) => (
                      <option value={plan.itemId} key={plan.itemId}>
                        {planProductOptionLabel(plan)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr(t, 'giftCardDuration', '有效月份')}
                  <input type="number" min="1" max="36" value={durationMonths} onChange={(event) => setDurationMonths(Number(event.target.value))} />
                </label>
              </>
            ) : (
              <label>
                {tr(t, 'giftCardAmount', '余额金额')}
                <input type="number" min="0.01" step="0.01" value={amountYuan} onChange={(event) => setAmountYuan(event.target.value)} />
              </label>
            )}
            <label>
              {tr(t, 'giftCardQuantity', '生成数量')}
              <input type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <button type="submit" className="primary-button">
              <Plus size={16} />
              {tr(t, 'saveMapping', '保存映射')}
            </button>
          </form>

          <div className="taobao-split-grid">
            <div>
              <h3>{tr(t, 'taobaoShops', '已授权店铺')}</h3>
              <div className="taobao-mini-list">
                {shops.length ? shops.map((shop) => (
                  <article className="taobao-mini-row taobao-shop-row" key={shop.id}>
                    <div>
                      <strong>{shop.nick || shop.id}</strong>
                      <span>{shop.id}</span>
                    </div>
                    <span>{shop.sessionExpiresAt ? fullDate(shop.sessionExpiresAt) : '-'}</span>
                    <span className={shop.messagePermittedAt ? 'status-code ok' : 'status-code error'}>
                      {shop.messagePermittedAt ? 'TMC' : '未开通'}
                    </span>
                    <button type="button" className="secondary-button" onClick={() => void permitMessages(shop.id)}>
                      <ShieldCheck size={15} />
                      TMC
                    </button>
                  </article>
                )) : <Empty t={t} />}
              </div>
            </div>
            <div>
              <h3>{tr(t, 'taobaoMappings', '商品映射')}</h3>
              <div className="taobao-mini-list">
                {mappings.length ? mappings.map((mapping) => (
                  <article className="taobao-mini-row" key={mapping.id}>
                    <div>
                      <strong>{mapping.title || mappingProductLabel(mapping)}</strong>
                      <span>淘宝商品 {mapping.numIid}{mapping.skuId ? ` / SKU ${mapping.skuId}` : ''}</span>
                    </div>
                    <span>{mappingProductLabel(mapping)}</span>
                    <button type="button" className="icon-button danger" onClick={() => deleteMapping(mapping)} title={t.delete}>
                      <Trash2 size={15} />
                    </button>
                  </article>
                )) : <Empty t={t} />}
              </div>
            </div>
          </div>

          <div className="taobao-split-grid">
            <div>
              <h3>{tr(t, 'taobaoRecentOrders', '最近订单')}</h3>
              <div className="taobao-mini-list">
                {orders.length ? orders.map((order) => (
                  <article className="taobao-mini-row" key={order.id}>
                    <div>
                      <strong>{order.orderId}</strong>
                      <span>{order.title || order.itemId}</span>
                    </div>
                    <span className={order.deliveryStatus === 'ready' || order.deliveryStatus === 'claimed' ? 'status-code ok' : 'status-code error'}>
                      {order.deliveryStatus}
                    </span>
                    <code>{order.giftCardCode || '-'}</code>
                  </article>
                )) : <Empty t={t} />}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ProductLinksPanel({
  headers,
  initialProductLinks,
  refreshTick,
  t
}: {
  headers: HeadersInit;
  initialProductLinks: ProductLink[];
  refreshTick: number;
  t: Record<string, string>;
}) {
  const productRows = React.useMemo(() => [...planProductOptions(), ...creditProductOptions()], []);
  const [formLinks, setFormLinks] = React.useState<Record<string, string>>(() =>
    buildProductLinkForm(productRows, initialProductLinks)
  );
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setFormLinks(buildProductLinkForm(productRows, initialProductLinks));
  }, [initialProductLinks, productRows]);

  const loadProductLinks = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/product-links', { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const nextLinks = (payload as { productLinks: ProductLink[] }).productLinks || [];
      setFormLinks(buildProductLinkForm(productRows, nextLinks));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [headers, productRows, t.requestFailed]);

  React.useEffect(() => {
    void loadProductLinks();
  }, [loadProductLinks, refreshTick]);

  function updateUrl(option: PurchaseProductOption, channel: PurchaseChannelId, value: string) {
    setFormLinks((current) => ({
      ...current,
      [productLinkFormKey(option.itemType, option.itemId, channel)]: value
    }));
  }

  async function saveProductLinks(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const body = {
      productLinks: productRows.flatMap((option) =>
        purchaseChannels.map((channel) => ({
          itemType: option.itemType,
          itemId: option.itemId,
          channel: channel.id,
          url: formLinks[productLinkFormKey(option.itemType, option.itemId, channel.id)] || defaultPurchaseLinks[channel.id]
        }))
      )
    };

    try {
      const response = await fetch('/api/product-links', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const nextLinks = (payload as { productLinks: ProductLink[] }).productLinks || [];
      setFormLinks(buildProductLinkForm(productRows, nextLinks));
      showSuccessToast(tr(t, 'productLinksSaved', '商品链接已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-grid">
      <form className="table-panel product-links-panel" onSubmit={saveProductLinks}>
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'productManagement', '商品管理')}</h2>
            <p>{tr(t, 'productManagementHint', '维护套餐和额度在淘宝、闲鱼的商品链接。')}</p>
          </div>
          <button type="submit" className="primary-button" disabled={saving}>
            <ShoppingBag size={17} />
            {tr(t, 'saveProducts', '保存商品链接')}
          </button>
        </div>
        {loading ? <div className="loading-line" /> : null}
        <div className="product-link-list">
          {productRows.map((option) => (
            <article className="product-link-card" key={`${option.itemType}-${option.itemId}`}>
              <div className="product-link-title">
                <span>{option.itemType === 'plan' ? tr(t, 'purchasePlanTitle', '套餐') : tr(t, 'purchaseCreditTitle', '额度')}</span>
                <strong>{option.name}</strong>
                <small>{option.priceLabel}</small>
              </div>
              <div className="product-link-url-grid">
                {purchaseChannels.map((channel) => (
                  <label key={channel.id}>
                    {t[channel.labelKey]}
                    <input
                      type="url"
                      value={formLinks[productLinkFormKey(option.itemType, option.itemId, channel.id)] || ''}
                      onChange={(event) => updateUrl(option, channel.id, event.target.value)}
                      placeholder={defaultPurchaseLinks[channel.id]}
                      required
                    />
                  </label>
                ))}
              </div>
            </article>
          ))}
        </div>
      </form>
    </section>
  );
}

function productLinkFormKey(itemType: ProductItemType, itemId: string, channel: PurchaseChannelId) {
  return `${itemType}:${itemId}:${channel}`;
}

function buildProductLinkForm(productRows: PurchaseProductOption[], productLinks: ProductLink[]) {
  return productRows.reduce<Record<string, string>>((form, option) => {
    purchaseChannels.forEach((channel) => {
      form[productLinkFormKey(option.itemType, option.itemId, channel.id)] = productLinkUrl(
        productLinks,
        option.itemType,
        option.itemId,
        channel.id
      );
    });
    return form;
  }, {});
}

const emptyChannelForm = {
  id: '',
  name: '',
  status: 'active' as UpstreamChannel['status'],
  claudeApiUrl: '',
  codexApiUrl: '',
  useIndependentAgentKeys: false,
  inputRatePerMillion: 3,
  outputRatePerMillion: 15,
  cacheCreationRatePerMillion: 3.75,
  cacheReadRatePerMillion: 0.3,
  serverErrorRecoveryMinutes: 10,
  displayUsageMultiplier: 2,
  sortOrder: 100
};

function channelToForm(channel: UpstreamChannel) {
  return {
    id: channel.id,
    name: channel.name,
    status: channel.status,
    claudeApiUrl: channel.claudeApiUrl,
    codexApiUrl: channel.codexApiUrl,
    useIndependentAgentKeys: channel.useIndependentAgentKeys,
    inputRatePerMillion: channel.inputRatePerMillion,
    outputRatePerMillion: channel.outputRatePerMillion,
    cacheCreationRatePerMillion: channel.cacheCreationRatePerMillion,
    cacheReadRatePerMillion: channel.cacheReadRatePerMillion,
    serverErrorRecoveryMinutes: channel.serverErrorRecoveryMinutes,
    displayUsageMultiplier: channel.displayUsageMultiplier,
    sortOrder: channel.sortOrder
  };
}

function dateTimeLocalValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

function dateTimeLocalToIso(value: string) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function displayDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isPastDate(value: string | null) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function upstreamKeyRuntimeStatus(key: UpstreamChannelKey) {
  if (key.status === 'banned') return 'banned' as const;
  if (isPastDate(key.expiresAt)) return 'expired' as const;
  if (key.failureStatusCode === 402) return 'quota-exhausted' as const;
  if (key.failureStatusCode === 401) return 'expired' as const;
  if (key.failureStatusCode === 503) return 'channel-error' as const;
  if (key.status === 'paused') return 'paused' as const;
  if (key.status === 'revoked') return 'revoked' as const;
  return 'available' as const;
}

function upstreamKeyStatusLabel(key: UpstreamChannelKey, t: Record<string, string>) {
  const runtimeStatus = upstreamKeyRuntimeStatus(key);
  if (runtimeStatus === 'banned') return tr(t, 'banned', '封禁');
  if (runtimeStatus === 'quota-exhausted') return tr(t, 'quotaInsufficient', '额度不足');
  if (runtimeStatus === 'channel-error') return tr(t, 'channelInternalError', '渠道内部错误');
  if (runtimeStatus === 'expired') return tr(t, 'expired', '已过期');
  if (runtimeStatus === 'paused') return t.pause;
  if (runtimeStatus === 'revoked') return t.revoke;
  return tr(t, 'available', '可用');
}

function upstreamKeyStatusClassName(key: UpstreamChannelKey) {
  const runtimeStatus = upstreamKeyRuntimeStatus(key);
  if (runtimeStatus === 'available') return 'status-pill success';
  if (runtimeStatus === 'quota-exhausted') return 'status-pill warn';
  if (runtimeStatus === 'banned') return 'status-pill danger';
  if (runtimeStatus === 'channel-error') return 'status-pill danger';
  return 'status-pill';
}

function upstreamKeyAutoResetDisplay(key: UpstreamChannelKey, t: Record<string, string>) {
  return key.failureStatusCode === 402 && key.exhaustedUntil ? fullDate(key.exhaustedUntil) : t.notAvailable || '-';
}

type UpstreamKeyDeleteTarget = {
  channel: UpstreamChannel;
  key: UpstreamChannelKey;
};

type UpstreamKeyEditTarget = {
  channel: UpstreamChannel;
  key: UpstreamChannelKey;
};

type UpstreamModelRateTarget = {
  channel: UpstreamChannel;
  rate?: UpstreamModelRate;
};

const emptyModelRateForm = {
  agentType: 'claude-code' as GuideAgentId,
  model: '',
  inputRatePerMillion: 0,
  outputRatePerMillion: 0,
  cacheCreationRatePerMillion: 0,
  cacheReadRatePerMillion: 0,
  isDefault: false,
  sortOrder: 100
};

function modelRateToForm(rate: UpstreamModelRate) {
  return {
    agentType: rate.agentType,
    model: rate.model,
    inputRatePerMillion: rate.inputRatePerMillion,
    outputRatePerMillion: rate.outputRatePerMillion,
    cacheCreationRatePerMillion: rate.cacheCreationRatePerMillion,
    cacheReadRatePerMillion: rate.cacheReadRatePerMillion,
    isDefault: rate.isDefault,
    sortOrder: rate.sortOrder
  };
}

function ChannelsPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const [channels, setChannels] = React.useState<UpstreamChannel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isChannelOpen, setIsChannelOpen] = React.useState(false);
  const [channelForm, setChannelForm] = React.useState(emptyChannelForm);
  const [expandedChannelIds, setExpandedChannelIds] = React.useState<Set<string>>(() => new Set());
  const [keyTarget, setKeyTarget] = React.useState<UpstreamChannel | null>(null);
  const [keyName, setKeyName] = React.useState('');
  const [keyValue, setKeyValue] = React.useState('');
  const [keyAgentType, setKeyAgentType] = React.useState<UpstreamKeyAgentType>('shared');
  const [keyExpiresAt, setKeyExpiresAt] = React.useState('');
  const [keyIsPermanent, setKeyIsPermanent] = React.useState(true);
  const [keyEditTarget, setKeyEditTarget] = React.useState<UpstreamKeyEditTarget | null>(null);
  const [keyEditName, setKeyEditName] = React.useState('');
  const [keyEditValue, setKeyEditValue] = React.useState('');
  const [keyEditExpiresAt, setKeyEditExpiresAt] = React.useState('');
  const [keyEditIsPermanent, setKeyEditIsPermanent] = React.useState(true);
  const [modelRateTarget, setModelRateTarget] = React.useState<UpstreamModelRateTarget | null>(null);
  const [modelRateForm, setModelRateForm] = React.useState(emptyModelRateForm);
  const [deleteTarget, setDeleteTarget] = React.useState<UpstreamChannel | null>(null);
  const [keyDeleteTarget, setKeyDeleteTarget] = React.useState<UpstreamKeyDeleteTarget | null>(null);

  const loadChannels = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/upstream-channels', { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setExpandedChannelIds((current) => new Set([...current].filter((id) => ((payload as { channels: UpstreamChannel[] }).channels || []).some((channel) => channel.id === id))));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [headers, t.requestFailed]);

  React.useEffect(() => {
    void loadChannels();
  }, [loadChannels, refreshTick]);

  function openCreate() {
    setChannelForm(emptyChannelForm);
    setIsChannelOpen(true);
  }

  function openEdit(channel: UpstreamChannel) {
    setChannelForm(channelToForm(channel));
    setIsChannelOpen(true);
  }

  async function saveChannel(event: React.FormEvent) {
    event.preventDefault();
    const isEdit = Boolean(channelForm.id);
    const body = {
      name: channelForm.name,
      status: channelForm.status,
      claudeApiUrl: channelForm.claudeApiUrl,
      codexApiUrl: channelForm.codexApiUrl,
      useIndependentAgentKeys: channelForm.useIndependentAgentKeys,
      inputRatePerMillion: channelForm.inputRatePerMillion,
      outputRatePerMillion: channelForm.outputRatePerMillion,
      cacheCreationRatePerMillion: channelForm.cacheCreationRatePerMillion,
      cacheReadRatePerMillion: channelForm.cacheReadRatePerMillion,
      serverErrorRecoveryMinutes: channelForm.serverErrorRecoveryMinutes,
      displayUsageMultiplier: Number(channelForm.displayUsageMultiplier.toFixed(2)),
      sortOrder: channelForm.sortOrder
    };

    try {
      const response = await fetch(isEdit ? `/api/upstream-channels/${channelForm.id}` : '/api/upstream-channels', {
        method: isEdit ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setIsChannelOpen(false);
      showSuccessToast(tr(t, 'channelSaved', '渠道已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function deleteChannel(channel: UpstreamChannel) {
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setDeleteTarget(null);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function saveKey(event: React.FormEvent) {
    event.preventDefault();
    if (!keyTarget) return;
    try {
      const response = await fetch(`/api/upstream-channels/${keyTarget.id}/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: keyName,
          key: keyValue,
          agentType: keyAgentType,
          status: 'active',
          expiresAt: keyIsPermanent ? null : dateTimeLocalToIso(keyExpiresAt)
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setKeyTarget(null);
      setKeyName('');
      setKeyValue('');
      setKeyAgentType('shared');
      setKeyExpiresAt('');
      setKeyIsPermanent(true);
      showSuccessToast(tr(t, 'upstreamKeySaved', '上游 Key 已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  function openEditKey(channel: UpstreamChannel, key: UpstreamChannelKey) {
    setKeyEditTarget({ channel, key });
    setKeyEditName(key.name || '');
    setKeyEditValue('');
    setKeyEditIsPermanent(!key.expiresAt);
    setKeyEditExpiresAt(dateTimeLocalValue(key.expiresAt));
  }

  async function saveEditedKey(event: React.FormEvent) {
    event.preventDefault();
    if (!keyEditTarget) return;

    const body: {
      name: string;
      key?: string;
      expiresAt: string | null;
    } = {
      name: keyEditName,
      expiresAt: keyEditIsPermanent ? null : dateTimeLocalToIso(keyEditExpiresAt)
    };
    if (keyEditValue.trim()) {
      body.key = keyEditValue.trim();
    }

    try {
      const response = await fetch(`/api/upstream-channels/${keyEditTarget.channel.id}/keys/${keyEditTarget.key.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setKeyEditTarget(null);
      setKeyEditName('');
      setKeyEditValue('');
      setKeyEditExpiresAt('');
      setKeyEditIsPermanent(true);
      showSuccessToast(tr(t, 'upstreamKeySaved', '上游 Key 已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function updateKeyStatus(channel: UpstreamChannel, key: UpstreamChannelKey, status: UpstreamChannelKey['status']) {
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}/keys/${key.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      showSuccessToast(status === 'banned' ? tr(t, 'banned', '封禁') : status === 'active' ? tr(t, 'available', '可用') : t.pause);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  function openModelRate(channel: UpstreamChannel, rate?: UpstreamModelRate) {
    setModelRateTarget({ channel, rate });
    setModelRateForm(rate ? modelRateToForm(rate) : { ...emptyModelRateForm });
  }

  async function saveModelRate(event: React.FormEvent) {
    event.preventDefault();
    if (!modelRateTarget) return;
    const isEdit = Boolean(modelRateTarget.rate);
    try {
      const response = await fetch(
        isEdit
          ? `/api/upstream-channels/${modelRateTarget.channel.id}/model-rates/${modelRateTarget.rate!.id}`
          : `/api/upstream-channels/${modelRateTarget.channel.id}/model-rates`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers,
          body: JSON.stringify(modelRateForm)
        }
      );
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setModelRateTarget(null);
      setModelRateForm(emptyModelRateForm);
      showSuccessToast(tr(t, 'modelRateSaved', '模型计费已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function deleteModelRate(channel: UpstreamChannel, rate: UpstreamModelRate) {
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}/model-rates/${rate.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function deleteKey(channel: UpstreamChannel, key: UpstreamChannelKey) {
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}/keys/${key.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setKeyDeleteTarget(null);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  function toggleChannel(channelId: string) {
    setExpandedChannelIds((current) => {
      const next = new Set(current);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }

  return (
    <section className="content-grid">
      <section className="table-panel">
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'channelManagement', '渠道管理')}</h2>
            <p>{tr(t, 'channelDescription', '配置上游渠道、Agent URL、共享或独立 API Key、故障恢复策略，以及智能调度优先级（值越小越先尝试）。')}</p>
          </div>
          <button type="button" className="primary-button" onClick={openCreate}>
            <Plus size={17} />
            {tr(t, 'createChannel', '新增渠道')}
          </button>
        </div>
        {loading ? <div className="loading-line" /> : null}
        {!channels.length ? (
          <Empty t={t}>
            <button type="button" className="primary-button" onClick={openCreate}>
              <Plus size={17} />
              {tr(t, 'createChannel', '新增渠道')}
            </button>
          </Empty>
        ) : (
          <div className="channel-list">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                t={t}
                isExpanded={expandedChannelIds.has(channel.id)}
                onToggle={() => toggleChannel(channel.id)}
                onEdit={() => openEdit(channel)}
                onAddKey={() => {
                  setKeyTarget(channel);
                  setKeyAgentType(channel.useIndependentAgentKeys ? 'claude-code' : 'shared');
                  setKeyName('');
                  setKeyValue('');
                  setKeyExpiresAt('');
                  setKeyIsPermanent(true);
                }}
                onDelete={() => setDeleteTarget(channel)}
                onKeyStatus={(key, status) => updateKeyStatus(channel, key, status)}
                onEditKey={(key) => openEditKey(channel, key)}
                onDeleteKey={(key) => setKeyDeleteTarget({ channel, key })}
                onAddModelRate={() => openModelRate(channel)}
                onEditModelRate={(rate) => openModelRate(channel, rate)}
                onDeleteModelRate={(rate) => deleteModelRate(channel, rate)}
              />
            ))}
          </div>
        )}
      </section>

      {isChannelOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel channel-modal-panel" onSubmit={saveChannel}>
            <div className="section-heading">
              <div>
                <h2>{channelForm.id ? tr(t, 'editChannel', '编辑渠道') : tr(t, 'createChannel', '新增渠道')}</h2>
                <p>{tr(t, 'channelModalHint', 'Codex 与 Claude Code 可使用不同 API URL，API Key 可共享或按 Agent 独立维护。')}</p>
              </div>
            </div>
            <div className="channel-form-grid">
              <label>
                {tr(t, 'channelName', '渠道名称')}
                <input
                  value={channelForm.name}
                  onChange={(event) => setChannelForm((value) => ({ ...value, name: event.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label>
                {t.status}
                <select
                  value={channelForm.status}
                  onChange={(event) => setChannelForm((value) => ({ ...value, status: event.target.value as UpstreamChannel['status'] }))}
                >
                  <option value="active">{tr(t, 'active', '启用')}</option>
                  <option value="paused">{t.pause}</option>
                </select>
              </label>
              <label className="wide-field">
                Claude Code API URL
                <input
                  value={channelForm.claudeApiUrl}
                  onChange={(event) => setChannelForm((value) => ({ ...value, claudeApiUrl: event.target.value }))}
                  placeholder="https://api-cc.example.com"
                  required
                />
              </label>
              <label className="wide-field">
                Codex API URL
                <input
                  value={channelForm.codexApiUrl}
                  onChange={(event) => setChannelForm((value) => ({ ...value, codexApiUrl: event.target.value }))}
                  placeholder="https://codex.example.com"
                  required
                />
              </label>
              <label>
                {tr(t, 'inputRate', '输入单价 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={channelForm.inputRatePerMillion}
                  onChange={(event) => setChannelForm((value) => ({ ...value, inputRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'outputRate', '输出单价 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={channelForm.outputRatePerMillion}
                  onChange={(event) => setChannelForm((value) => ({ ...value, outputRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'cacheWriteRate', '缓存写入 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={channelForm.cacheCreationRatePerMillion}
                  onChange={(event) =>
                    setChannelForm((value) => ({ ...value, cacheCreationRatePerMillion: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                {tr(t, 'cacheReadRate', '缓存读取 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={channelForm.cacheReadRatePerMillion}
                  onChange={(event) => setChannelForm((value) => ({ ...value, cacheReadRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'serverErrorRecoveryMinutes', '上游服务端错误恢复时间')}
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={channelForm.serverErrorRecoveryMinutes}
                  onChange={(event) =>
                    setChannelForm((value) => ({ ...value, serverErrorRecoveryMinutes: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                {tr(t, 'displayUsageMultiplier', '显示用量倍率')}
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={channelForm.displayUsageMultiplier}
                  onChange={(event) =>
                    setChannelForm((value) => ({
                      ...value,
                      displayUsageMultiplier: Math.max(1, Math.round(Number(event.target.value || 1) * 100) / 100)
                    }))
                  }
                />
              </label>
              <label>
                {tr(t, 'channelPriority', '优先级（越小越靠前）')}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={channelForm.sortOrder}
                  onChange={(event) =>
                    setChannelForm((value) => ({ ...value, sortOrder: Math.max(1, Math.trunc(Number(event.target.value) || 1)) }))
                  }
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={channelForm.useIndependentAgentKeys}
                onChange={(event) => setChannelForm((value) => ({ ...value, useIndependentAgentKeys: event.target.checked }))}
              />
              <span>{tr(t, 'useIndependentAgentKeys', 'Claude Code 与 Codex 使用独立 API Key')}</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setIsChannelOpen(false)}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button">
                <Check size={16} />
                {t.savePlan}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {keyTarget ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={saveKey}>
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'addUpstreamKey', '添加上游 Key')}</h2>
                <p>{keyTarget.name}</p>
              </div>
            </div>
            <label>
              {tr(t, 'keyScope', 'Key 作用域')}
              <select value={keyAgentType} onChange={(event) => setKeyAgentType(event.target.value as UpstreamKeyAgentType)}>
                <option value="shared" disabled={keyTarget.useIndependentAgentKeys}>
                  {tr(t, 'sharedKey', '共享')}
                </option>
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
              </select>
            </label>
            <label>
              {tr(t, 'upstreamKeyName', 'Key 名称')}
              <input value={keyName} onChange={(event) => setKeyName(event.target.value)} autoFocus />
            </label>
            <label>
              API Key
              <input value={keyValue} onChange={(event) => setKeyValue(event.target.value)} required />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={keyIsPermanent}
                onChange={(event) => setKeyIsPermanent(event.target.checked)}
              />
              <span>{tr(t, 'permanentKey', '永久有效')}</span>
            </label>
            {!keyIsPermanent ? (
              <label>
                {tr(t, 'keyExpiresAt', '到期时间')}
                <input
                  type="datetime-local"
                  step="1"
                  value={keyExpiresAt}
                  onChange={(event) => setKeyExpiresAt(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setKeyTarget(null)}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button">
                <Plus size={16} />
                {tr(t, 'addUpstreamKey', '添加上游 Key')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel modal-panel-danger" role="dialog" aria-modal="true">
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'deleteChannelConfirm', '确认删除这个渠道？')}</h2>
                <p>{deleteTarget.name}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)}>
                {t.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => deleteChannel(deleteTarget)}>
                <Trash2 size={16} />
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {keyEditTarget ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={saveEditedKey}>
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'editUpstreamKey', '编辑上游 Key')}</h2>
                <p>
                  {keyEditTarget.channel.name} · {keyEditTarget.key.keyPreview}
                </p>
              </div>
            </div>
            <label>
              {tr(t, 'upstreamKeyName', 'Key 名称')}
              <input value={keyEditName} onChange={(event) => setKeyEditName(event.target.value)} autoFocus />
            </label>
            <label>
              API Key
              <input
                value={keyEditValue}
                onChange={(event) => setKeyEditValue(event.target.value)}
                placeholder={tr(t, 'leaveBlankKeepKey', '留空则不更换 Key')}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={keyEditIsPermanent}
                onChange={(event) => setKeyEditIsPermanent(event.target.checked)}
              />
              <span>{tr(t, 'permanentKey', '永久有效')}</span>
            </label>
            {!keyEditIsPermanent ? (
              <label>
                {tr(t, 'keyExpiresAt', '到期时间')}
                <input
                  type="datetime-local"
                  step="1"
                  value={keyEditExpiresAt}
                  onChange={(event) => setKeyEditExpiresAt(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setKeyEditTarget(null)}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button">
                <Check size={16} />
                {t.savePlan}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {modelRateTarget ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel channel-modal-panel" onSubmit={saveModelRate}>
            <div className="section-heading">
              <div>
                <h2>{modelRateTarget.rate ? tr(t, 'editModelRate', '编辑模型计费') : tr(t, 'addModelRate', '新增模型计费')}</h2>
                <p>{modelRateTarget.channel.name}</p>
              </div>
            </div>
            <div className="channel-form-grid">
              <label>
                Agent
                <select
                  value={modelRateForm.agentType}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, agentType: event.target.value as GuideAgentId }))}
                >
                  <option value="claude-code">Claude Code</option>
                  <option value="codex">Codex</option>
                </select>
              </label>
              <label>
                {tr(t, 'modelName', '模型名称')}
                <input
                  value={modelRateForm.model}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, model: event.target.value }))}
                  placeholder="claude-sonnet-5* / gpt-5.3-codex / *"
                  required
                />
              </label>
              <label>
                {tr(t, 'inputRate', '输入单价 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={modelRateForm.inputRatePerMillion}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, inputRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'outputRate', '输出单价 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={modelRateForm.outputRatePerMillion}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, outputRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'cacheWriteRate', '缓存写入 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={modelRateForm.cacheCreationRatePerMillion}
                  onChange={(event) =>
                    setModelRateForm((value) => ({ ...value, cacheCreationRatePerMillion: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                {tr(t, 'cacheReadRate', '缓存读取 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={modelRateForm.cacheReadRatePerMillion}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, cacheReadRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'sortOrder', '排序')}
                <input
                  type="number"
                  value={modelRateForm.sortOrder}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, sortOrder: Number(event.target.value) }))}
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={modelRateForm.isDefault}
                onChange={(event) => setModelRateForm((value) => ({ ...value, isDefault: event.target.checked }))}
              />
              <span>{tr(t, 'defaultModelRate', '作为该 Agent 的默认计费')}</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModelRateTarget(null)}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button">
                <Check size={16} />
                {t.savePlan}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {keyDeleteTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel modal-panel-danger" role="dialog" aria-modal="true">
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'deleteUpstreamKeyConfirm', '确认删除这个上游 Key？')}</h2>
                <p>
                  {keyDeleteTarget.channel.name} · {keyDeleteTarget.key.keyPreview}
                </p>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setKeyDeleteTarget(null)}>
                {t.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => deleteKey(keyDeleteTarget.channel, keyDeleteTarget.key)}>
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

function ChannelCard({
  channel,
  t,
  isExpanded,
  onToggle,
  onEdit,
  onAddKey,
  onDelete,
  onKeyStatus,
  onEditKey,
  onDeleteKey,
  onAddModelRate,
  onEditModelRate,
  onDeleteModelRate,
  selectedAgentTab: selectedAgentTabProp
}: {
  channel: UpstreamChannel;
  t: Record<string, string>;
  selectedAgentTab?: GuideAgentId;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAddKey: () => void;
  onDelete: () => void;
  onKeyStatus: (key: UpstreamChannelKey, status: UpstreamChannelKey['status']) => void;
  onEditKey: (key: UpstreamChannelKey) => void;
  onDeleteKey: (key: UpstreamChannelKey) => void;
  onAddModelRate: () => void;
  onEditModelRate: (rate: UpstreamModelRate) => void;
  onDeleteModelRate: (rate: UpstreamModelRate) => void;
}) {
  const [selectedAgentTab, setSelectedAgentTab] = React.useState<UpstreamChannelAgentTab>(selectedAgentTabProp || 'claude-code');
  const [isRatesExpanded, setIsRatesExpanded] = React.useState(true);
  const [isKeysExpanded, setIsKeysExpanded] = React.useState(true);
  const totalKeys = channel.keyCounts.shared + channel.keyCounts['claude-code'] + channel.keyCounts.codex;
  const claudeRates = channel.modelRates.filter((rate) => rate.agentType === 'claude-code');
  const codexRates = channel.modelRates.filter((rate) => rate.agentType === 'codex');
  const visibleKeys = channel.keys.filter((key) => key.agentType === 'shared' || key.agentType === selectedAgentTab);
  const visibleRates = selectedAgentTab === 'claude-code' ? claudeRates : codexRates;
  return (
    <article className="channel-card">
      <div className="channel-card-head">
        <div>
          <div className="channel-title-row">
            <button type="button" className="channel-toggle-button" onClick={onToggle} aria-expanded={isExpanded} title={isExpanded ? tr(t, 'collapseKeys', '收起 Key') : tr(t, 'expandKeys', '展开 Key')}>
              <ChevronDown size={16} className={isExpanded ? 'rotate-icon open' : 'rotate-icon'} />
            </button>
            <strong>{channel.name}</strong>
            <span className="status-pill">{tr(t, 'channelNumber', '渠道编号')} #{channel.channelNumber}</span>
            <span className="status-pill">{tr(t, 'channelPriorityShort', '优先级')} {channel.sortOrder}</span>
            <span className={channel.status === 'active' ? 'status-code ok' : 'status-code error'}>
              {channel.status === 'active' ? tr(t, 'active', '启用') : t.pause}
            </span>
            {channel.degradedUntil ? (
              <span className="status-pill warn">
                {tr(t, 'recoverAt', '恢复于')} {fullDate(channel.degradedUntil)}
              </span>
            ) : null}
          </div>
          <p>
            {tr(t, 'serverErrorRecoveryMinutes', '上游服务端错误恢复时间')}: {channel.serverErrorRecoveryMinutes} ·{' '}
            {tr(t, 'displayUsageMultiplier', '显示用量倍率')}: {channel.displayUsageMultiplier.toFixed(2)} ·{' '}
            {tr(t, 'billingRates', '计费')}: Claude {claudeRates.length} / Codex {codexRates.length}
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="secondary-button" onClick={onEdit}>
            {tr(t, 'edit', '编辑')}
          </button>
          <button type="button" className="icon-button danger" onClick={onDelete} title={t.delete}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="channel-url-grid">
        <div>
          <span>{selectedAgentTab === 'claude-code' ? 'Claude Code' : 'Codex'}</span>
          <code>{selectedAgentTab === 'claude-code' ? channel.claudeApiUrl : channel.codexApiUrl}</code>
        </div>
      </div>

      <div className="channel-key-mode">
        <span>{channel.useIndependentAgentKeys ? tr(t, 'independentKeys', '独立 Key') : tr(t, 'sharedKey', '共享 Key')}</span>
        <span>{tr(t, 'totalKeys', '总数')} {totalKeys}</span>
        <span>Shared {channel.keyCounts.shared}</span>
        <span>Claude {channel.keyCounts['claude-code']}</span>
        <span>Codex {channel.keyCounts.codex}</span>
      </div>

      {isExpanded ? (
        <>
          <div className="agent-tabs channel-inner-tabs">
            <button type="button" className={selectedAgentTab === 'claude-code' ? 'agent-tab active' : 'agent-tab'} onClick={() => setSelectedAgentTab('claude-code')}>
              Claude Code
            </button>
            <button type="button" className={selectedAgentTab === 'codex' ? 'agent-tab active' : 'agent-tab'} onClick={() => setSelectedAgentTab('codex')}>
              Codex
            </button>
          </div>
          <div className="channel-subcard">
            <div className="channel-subcard-head">
              <button type="button" className="channel-subcard-toggle" onClick={() => setIsRatesExpanded((value) => !value)} aria-expanded={isRatesExpanded}>
                <ChevronDown size={16} className={isRatesExpanded ? 'rotate-icon open' : 'rotate-icon'} />
                <strong>{tr(t, 'billingModels', '计费模型')}</strong>
              </button>
              <button type="button" className="secondary-button" onClick={onAddModelRate}>
                <Plus size={15} />
                {tr(t, 'addModelRate', '新增模型计费')}
              </button>
            </div>
            {isRatesExpanded ? (
              <div className="model-rate-section">
                <div className="model-rate-groups">
                  <ModelRateGroup title={selectedAgentTab === 'claude-code' ? 'Claude Code' : 'Codex'} rates={visibleRates} t={t} onEdit={onEditModelRate} onDelete={onDeleteModelRate} />
                </div>
              </div>
            ) : null}
          </div>
          <div className="channel-subcard">
            <div className="channel-subcard-head">
              <button type="button" className="channel-subcard-toggle" onClick={() => setIsKeysExpanded((value) => !value)} aria-expanded={isKeysExpanded}>
                <ChevronDown size={16} className={isKeysExpanded ? 'rotate-icon open' : 'rotate-icon'} />
                <strong>API Key</strong>
              </button>
              <button type="button" className="secondary-button" onClick={onAddKey}>
                <Plus size={15} />
                {tr(t, 'addUpstreamKey', '添加上游 Key')}
              </button>
            </div>
            {isKeysExpanded ? (
              visibleKeys.length ? (
          <div className="upstream-key-list">
            {visibleKeys.map((key) => {
              return (
                <div className="upstream-key-row" key={key.id}>
                  <div>
                    {key.name ? <span className="upstream-key-name">{key.name}</span> : null}
                    <strong>{key.keyPreview}</strong>
                    <span>{agentTypeLabel(key.agentType)}</span>
                  </div>
                  <span className={upstreamKeyStatusClassName(key)}>{upstreamKeyStatusLabel(key, t)}</span>
                  <div className="upstream-key-meta">
                    <span>
                      {tr(t, 'keyExpiresAt', '到期时间')}: {key.expiresAt ? displayDateTime(key.expiresAt) : tr(t, 'permanentKey', '永久有效')}
                    </span>
                    <span>{tr(t, 'autoResetAt', '自动重置时间')}: {upstreamKeyAutoResetDisplay(key, t)}</span>
                    <span>{key.failureReason || (key.lastUsedAt ? fullDate(key.lastUsedAt) : t.never)}</span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="secondary-button" onClick={() => onEditKey(key)}>
                      {tr(t, 'edit', '编辑')}
                    </button>
                    {key.status === 'banned' ? (
                      <button type="button" className="secondary-button" onClick={() => onKeyStatus(key, 'active')}>
                        {tr(t, 'unban', '解封')}
                      </button>
                    ) : (
                      <button type="button" className="secondary-button" onClick={() => onKeyStatus(key, 'banned')}>
                        {tr(t, 'ban', '封禁')}
                      </button>
                    )}
                    <button type="button" className="icon-button danger" onClick={() => onDeleteKey(key)} title={t.delete}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
              ) : (
                <Empty t={t} />
              )
            ) : null}
          </div>
        </>
      ) : null}
      {channel.degradedReason ? <p className="channel-failure">{channel.degradedReason}</p> : null}
    </article>
  );
}

function agentTypeLabel(value: UpstreamKeyAgentType) {
  if (value === 'claude-code') return 'Claude Code';
  if (value === 'codex') return 'Codex';
  return 'Shared';
}

function ModelRateGroup({
  title,
  rates,
  t,
  onEdit,
  onDelete
}: {
  title: string;
  rates: UpstreamModelRate[];
  t: Record<string, string>;
  onEdit: (rate: UpstreamModelRate) => void;
  onDelete: (rate: UpstreamModelRate) => void;
}) {
  return (
    <div className="model-rate-group">
      <div className="model-rate-group-title">{title}</div>
      {rates.length ? (
        <div className="model-rate-list">
          {rates.map((rate) => (
            <div className="model-rate-row" key={rate.id}>
              <div>
                <strong>{rate.model}</strong>
                {rate.isDefault ? <span>{tr(t, 'defaultRate', '默认')}</span> : null}
              </div>
              <span>I {rate.inputRatePerMillion}</span>
              <span>CW {rate.cacheCreationRatePerMillion}</span>
              <span>CR {rate.cacheReadRatePerMillion}</span>
              <span>O {rate.outputRatePerMillion}</span>
              <div className="row-actions">
                <button type="button" className="secondary-button" onClick={() => onEdit(rate)}>
                  {tr(t, 'edit', '编辑')}
                </button>
                <button type="button" className="icon-button danger" onClick={() => onDelete(rate)} title={t.delete}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty t={t} />
      )}
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
  const [giftPreview, setGiftPreview] = React.useState<GiftCardPreview | null>(null);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [purchaseTarget, setPurchaseTarget] = React.useState<UpgradePlan | null>(null);
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false);
  const primaryKey = data.keys.find((key) => key.status === 'active') || data.keys[0];
  const accountPlan =
    data.plans.find((plan) => plan.id === data.account.currentPlanId) ||
    data.plans.find((plan) => plan.id === 'free');
  const quota = buildAccountQuota(data, accountPlan, primaryKey?.usage) || emptyQuota();
  const currencyCode = accountPlan?.currency || 'CNY';

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    const code = redeemCode.trim();
    if (!code) return;
    setIsRedeeming(true);
    try {
      const response = await fetch('/api/user/gift-cards/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const result = payload as GiftCardPreview;
      if (result.requiresConfirmation) {
        setGiftPreview(result);
        return;
      }
      await redeemCreditGiftCard(code);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRedeeming(false);
    }
  }

  async function redeemCreditGiftCard(code: string) {
    try {
      const response = await fetch('/api/user/gift-cards/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      showSuccessToast((payload as { message?: string }).message || t.redeem);
      setRedeemCode('');
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
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
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setGiftPreview(null);
      setRedeemCode('');
      showSuccessToast((payload as { message?: string }).message || t.redeem);
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRedeeming(false);
    }
  }

  if (view === 'change') {
    return (
      <>
        <PlanChangePage
          currentPlanId={data.account.currentPlanId || undefined}
          openPurchaseDialog={setPurchaseTarget}
          t={t}
        />
        {purchaseTarget ? (
          <RechargeModal {...buildRechargeModalProps(t, () => setPurchaseTarget(null))} />
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
        <article className="current-plan-card balance-plan-card">
          <div className="free-plan-badge">{t.balance}</div>
          <div className="current-plan-copy">
            <strong>{currency(data.summary.accountBalanceCents, currencyCode)}</strong>
            <p>{t.extraBalance}</p>
          </div>
          <div className="current-plan-quotas">
            <div>
              <span>{t.todayUsage}</span>
              <strong>{currency(data.summary.todayCostCents, currencyCode)}</strong>
            </div>
            <div>
              <span>{t.todayRequests}</span>
              <strong>{compact(data.summary.todayRequests)}</strong>
            </div>
          </div>
          <button type="button" className="primary-button" onClick={() => setIsRechargeOpen(true)}>
            <Plus size={16} />
            {t.recharge}
          </button>
        </article>
      </section>

      <section className="billing-section redeem-card-section">
        <h2>{t.redeemCard}</h2>
        <form className="redeem-card-panel" onSubmit={redeem}>
          <p>{t.redeemCardHint}</p>
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
      {isRechargeOpen ? (
        <RechargeModal {...buildRechargeModalProps(t, () => setIsRechargeOpen(false))} />
      ) : null}
    </section>
  );
}

function PlanChangePage({
  currentPlanId,
  openPurchaseDialog,
  t
}: {
  currentPlanId?: string;
  openPurchaseDialog: (plan: UpgradePlan) => void;
  t: Record<string, string>;
}) {
  return (
    <section className="upgrade-page">
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

function LogsPanel({ keys, headers, refreshTick, t }: { keys: ApiKey[]; headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const [tab, setTab] = React.useState<'usage' | 'claims' | 'redemptions'>('usage');
  const [status, setStatus] = React.useState<LogStatus>('all');
  const [apiKeyId, setApiKeyId] = React.useState('all');
  const [range, setRange] = React.useState<LogRange>('24h');
  const [giftCardType, setGiftCardType] = React.useState<'all' | 'credit' | 'plan'>('all');
  const [giftCardCode, setGiftCardCode] = React.useState('');
  const [usagePage, setUsagePage] = React.useState(1);
  const [claimsPage, setClaimsPage] = React.useState(1);
  const [redemptionsPage, setRedemptionsPage] = React.useState(1);
  const [logPage, setLogPage] = React.useState<LogPage>({ logs: [], total: 0, page: 1, pageSize: 20 });
  const [claimPage, setClaimPage] = React.useState<Paginated<{ orders: ClaimedOrder[] }>>({ orders: [], total: 0, page: 1, pageSize: 20 });
  const [redemptionPage, setRedemptionPage] = React.useState<GiftCardRedemptionPage>({ giftCards: [], total: 0, page: 1, pageSize: 20, days: 30 });
  const [loading, setLoading] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(logPage.total / logPage.pageSize));

  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const currentPage = tab === 'usage' ? usagePage : tab === 'claims' ? claimsPage : redemptionsPage;
      const params = new URLSearchParams({ page: String(currentPage) });
      let response: Response;
      if (tab === 'usage') {
        params.set('pageSize', String(logPage.pageSize));
        params.set('status', status);
        params.set('range', range);
        if (apiKeyId !== 'all') params.set('apiKeyId', apiKeyId);
        response = await fetch(`/api/user/logs?${params.toString()}`, { headers });
      } else if (tab === 'claims') {
        params.set('pageSize', String(claimPage.pageSize));
        params.set('days', '30');
        params.set('giftCardType', giftCardType);
        if (giftCardCode.trim()) params.set('giftCardCode', giftCardCode.trim());
        response = await fetch(`/api/user/orders/claims?${params.toString()}`, { headers });
      } else {
        params.set('pageSize', String(redemptionPage.pageSize));
        params.set('days', '30');
        params.set('type', giftCardType);
        if (giftCardCode.trim()) params.set('code', giftCardCode.trim());
        response = await fetch(`/api/user/gift-card-redemptions?${params.toString()}`, { headers });
      }
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      if (tab === 'usage') setLogPage(payload as LogPage);
      if (tab === 'claims') setClaimPage(payload as Paginated<{ orders: ClaimedOrder[] }>);
      if (tab === 'redemptions') setRedemptionPage(payload as GiftCardRedemptionPage);
      setExpandedId(null);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [apiKeyId, claimsPage, giftCardCode, giftCardType, headers, claimPage.pageSize, logPage.pageSize, range, redemptionPage.pageSize, redemptionsPage, status, t.requestFailed, tab, usagePage]);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs, refreshTick]);

  function updateStatus(value: LogStatus) {
    setStatus(value);
    setUsagePage(1);
  }

  function updateApiKey(value: string) {
    setApiKeyId(value);
    setUsagePage(1);
  }

  function updateRange(value: LogRange) {
    setRange(value);
    setUsagePage(1);
  }

  function updateGiftCardType(value: 'all' | 'credit' | 'plan') {
    setGiftCardType(value);
    if (tab === 'claims') setClaimsPage(1);
    if (tab === 'redemptions') setRedemptionsPage(1);
  }

  function updateGiftCardCode(value: string) {
    setGiftCardCode(value);
    if (tab === 'claims') setClaimsPage(1);
    if (tab === 'redemptions') setRedemptionsPage(1);
  }

  return (
    <section className="content-grid">
      <div className="log-type-tabs" role="tablist" aria-label="日志分页">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'usage'}
          className={tab === 'usage' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => setTab('usage')}
        >
          消费日志
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'claims'}
          className={tab === 'claims' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => setTab('claims')}
        >
          礼品码记录
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'redemptions'}
          className={tab === 'redemptions' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => setTab('redemptions')}
        >
          兑换记录
        </button>
      </div>
      <div className="log-filters">
        {tab === 'usage' ? (
          <>
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
          </>
        ) : null}
        {tab === 'claims' || tab === 'redemptions' ? (
          <>
            <label>
              类型
              <select value={giftCardType} onChange={(event) => updateGiftCardType(event.target.value as 'all' | 'credit' | 'plan')}>
                <option value="all">全部类型</option>
                <option value="plan">套餐</option>
                <option value="credit">余额</option>
              </select>
            </label>
            <label>
              礼品码
              <input value={giftCardCode} onChange={(event) => updateGiftCardCode(event.target.value)} placeholder="输入礼品码搜索" />
            </label>
          </>
        ) : null}
      </div>
      <section className="table-panel">
        {loading ? <div className="loading-line" /> : null}
        {tab === 'usage' ? <LogRows logs={logPage.logs} t={t} expandedId={expandedId} setExpandedId={setExpandedId} /> : null}
        {tab === 'claims' ? <OrdersTable orders={claimPage.orders} /> : null}
        {tab === 'redemptions' ? <GiftRedemptionTable giftCards={redemptionPage.giftCards} /> : null}
        {tab === 'usage' ? <PaginationBar page={usagePage} pageSize={logPage.pageSize} total={logPage.total} onPageChange={setUsagePage} /> : null}
        {tab === 'claims' ? <PaginationBar page={claimsPage} pageSize={claimPage.pageSize} total={claimPage.total} onPageChange={setClaimsPage} /> : null}
        {tab === 'redemptions' ? <PaginationBar page={redemptionsPage} pageSize={redemptionPage.pageSize} total={redemptionPage.total} onPageChange={setRedemptionsPage} /> : null}
      </section>
    </section>
  );
}

function OrdersTable({ orders }: { orders: ClaimedOrder[] }) {
  if (!orders.length) return <div className="table-empty">暂无记录</div>;
  return (
    <div className="gift-card-table">
      <div className="gift-card-table-head">
        <span>ID</span>
        <span>商品</span>
        <span>礼品码</span>
        <span>状态</span>
        <span>领取时间</span>
      </div>
      {orders.map((order) => (
        <article className="gift-card-row" key={`${order.orderId}-${order.subOrderId || ''}`}>
          <code>{order.orderId}{order.subOrderId ? `/${order.subOrderId}` : ''}</code>
          <span>{order.title}</span>
          <code>{order.giftCardCode || '-'}</code>
          <span>{order.deliveryStatus}</span>
          <span>{order.claimedAt ? formatDateTime(order.claimedAt) : '-'}</span>
        </article>
      ))}
    </div>
  );
}

function GiftRedemptionTable({ giftCards }: { giftCards: GiftCardCard[] }) {
  if (!giftCards.length) return <div className="table-empty">暂无记录</div>;
  return (
    <div className="gift-card-table">
      <div className="gift-card-table-head">
        <span>兑换码</span>
        <span>类型</span>
        <span>套餐/额度</span>
        <span>兑换用户</span>
        <span>兑换时间</span>
      </div>
      {giftCards.map((card) => (
        <article className="gift-card-row" key={card.code}>
          <code>{card.code}</code>
          <span>{card.type === 'plan' ? '套餐' : '余额'}</span>
          <span>{card.type === 'plan' ? `${card.planName || '-'} / ${card.durationMonths}月` : currency(card.amountCents, 'USD')}</span>
          <span>{card.redeemedByEmail || card.redeemedByUserId || '-'}</span>
          <span>{card.redeemedAt ? formatDateTime(card.redeemedAt) : '-'}</span>
        </article>
      ))}
    </div>
  );
}

function PaginationBar({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination-bar">
      <span>共 {total} 条</span>
      <div>
        <button type="button" className="icon-button compact" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={16} />
        </button>
        <strong>{page} / {pageCount}</strong>
        <button type="button" className="icon-button compact" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function UsersCenterPanel({ headers, refreshTick, t, onOpenUser }: { headers: HeadersInit; refreshTick: number; t: Record<string, string>; onOpenUser: (userId: string) => void }) {
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [sortField, setSortField] = React.useState<'freeCreditCents' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [page, setPage] = React.useState(1);
  const [pageData, setPageData] = React.useState<UserListPage>({ users: [], total: 0, page: 1, pageSize: 20, sortField: 'createdAt', sortOrder: 'desc' });

  const loadUsers = React.useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageData.pageSize), sortField, sortOrder });
    if (query.trim()) params.set('search', query.trim());
    const response = await fetch(`/api/admin/users?${params.toString()}`, { headers });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
      return;
    }
    setPageData(payload as UserListPage);
  }, [headers, page, pageData.pageSize, query, sortField, sortOrder, t.requestFailed]);

  React.useEffect(() => { void loadUsers(); }, [loadUsers, refreshTick]);

  function toggleSort(field: 'freeCreditCents' | 'createdAt') {
    if (sortField === field) {
      setSortOrder((value) => (value === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1);
  }

  function SortableHeader({ field, label }: { field: 'freeCreditCents' | 'createdAt'; label: string }) {
    const active = sortField === field;
    return (
      <button
        type="button"
        className={active ? 'users-sort-button active' : 'users-sort-button'}
        onClick={() => toggleSort(field)}
        title={`${label}${active ? (sortOrder === 'desc' ? '（当前降序）' : '（当前升序）') : ''}`}
      >
        <span>{label}</span>
        {active ? (
          sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUpIcon />
        ) : (
          <ChevronsUpDown size={14} />
        )}
      </button>
    );
  }

  return (
    <section className="content-grid">
      <section className="table-panel">
        <div className="log-filters">
          <label>
            搜索
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID / 用户名 / 邮箱" />
          </label>
          <button type="button" className="secondary-button" onClick={() => { setQuery(search); setPage(1); }}>搜索</button>
        </div>
        <div className="users-table">
          <div className="users-table-head">
            <span>ID</span>
            <span>用户名</span>
            <span>邮箱</span>
            <span>当前套餐</span>
            <SortableHeader field="freeCreditCents" label="自由额度" />
            <span>套餐到期</span>
            <SortableHeader field="createdAt" label="创建时间" />
          </div>
          {pageData.users.map((user) => (
            <article className="users-table-row" key={user.id}>
              <code className="users-table-code">{user.id}</code>
              <Tooltip content={user.displayName || '-'}>
                <button type="button" className="link-button users-table-link" onClick={() => onOpenUser(user.id)}>
                  <span className="users-table-link-text">{user.displayName || '-'}</span>
                </button>
              </Tooltip>
              <Tooltip content={user.email}>
                <button type="button" className="link-button users-table-link" onClick={() => onOpenUser(user.id)}>
                  <span className="users-table-link-text">{user.email}</span>
                </button>
              </Tooltip>
              <span className="users-table-cell">{user.currentPlanName || '-'}</span>
              <span className="users-table-cell users-table-cell-strong">{currency(user.freeCreditCents, 'USD')}</span>
              <span className="users-table-cell">{user.planExpiresAt ? formatDateTime(user.planExpiresAt) : '-'}</span>
              <span className="users-table-cell">{formatDateTime(user.createdAt)}</span>
            </article>
          ))}
        </div>
        <PaginationBar page={pageData.page} pageSize={pageData.pageSize} total={pageData.total} onPageChange={setPage} />
      </section>
    </section>
  );
}

function UserDetailPanel({ headers, userId, onBack, t }: { headers: HeadersInit; userId: string; onBack: () => void; t: Record<string, string> }) {
  const [user, setUser] = React.useState<UserListItem | null>(null);
  const [tab, setTab] = React.useState<'logs' | 'claims' | 'redemptions'>('logs');
  const [giftCardType, setGiftCardType] = React.useState<'all' | 'credit' | 'plan'>('all');
  const [giftCardCode, setGiftCardCode] = React.useState('');
  const [logs, setLogs] = React.useState<LogPage>({ logs: [], total: 0, page: 1, pageSize: 20 });
  const [claims, setClaims] = React.useState<Paginated<{ orders: ClaimedOrder[] }>>({ orders: [], total: 0, page: 1, pageSize: 20 });
  const [redemptions, setRedemptions] = React.useState<GiftCardRedemptionPage>({ giftCards: [], total: 0, page: 1, pageSize: 20, days: 30 });
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/admin/users/${userId}`, { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setUser((payload as { user: UserListItem }).user);
    })();
  }, [headers, userId, t.requestFailed]);

  React.useEffect(() => {
    setLogs((value) => ({ ...value, page: 1 }));
    setClaims((value) => ({ ...value, page: 1 }));
    setRedemptions((value) => ({ ...value, page: 1 }));
  }, [userId]);

  React.useEffect(() => {
    void (async () => {
      const endpoint = tab === 'logs'
        ? `/api/admin/users/${userId}/logs?page=${logs.page}&pageSize=${logs.pageSize}&range=30d`
        : tab === 'claims'
          ? `/api/admin/users/${userId}/order-claims?page=${claims.page}&pageSize=${claims.pageSize}&days=30&giftCardType=${giftCardType}${giftCardCode.trim() ? `&giftCardCode=${encodeURIComponent(giftCardCode.trim())}` : ''}`
          : `/api/admin/users/${userId}/gift-card-redemptions?page=${redemptions.page}&pageSize=${redemptions.pageSize}&days=30&type=${giftCardType}${giftCardCode.trim() ? `&code=${encodeURIComponent(giftCardCode.trim())}` : ''}`;
      const response = await fetch(endpoint, { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      if (tab === 'logs') setLogs(payload as LogPage);
      if (tab === 'claims') setClaims(payload as Paginated<{ orders: ClaimedOrder[] }>);
      if (tab === 'redemptions') setRedemptions(payload as GiftCardRedemptionPage);
    })();
  }, [claims.page, claims.pageSize, giftCardCode, giftCardType, headers, logs.page, logs.pageSize, redemptions.page, redemptions.pageSize, tab, t.requestFailed, userId]);

  return (
    <section className="content-grid">
      <section className="table-panel">
        <div className="panel-head panel-head-detail">
          <div>
            <h3>{user?.displayName || user?.email || userId}</h3>
            <p>{user?.email || ''} · {user?.currentPlanName || '-'} · 自由额度 {user ? currency(user.freeCreditCents, 'USD') : '-'}</p>
          </div>
        </div>
        <div className="log-type-tabs" role="tablist" aria-label="用户详情分页">
          <button type="button" role="tab" aria-selected={tab === 'logs'} className={tab === 'logs' ? 'log-type-tab active' : 'log-type-tab'} onClick={() => { setTab('logs'); setLogs((value) => ({ ...value, page: 1 })); }}>30天使用日志</button>
          <button type="button" role="tab" aria-selected={tab === 'claims'} className={tab === 'claims' ? 'log-type-tab active' : 'log-type-tab'} onClick={() => { setTab('claims'); setClaims((value) => ({ ...value, page: 1 })); }}>礼品码领取记录</button>
          <button type="button" role="tab" aria-selected={tab === 'redemptions'} className={tab === 'redemptions' ? 'log-type-tab active' : 'log-type-tab'} onClick={() => { setTab('redemptions'); setRedemptions((value) => ({ ...value, page: 1 })); }}>礼品码兑换记录</button>
        </div>
        {tab === 'claims' || tab === 'redemptions' ? (
          <div className="log-filters">
            <label>
              类型
              <select value={giftCardType} onChange={(event) => {
                setGiftCardType(event.target.value as 'all' | 'credit' | 'plan');
                if (tab === 'claims') setClaims((value) => ({ ...value, page: 1 }));
                if (tab === 'redemptions') setRedemptions((value) => ({ ...value, page: 1 }));
              }}>
                <option value="all">全部类型</option>
                <option value="plan">套餐</option>
                <option value="credit">余额</option>
              </select>
            </label>
            <label>
              礼品码
              <input value={giftCardCode} onChange={(event) => {
                setGiftCardCode(event.target.value);
                if (tab === 'claims') setClaims((value) => ({ ...value, page: 1 }));
                if (tab === 'redemptions') setRedemptions((value) => ({ ...value, page: 1 }));
              }} placeholder="输入礼品码搜索" />
            </label>
          </div>
        ) : null}
        {tab === 'logs' ? <LogRows logs={logs.logs} t={t} expandedId={expandedId} setExpandedId={setExpandedId} /> : null}
        {tab === 'claims' ? <OrdersTable orders={claims.orders} /> : null}
        {tab === 'redemptions' ? <GiftRedemptionTable giftCards={redemptions.giftCards} /> : null}
        {tab === 'logs' ? <PaginationBar page={logs.page} pageSize={logs.pageSize} total={logs.total} onPageChange={(next) => setLogs((value) => ({ ...value, page: next }))} /> : null}
        {tab === 'claims' ? <PaginationBar page={claims.page} pageSize={claims.pageSize} total={claims.total} onPageChange={(next) => setClaims((value) => ({ ...value, page: next }))} /> : null}
        {tab === 'redemptions' ? <PaginationBar page={redemptions.page} pageSize={redemptions.pageSize} total={redemptions.total} onPageChange={(next) => setRedemptions((value) => ({ ...value, page: next }))} /> : null}
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
      {!compactMode ? (
        <div className="log-head" aria-hidden="true">
          <span>{t.model}</span>
          <span>{tr(t, 'channelNumber', '渠道编号')}</span>
          <span>{t.costUsage}</span>
          <span>{t.status}</span>
          <span>{t.requestTime}</span>
          <span>{t.latency}</span>
        </div>
      ) : null}
      {logs.map((log) => {
        const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
        const isExpanded = expandedId === log.id;
        const toggle = () => setExpandedId?.(isExpanded ? null : log.id);
        const cacheBase = log.inputTokens + log.cacheCreationInputTokens + log.cacheReadInputTokens;
        const cacheHitRate = cacheBase ? log.cacheReadInputTokens / cacheBase : 0;

        return (
          <article className="log-record" key={log.id}>
            <button type="button" className="log-summary" onClick={toggle} aria-expanded={isExpanded}>
              {!compactMode ? <ChevronDown className={isExpanded ? 'log-expand-indicator open' : 'log-expand-indicator'} size={16} /> : null}
              <div>
                <strong>{log.model}</strong>
              </div>
              <span>{log.channelNumber ? `#${log.channelNumber}` : '-'}</span>
              <span className="log-cost">{currency(log.totalCostCents, 'USD')}</span>
              <span className={isSuccess ? 'status-code ok' : 'status-code error'}>{isSuccess ? t.success : t.failed}</span>
              <span>{fullDate(log.createdAt)}</span>
              <span>{log.latencyMs}ms</span>
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
                    <MetricBreakdownItem label={tr(t, 'requestCacheHitRate', '本次缓存命中率')} value={percent(cacheHitRate)} />
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

function MetricBreakdownItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="breakdown-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{hint || ''}</em>
    </div>
  );
}

function buildAccountQuota(data: Bootstrap, plan?: Plan, fallback?: QuotaSnapshot): QuotaSnapshot | null {
  if (!plan) return fallback || null;
  const fiveHourUsed = Math.max(0, Number(data.summary.fiveHourCostCents || fallback?.fiveHourUsed || 0));
  const weeklyUsed = Math.max(0, Number(data.summary.weeklyCostCents || fallback?.weeklyUsed || 0));
  const fiveHourLimit = Math.max(0, Number(plan.fiveHourTokenLimit || fallback?.fiveHourLimit || 0));
  const weeklyLimit = Math.max(0, Number(plan.weeklyTokenLimit || fallback?.weeklyLimit || 0));
  const balanceCents = Math.max(0, Number(data.summary.accountBalanceCents || fallback?.balanceCents || 0));
  const remainingFiveHour = Math.max(0, fiveHourLimit - fiveHourUsed);
  const remainingWeekly = Math.max(0, weeklyLimit - weeklyUsed);
  const quotaSource = remainingFiveHour > 0 && remainingWeekly > 0 ? 'plan' : balanceCents > 0 ? 'balance' : 'none';

  return {
    fiveHourUsed,
    fiveHourLimit,
    weeklyUsed,
    weeklyLimit,
    remainingFiveHour,
    remainingWeekly,
    balanceCents,
    quotaSource,
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
    balanceCents: 0,
    quotaSource: 'none',
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
  const amount = roundToDecimals((cents || 0) / 100, 2);
  return `$${amount.toFixed(2)}`;
}

function currencyNoDecimals(cents: number, currencyCode: string) {
  void currencyCode;
  const value = Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format((cents || 0) / 100);
  return `$${value}`;
}

function dollarsToCents(value: number) {
  return Math.max(1, Math.ceil((value || 0) * 100));
}

function ceilToDecimals(value: number, digits: number) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.ceil((value + Number.EPSILON) * factor) / factor;
}

function roundToDecimals(value: number, digits: number) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function tokenK(value: number) {
  const normalized = Math.max(0, Number(value || 0));
  if (normalized < 1000) {
    return Intl.NumberFormat('en').format(normalized);
  }
  const amount = ceilToDecimals(normalized / 1000, 3);
  return `${amount.toFixed(3)}k`;
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

function Root() {
  return (
    <>
      <ToastViewport />
      <App />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
