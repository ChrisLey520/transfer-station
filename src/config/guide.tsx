import { GuideAgentId, GuideOsId } from '../types.js';

export const guideIconSrc = '/guide-icon.png';

export const guideAgentOptions: Array<{ id: GuideAgentId; label: string }> = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' }
];

export const guideOsOptionsByAgent: Record<GuideAgentId, Array<{ id: GuideOsId; label: string }>> = {
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

export const guideDefaultOsByAgent: Record<GuideAgentId, GuideOsId> = {
  'claude-code': 'macos',
  codex: 'macos-linux'
};

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

function getClientPlatformText() {
  if (typeof navigator === 'undefined') return '';

  const clientNavigator = navigator as NavigatorWithUserAgentData;
  return [clientNavigator.userAgentData?.platform, clientNavigator.platform, clientNavigator.userAgent].filter(Boolean).join(' ');
}

export function detectClientGuideOs(): Extract<GuideOsId, 'windows' | 'macos' | 'linux'> | null {
  const platformText = getClientPlatformText().toLowerCase();
  if (!platformText) return null;

  if (platformText.includes('win')) return 'windows';
  if (platformText.includes('mac')) return 'macos';
  if (platformText.includes('linux') && !platformText.includes('android')) return 'linux';

  return null;
}

export function getInitialGuideOsForAgent(agent: GuideAgentId): GuideOsId {
  const detectedOs = detectClientGuideOs();
  if (!detectedOs) return guideDefaultOsByAgent[agent];
  if (agent === 'codex') return detectedOs === 'windows' ? 'windows' : 'macos-linux';

  return detectedOs;
}

export function getAvailableGuideOsForAgent(agent: GuideAgentId, preferredOs: GuideOsId): GuideOsId {
  const availableOptions = guideOsOptionsByAgent[agent];
  if (availableOptions.some((option) => option.id === preferredOs)) return preferredOs;

  return getInitialGuideOsForAgent(agent);
}

export const guideDocumentSources: Record<GuideAgentId, Partial<Record<GuideOsId, string>>> = {
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

export function GuideMenuIcon({ size = 18 }: { size?: number }) {
  return <img className="nav-pixel-icon" src={guideIconSrc} alt="" width={size} height={size} />;
}
