import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  id?: string;
  icon?: React.ElementType<any>;
}

export const Input: React.FC<InputProps> = ({ label, id, icon: IconComponent, className, ...props }) => (
    <div className="w-full">
        {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <div className="relative rounded-md shadow-sm">
            {IconComponent && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IconComponent className="text-gray-400" /></div>}
            <input id={id} className={`block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white ${IconComponent ? 'pl-10' : ''} ${className || ''}`} {...props} />
        </div>
    </div>
);
