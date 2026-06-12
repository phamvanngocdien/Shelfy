import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  delay?: number;
}

export default function SearchBar({
  value,
  onChange,
  className,
  placeholder = 'Search by discord handle...',
  delay = 300,
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== value) onChange(inputValue);
    }, delay);
    return () => clearTimeout(timer);
  }, [inputValue, delay, onChange, value]);

  return (
    <input
      type="text"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'bg-white dark:bg-[#12121f] border border-gray-300 dark:border-gray-800 rounded-xl px-4 py-3 w-full max-w-md text-sm text-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 outline-none transition',
        className
      )}
    />
  );
}