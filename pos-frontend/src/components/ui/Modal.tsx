import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { Icon } from './Icon';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'lg' }) => {
    if (!isOpen) return null;
    const sizeClasses = { 
        'lg': 'max-w-lg', 
        'xl': 'max-w-xl', 
        '2xl': 'max-w-2xl', 
        '3xl': 'max-w-3xl', 
        '4xl': 'max-w-4xl' 
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className={`bg-white rounded-lg shadow-xl w-full m-4 ${sizeClasses[size]}`}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    {onClose && <Button variant="ghost" size="sm" onClick={onClose}><Icon icon={X}/></Button>}
                </div>
                <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
                {footer && <div className="px-5 py-3 bg-gray-50 flex justify-end space-x-3">{footer}</div>}
            </div>
        </div>
    );
};
