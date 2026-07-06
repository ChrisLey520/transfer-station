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
