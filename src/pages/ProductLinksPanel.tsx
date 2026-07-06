import { LoadingContent } from '../components/common.js';
import { showErrorToast, showSuccessToast } from '../components/toast.js';
import { creditProductOptions, defaultPurchaseLinks, planProductOptions, productLinkUrl, purchaseChannels } from '../config/purchase.js';
import { tr } from '../i18n.js';
import { ProductItemType, ProductLink, PurchaseChannelId, PurchaseProductOption } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { ShoppingBag } from 'lucide-react';
import React from 'react';

export function ProductLinksPanel({
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
            <LoadingContent loading={saving} icon={<ShoppingBag size={17} />} loadingLabel={tr(t, 'saving', '保存中...')}>
              {tr(t, 'saveProducts', '保存商品链接')}
            </LoadingContent>
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

export function productLinkFormKey(itemType: ProductItemType, itemId: string, channel: PurchaseChannelId) {
  return `${itemType}:${itemId}:${channel}`;
}

export function buildProductLinkForm(productRows: PurchaseProductOption[], productLinks: ProductLink[]) {
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
