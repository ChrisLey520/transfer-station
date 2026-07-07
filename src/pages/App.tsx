import { tr } from '../i18n.js';
import { AnnouncementModal } from './AnnouncementsPanel.js';
import { AuthPage } from './AuthPage.js';
import { AppContent } from './app/AppContent.js';
import { AccountActions, AppFrame, AppTopbar, RefreshButton } from './app/AppShell.js';
import { useAppController } from './app/useAppController.js';
import { GuideMenuIcon } from '../config/guide.js';
import { GuidePage } from './GuidePage.js';
import { ShieldCheck } from 'lucide-react';

export function App() {
  const app = useAppController();
  const isPlansPage = app.activeTab === 'plans';
  const showPageBackButton = app.activeTab === 'user-detail' || (app.activeTab === 'plans' && app.planView === 'change');

  if (app.isPublicHome) {
    return (
      <PublicHome
        onOpenDashboard={() => app.navigate('dashboard')}
      />
    );
  }

  if (!app.authToken && (app.activeTab === 'guide' || app.isPublicGuide)) {
    return (
      <AppFrame
        activeTab="guide"
        brand={app.t.brand}
        closeLabel={app.closeMenuLabel}
        isNavDrawerOpen={app.isNavDrawerOpen}
        nav={[{ id: 'guide', label: app.t.guide, icon: GuideMenuIcon }]}
        onCloseNav={() => app.setIsNavDrawerOpen(false)}
        onNavigate={app.navigate}
        shellClassName="app-shell public-guide-shell"
        subtitle={app.t.subtitle}
      >
        <AppTopbar
          accentTheme={app.accentTheme}
          closeMenuLabel={app.closeMenuLabel}
          isNavDrawerOpen={app.isNavDrawerOpen}
          language={app.language}
          onToggleNav={() => app.setIsNavDrawerOpen((isOpen) => !isOpen)}
          openMenuLabel={app.openMenuLabel}
          setAccentTheme={app.setAccentTheme}
          setLanguage={app.setLanguage}
          setThemeMode={app.changeThemeMode}
          t={app.t}
          themeMode={app.themeMode}
          title={app.t.guideTitle}
        >
          <button type="button" className="secondary-button" onClick={() => app.navigate('dashboard')}>
            {app.t.login}
          </button>
        </AppTopbar>
        <GuidePage t={app.t} />
      </AppFrame>
    );
  }

  if (!app.authToken) {
    return (
      <AuthPage
        t={app.t}
        language={app.language}
        setLanguage={app.setLanguage}
        themeMode={app.themeMode}
        setThemeMode={app.changeThemeMode}
        accentTheme={app.accentTheme}
        setAccentTheme={app.setAccentTheme}
        onAuthenticated={app.authenticate}
      />
    );
  }

  if (!app.isBootstrapReady) {
    return (
      <AppFrame
        activeTab={app.activeTab}
        brand={app.t.brand}
        closeLabel={app.closeMenuLabel}
        isNavDrawerOpen={app.isNavDrawerOpen}
        nav={[]}
        onCloseNav={() => app.setIsNavDrawerOpen(false)}
        onNavigate={app.navigate}
        shellClassName="app-shell app-bootstrap-shell"
        subtitle={app.t.subtitle}
      >
        <AppTopbar
          accentTheme={app.accentTheme}
          closeMenuLabel={app.closeMenuLabel}
          isNavDrawerOpen={app.isNavDrawerOpen}
          language={app.language}
          onToggleNav={() => app.setIsNavDrawerOpen((isOpen) => !isOpen)}
          openMenuLabel={app.openMenuLabel}
          setAccentTheme={app.setAccentTheme}
          setLanguage={app.setLanguage}
          setThemeMode={app.changeThemeMode}
          t={app.t}
          themeMode={app.themeMode}
          title={app.pageTitle}
        >
          <RefreshButton disabled={app.refreshing} onRefresh={() => void app.handleRefresh()} refreshing={app.refreshing} title={app.t.refresh} />
        </AppTopbar>
        {app.loading ? <div className="loading-line" /> : null}
        <section className="bootstrap-status" aria-live="polite">
          <ShieldCheck size={22} />
          <p>{app.loading ? tr(app.t, 'loadingWorkspace', '正在加载工作台...') : app.t.requestFailed}</p>
        </section>
      </AppFrame>
    );
  }

  return (
    <AppFrame
      activeTab={app.activeTab}
      brand={app.t.brand}
      closeLabel={app.closeMenuLabel}
      isNavDrawerOpen={app.isNavDrawerOpen}
      mainClassName={app.activeTab === 'announcements' ? 'main-panel announcement-main-panel' : isPlansPage ? 'main-panel plans-main-panel' : 'main-panel'}
      nav={app.nav}
      onCloseNav={() => app.setIsNavDrawerOpen(false)}
      onNavigate={app.navigate}
      subtitle={app.t.subtitle}
      afterMain={
        app.data.announcement?.shouldShow ? (
          <AnnouncementModal
            announcement={app.data.announcement}
            busyAction={app.announcementAction}
            onClose={() => void app.dismissAnnouncement('close')}
            onCloseToday={() => void app.dismissAnnouncement('closeToday')}
          />
        ) : null
      }
    >
      <AppTopbar
        accentTheme={app.accentTheme}
        backButton={
          showPageBackButton
            ? {
                label: app.activeTab === 'user-detail' ? '返回用户列表' : app.t.returnBilling,
                onClick: () => {
                  if (app.activeTab === 'user-detail') {
                    app.navigate('users');
                    return;
                  }
                  app.navigate('plans', 'billing');
                }
              }
            : undefined
        }
        closeMenuLabel={app.closeMenuLabel}
        isNavDrawerOpen={app.isNavDrawerOpen}
        language={app.language}
        onToggleNav={() => app.setIsNavDrawerOpen((isOpen) => !isOpen)}
        openMenuLabel={app.openMenuLabel}
        setAccentTheme={app.setAccentTheme}
        setLanguage={app.setLanguage}
        setThemeMode={app.changeThemeMode}
        t={app.t}
        themeMode={app.themeMode}
        title={app.pageTitle}
      >
        <AccountActions
          data={app.data}
          disabled={app.refreshing}
          headers={app.headers}
          onLogout={app.logout}
          onRefresh={() => void app.handleRefresh()}
          refreshing={app.refreshing}
          t={app.t}
        />
      </AppTopbar>
      {app.loading ? <div className="loading-line" /> : null}
      <AppContent
        activeTab={app.activeTab}
        activeUserId={app.activeUserId}
        data={app.data}
        headers={app.headers}
        onChangePlanView={app.changePlanView}
        onNavigate={app.navigate}
        onOpenPlanChange={app.openPlanChange}
        onRefresh={app.handleRefresh}
        planView={app.planView}
        refreshTick={app.refreshTick}
        reload={app.load}
        t={app.t}
      />
    </AppFrame>
  );
}

