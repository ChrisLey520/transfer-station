import { currency, tokenK } from '../utils/format.js';
import { autoUpdate, flip, FloatingPortal, offset, shift, useDismiss, useFloating, useFocus, useHover, useInteractions, useRole } from '@floating-ui/react';
import { ChevronDown } from 'lucide-react';
import React from 'react';

export function ChevronUpIcon() {
  return <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />;
}

export function ButtonSpinner({ size = 15 }: { size?: number }) {
  return <span className="button-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function LoadingContent({
  children,
  icon,
  loading,
  loadingLabel
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  loading: boolean;
  loadingLabel?: React.ReactNode;
}) {
  return (
    <>
      {loading ? <ButtonSpinner /> : icon}
      {loading ? loadingLabel || children : children}
    </>
  );
}

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement<any> }) {
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

export function BreakdownItem({ label, tokens, cents }: { label: string; tokens: number; cents: number }) {
  return (
    <div className="breakdown-item">
      <span>{label}</span>
      <strong>{tokenK(tokens)}</strong>
      <em>{currency(cents, 'USD')}</em>
    </div>
  );
}

export function MetricBreakdownItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="breakdown-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{hint || ''}</em>
    </div>
  );
}

export function Empty({ t, children, className = '' }: { t: Record<string, string>; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <span>{t.noData}</span>
      {children}
    </div>
  );
}
