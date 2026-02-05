import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Button } from '../../ui';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Describe what you want to build...',
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-bg-secondary px-5 py-4">
      <form
        className="flex gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            className="w-full min-h-[44px] max-h-[200px] bg-bg-primary border border-border rounded-lg px-4 py-3 pr-10 text-sm leading-relaxed text-text-primary font-mono resize-none outline-none transition-colors duration-150 focus:border-accent placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Connecting...' : placeholder}
            disabled={disabled}
            rows={1}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={disabled || !value.trim()}
          title="Send message (Enter)"
          className="size-11 shrink-0 rounded-lg text-base"
        >
          ↑
        </Button>
      </form>
      <div className="flex gap-3 mt-2 text-[11px] text-text-muted">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-bg-tertiary border border-border rounded text-[10px] font-mono">Enter</kbd> to send
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-bg-tertiary border border-border rounded text-[10px] font-mono">Shift</kbd> + <kbd className="px-1 py-0.5 bg-bg-tertiary border border-border rounded text-[10px] font-mono">Enter</kbd> for new line
        </span>
      </div>
    </div>
  );
}