function PublicHome({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  return (
    <main className="seo-fallback">
      <section>
        <img src="/guide-icon.png" alt="" width={66} height={60} />
        <p>Claude Code / Codex API 满血中转服务</p>
        <h1>RelayHub - Claude Code / Codex API 中转站</h1>
        <p>
          RelayHub 面向 Claude Code、Codex 和 AI 智能体用户，提供 API 中转站、统一接入、密钥管理、用量统计、套餐额度和客户端配置指南。
        </p>
        <section aria-labelledby="home-features-title">
          <h2 id="home-features-title">RelayHub 能解决什么问题</h2>
          <ul>
            <li>统一管理 Claude Code 与 Codex 的 API 中转接入地址和客户端密钥。</li>
            <li>按 5 小时与 7 天周期统计 Token 用量，帮助团队控制智能体调用成本。</li>
            <li>提供 Claude Code、Codex、CC-Switch、macOS、Windows、Linux 等常见接入指南。</li>
          </ul>
        </section>
        <nav aria-label="RelayHub 页面">
          <a
            className="primary-button"
            href="/dashboard"
            onClick={(event) => {
              event.preventDefault();
              onOpenDashboard();
            }}
          >
            登录管理台
          </a>
          <a
            className="secondary-button"
            href="/guide/"
          >
            查看接入指南
          </a>
        </nav>
      </section>
    </main>
  );
}
