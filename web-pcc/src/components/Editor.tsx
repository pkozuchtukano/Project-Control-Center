import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Pilcrow, Quote, Redo, Underline as UnderlineIcon, Undo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  openLinksOnClick?: boolean;
  minHeight?: number;
  onEditorReady?: (editor: TiptapEditor | null) => void;
}

const MenuButton = ({ title, onClick, isActive, disabled, children }: { title: string; onClick: () => void; isActive?: boolean; disabled?: boolean; children: React.ReactNode }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'rounded-md p-2 transition-colors disabled:opacity-30',
      isActive ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
    )}
  >
    {children}
  </button>
);

export const Editor = ({ content, onChange, placeholder = 'Zacznij pisaæ...', openLinksOnClick = false, minHeight = 380, onEditorReady }: EditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: openLinksOnClick }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) editor.commands.setContent(content);
  }, [content, editor]);

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  if (!editor) return null;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50/70 p-2 dark:border-gray-700 dark:bg-gray-800/50">
        <MenuButton title="Pogrubienie" onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}><Bold size={18} /></MenuButton>
        <MenuButton title="Kursywa" onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}><Italic size={18} /></MenuButton>
        <MenuButton title="Podkreœlenie" onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')}><UnderlineIcon size={18} /></MenuButton>
        <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />
        <MenuButton title="Akapit" onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')}><Pilcrow size={18} /></MenuButton>
        <MenuButton title="Nag³ówek 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })}><Heading1 size={18} /></MenuButton>
        <MenuButton title="Nag³ówek 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })}><Heading2 size={18} /></MenuButton>
        <MenuButton title="Nag³ówek 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })}><Heading3 size={18} /></MenuButton>
        <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />
        <MenuButton title="Lista punktowana" onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')}><List size={18} /></MenuButton>
        <MenuButton title="Lista numerowana" onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')}><ListOrdered size={18} /></MenuButton>
        <MenuButton title="Cytat" onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')}><Quote size={18} /></MenuButton>
        <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />
        <MenuButton title="Cofnij" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo size={18} /></MenuButton>
        <MenuButton title="Ponów" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo size={18} /></MenuButton>
      </div>
      <div className="cursor-text p-4" style={{ minHeight: `${minHeight + 20}px` }} onMouseDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.ProseMirror')) return;
        editor.chain().focus().run();
      }}>
        <EditorContent editor={editor} className="prose max-w-none dark:prose-invert" />
      </div>
      <style>{`
        .ProseMirror { min-height: ${minHeight}px; outline: none; color: #111827; caret-color: #4f46e5; }
        .dark .ProseMirror { color: #f9fafb; caret-color: #818cf8; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9ca3af; float: left; height: 0; pointer-events: none; }
        .ProseMirror h1 { font-size: 2rem; font-weight: 700; margin: 0 0 0.8em 0; }
        .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; margin: 1.2em 0 0.7em 0; }
        .ProseMirror h3 { font-size: 1.25rem; font-weight: 600; margin: 1.1em 0 0.6em 0; }
        .ProseMirror blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; color: #6b7280; font-style: italic; margin: 1em 0; }
      `}</style>
    </div>
  );
};
