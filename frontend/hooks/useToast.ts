import { useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';

type ToastType = 'success' | 'error' | 'loading' | 'custom';

export function useToast() {
  const show = useCallback((message: string, type: ToastType = 'custom', duration: number = 3000) => {
    switch (type) {
      case 'success':
        return toast.success(message, { duration, className: 'toastify toast-success' });
      case 'error':
        return toast.error(message, { duration: 5000, className: 'toastify toast-error' });
      case 'loading':
        return toast.loading(message, { className: 'toastify toast-loading' });
      default:
        return toast(message, { duration, className: 'toastify' });
    }
  }, []);

  const update = useCallback((toastId: string, message: string, type: ToastType) => {
    // Dismiss old toast first, then show new one and return its ID
    toast.dismiss(toastId);
    return show(message, type);
  }, [show]);

  const dismiss = useCallback((toastId?: string) => toast.dismiss(toastId), []);

  return useMemo(() => ({
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    loading: (msg: string) => show(msg, 'loading'),
    custom: (msg: string) => show(msg, 'custom'),
    update,
    dismiss,
  }), [show, update, dismiss]);
}