import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void; // Renamed from onCancel for clarity
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}) => {
  if (!isOpen) {
    return null;
  }

  // Prevent scrolling when modal is open (optional)
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup function to reset overflow when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    // Background overlay
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4"
      onClick={onClose} // Close if clicking overlay
    >
      {/* Modal content container */}
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <p className="text-sm text-gray-600">{message}</p>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white text-sm font-medium text-gray-700 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-sm font-medium text-white border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal; 