export function BrandMark() {
  return (
    <svg className="brand-mark-icon" viewBox="0 0 44 44" role="img" aria-label="RelayHub">
      <path className="brand-mark-monogram" d="M13.5 33.2V10.9h11.6c5 0 8.2 2.9 8.2 7.3s-3.2 7.3-8.2 7.3H13.5" />
      <path className="brand-mark-leg" d="M22.5 25.7 32 33.2" />
      <path className="brand-mark-relay" d="M23.2 18.2h9.6m-3.5-3.4 3.5 3.4-3.5 3.4" />
      <circle className="brand-mark-core" cx="22.7" cy="18.2" r="3.1" />
    </svg>
  );
}

export function BrandSubtitle({ subtitle }: { subtitle: string }) {
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
