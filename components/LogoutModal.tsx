'use client';

type LogoutModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function LogoutModal({ open, onClose, onConfirm }: LogoutModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-stone-800 mb-2">Logout</h3>
        <p className="text-stone-600 text-sm mb-6">Are you sure you want to logout?</p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary py-2">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary py-2 bg-red-600 hover:bg-red-700">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
