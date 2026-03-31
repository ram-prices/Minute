import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Link, Bold, Italic, Strikethrough, Code, Quote, List, ListOrdered } from 'lucide-react';
import { Ripple } from './Ripple';
import { SquigglyLoader } from './SquigglyLoader';
import RedditMarkdown from './RedditMarkdown';

interface ReplyComposerProps {
  originalContent: string;
  originalAuthor: string;
  ancestors?: { author: string; body: string }[];
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}

export default function ReplyComposer({ originalContent, originalAuthor, ancestors, onSubmit, onCancel, isOpen }: ReplyComposerProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the textarea when the component mounts and opens
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
    // Scroll the chain to the bottom so the current comment is visible
    if (isOpen) {
      const scrollDown = () => {
        if (chainScrollRef.current) {
          chainScrollRef.current.scrollTop = chainScrollRef.current.scrollHeight;
        }
      };
      
      // Try immediately
      scrollDown();
      
      // And also after a short delay to account for rendering/animation
      setTimeout(scrollDown, 50);
      setTimeout(scrollDown, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ ...window.history.state, replyOpen: true }, '');
      
      const handlePopState = (e: PopStateEvent) => {
        if (!e.state?.replyOpen) {
          onCancel();
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, onCancel]);

  const handleClose = () => {
    if (window.history.state?.replyOpen) {
      window.history.back();
    } else {
      onCancel();
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text);
      setText('');
      handleClose();
    } catch (err) {
      console.error('Failed to submit reply', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    const beforeText = text.substring(0, start);
    const afterText = text.substring(end);

    const newText = beforeText + prefix + selectedText + suffix + afterText;
    setText(newText);

    // Set cursor position after the state updates
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: "spring", stiffness: 300, damping: 30, mass: 1 }}
          className="fixed inset-0 bg-bg-primary z-[100] flex flex-col"
        >
          <header className="sticky top-0 z-50 bg-bg-primary/90 backdrop-blur-md px-4 pt-4 pb-2 safe-top shrink-0 border-b border-bg-tertiary">
            <div className="flex items-center justify-between">
              <button 
                onClick={handleClose}
                className="relative p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-full transition-colors active:scale-95 overflow-hidden"
              >
                <ArrowLeft size={24} />
                <Ripple />
              </button>
              <button 
                onClick={handleSubmit}
                disabled={!text.trim() || isSubmitting}
                className={`relative p-2 text-primary hover:bg-primary/10 rounded-full transition-all active:scale-90 overflow-hidden ${(!text.trim() || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? <SquigglyLoader size={24} /> : <Send size={24} />}
                <Ripple />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Original Content Chain */}
            <div 
              ref={chainScrollRef}
              className="max-h-[35vh] overflow-y-auto bg-bg-secondary/50 border-b border-bg-tertiary overscroll-contain"
            >
              <div className="p-4 flex flex-col gap-3">
                {ancestors?.map((ancestor, i) => (
                  <div key={i} className="relative pl-4">
                    <div className="absolute left-0 top-1.5 bottom-[-12px] w-[2px] bg-bg-tertiary" />
                    <div className="text-xs text-text-secondary font-medium mb-1">{ancestor.author}</div>
                    <div className="text-sm text-text-primary opacity-60 prose dark:prose-invert prose-sm max-w-none break-anywhere line-clamp-3">
                      <RedditMarkdown content={ancestor.body} />
                    </div>
                  </div>
                ))}
                
                <div className="relative pl-4">
                  {ancestors && ancestors.length > 0 && (
                    <div className="absolute left-0 top-0 h-1.5 w-[2px] bg-bg-tertiary" />
                  )}
                  <div className="absolute left-[-3px] top-1.5 w-[8px] h-[8px] rounded-full bg-primary" />
                  <div className="text-xs text-primary font-medium mb-1">Replying to {originalAuthor}</div>
                  <div className="text-sm text-text-primary opacity-90 prose dark:prose-invert prose-sm max-w-none break-anywhere">
                    <RedditMarkdown content={originalContent} />
                  </div>
                </div>
              </div>
            </div>

            {/* Text Area */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a comment"
              className="flex-1 w-full p-4 bg-transparent text-text-primary placeholder-text-secondary resize-none outline-none text-base"
            />
          </div>

          {/* Formatting Toolbar */}
          <div className="sticky bottom-0 bg-bg-secondary border-t border-bg-tertiary p-2 flex items-center gap-1 overflow-x-auto hide-scrollbar safe-bottom">
            <ToolbarButton icon={<Link size={20} />} onClick={() => insertFormatting('[', '](url)')} />
            <ToolbarButton icon={<Bold size={20} />} onClick={() => insertFormatting('**', '**')} />
            <ToolbarButton icon={<Italic size={20} />} onClick={() => insertFormatting('*', '*')} />
            <ToolbarButton icon={<Strikethrough size={20} />} onClick={() => insertFormatting('~~', '~~')} />
            <ToolbarButton icon={<Code size={20} />} onClick={() => insertFormatting('`', '`')} />
            <ToolbarButton icon={<Quote size={20} />} onClick={() => insertFormatting('> ')} />
            <ToolbarButton icon={<List size={20} />} onClick={() => insertFormatting('- ')} />
            <ToolbarButton icon={<ListOrdered size={20} />} onClick={() => insertFormatting('1. ')} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

function ToolbarButton({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors shrink-0"
    >
      {icon}
    </button>
  );
}
