declare module '@phosphor-icons/react' {
  import { IconProps } from 'react';
  export interface PhosphorIconProps extends IconProps {
    weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
    size?: number | string;
    className?: string;
  }
  export const X: React.FC<PhosphorIconProps>;
  export const Download: React.FC<PhosphorIconProps>;
  export const Spinner: React.FC<PhosphorIconProps>;
} 