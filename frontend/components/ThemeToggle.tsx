import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#1a1a2e] border border-gray-300 dark:border-gray-700 flex items-center justify-center hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-300"
      aria-label="Toggle theme"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <span className="transition-transform duration-300" style={{ transform: theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)' }}>
        {theme === 'dark'
          ? <Sun size={15} className="text-yellow-400" />
          : <Moon size={15} className="text-gray-600" />
        }
      </span>
    </button>
  );
}