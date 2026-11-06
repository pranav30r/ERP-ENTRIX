import React from 'react';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={title}
      description={description}
      confirmLabel={loading ? 'Processing...' : confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      isDestructive={variant === 'danger'}
      confirmDisabled={loading}
    />
  );
};

export default ConfirmDialog;
