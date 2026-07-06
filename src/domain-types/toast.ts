export type ToastVariant = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

export type ToastListener = (toast: ToastItem) => void;
