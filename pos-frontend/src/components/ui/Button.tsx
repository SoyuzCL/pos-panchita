import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'custom';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className, ...props }) => {
    const baseStyle = "font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 ease-in-out flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variantStyles = { 
        primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500", 
        secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500", 
        danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500", 
        ghost: "bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300", 
        custom: "" 
    };
    const sizeStyles = { 
        sm: "px-3 py-1.5 text-sm", 
        md: "px-4 py-2 text-base", 
        lg: "px-6 py-3 text-lg" 
    };
    return (
        <button className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`} {...props}>
            {children}
        </button>
    );
};
