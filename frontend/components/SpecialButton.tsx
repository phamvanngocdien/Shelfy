import { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  height?: string;
  bgColor?: string;
  textColor?: string;
  darkBgColor?: string;
  darkTextColor?: string;
}

export default function SpecialButton({
  title,
  height = '2.5rem',
  bgColor = '#ff77c9',
  textColor = '#ffffff',
  darkBgColor = '#db2777',
  darkTextColor = '#ffffff',
  className,
  disabled,
  ...props
}: Props) {
  const width = `calc(${height} * 0.3)`;

  const customStyles = {
    height,
    paddingRight: width,
    backgroundColor: 'transparent',
    '--btn-bg': bgColor,
    '--btn-text': textColor,
    '--btn-bg-dark': darkBgColor,
    '--btn-text-dark': darkTextColor,
  } as React.CSSProperties;

  return (
    <button
      className={cn(
        'relative border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group',
        className
      )}
      style={customStyles}
      disabled={disabled}
      {...props}
    >
      <div className="absolute right-0 top-0 h-full" style={{ width }}>
        <svg
          width="100%" height="100%" viewBox="0 0 12 40" preserveAspectRatio="none"
          className="fill-[var(--btn-bg)] dark:fill-[var(--btn-bg-dark)] transition-colors duration-200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 0H0v40h.492a6 6 0 0 0 5.204-3.014l4.712-8.212A12 12 0 0 0 12 22.802V4a4 4 0 0 0-4-4Z" />
        </svg>
      </div>
      <span
        className="flex items-center justify-center h-full font-bold rounded-l transition-colors duration-200 text-[var(--btn-text)] bg-[var(--btn-bg)] dark:text-[var(--btn-text-dark)] dark:bg-[var(--btn-bg-dark)]"
        style={{ paddingLeft: `calc(${width} + 5px)`, paddingRight: '5px' }}
      >
        {title}
      </span>
    </button>
  );
}