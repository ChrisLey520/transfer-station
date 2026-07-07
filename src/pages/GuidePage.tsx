import { MarkdownRenderer } from '../components/markdown.js';
import { showErrorToast } from '../components/toast.js';
import { getAvailableGuideOsForAgent, getInitialGuideOsForAgent, guideAgentOptions, guideDocumentSources, guideIconSrc, guideOsOptionsByAgent } from '../config/guide.js';
import { GuideAgentId, GuideOsId } from '../types.js';
import React from 'react';

export function GuidePage({ t }: { t: Record<string, string> }) {
  const [selectedAgent, setSelectedAgent] = React.useState<GuideAgentId>('claude-code');
  const [selectedOs, setSelectedOs] = React.useState<GuideOsId>(() => getInitialGuideOsForAgent('claude-code'));
  const [markdown, setMarkdown] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const availableOsOptions = guideOsOptionsByAgent[selectedAgent];
  const selectedOsOption = availableOsOptions.find((option) => option.id === selectedOs) || availableOsOptions[0];
  const documentSrc = guideDocumentSources[selectedAgent][selectedOsOption.id] || '';
  const selectedAgentLabel = guideAgentOptions.find((option) => option.id === selectedAgent)?.label || selectedAgent;
  const selectedOsLabel = selectedOsOption.label;

  React.useEffect(() => {
    if (!availableOsOptions.some((option) => option.id === selectedOs)) {
      setSelectedOs(getAvailableGuideOsForAgent(selectedAgent, selectedOs));
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
