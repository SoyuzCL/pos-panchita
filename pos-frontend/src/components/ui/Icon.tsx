import React from 'react';

interface IconProps {
  icon: React.ElementType<any>;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ icon: IconComponent, className }) => (
  <IconComponent className={`inline-block w-5 h-5 ${className || ''}`} />
);
