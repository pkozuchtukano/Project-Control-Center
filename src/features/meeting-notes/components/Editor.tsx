import { useEffect, useMemo } from 'react';
import { useEditor, useEditorState, EditorContent, type Editor as TiptapEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import { getSuggestionParams } from './suggestion';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Pilcrow,
  Quote, Undo, Redo, Highlighter, Eraser
} from 'lucide-react';

const Highlight = Mark.create({
  name: 'highlight',
  addAttributes() {
    return {
      color: {
        default: '#fde047',
        parseHTML: element => element.getAttribute('data-color') || element.style.backgroundColor || '#fde047',
        renderHTML: attributes => ({
          'data-color': attributes.color,
          style: `background-color: ${attributes.color}; color: #111827`,
        }),
      },
    };
  },
  parseHTML() { return [{ tag: 'mark' }]; },
  renderHTML({ HTMLAttributes }) { return ['mark', HTMLAttributes, 0]; },
});

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  stakeholders?: { id: string, name: string }[];
  openLinksOnClick?: boolean;
  minHeight?: number;
  toolbar?: 'fixed' | 'selection';
  onEditorReady?: (editor: TiptapEditor | null) => void;
}

const MenuButton = ({
  onClick,
  isActive,
  disabled = false,
  children,
  title
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    aria-pressed={isActive}
    onMouseDown={event => event.preventDefault()}
    className={`p-2 rounded-md transition-colors ${
      isActive
        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
    } disabled:opacity-30`}
  >
    {children}
  </button>
);

export const Editor = ({
  content,
  onChange,
  placeholder = 'Zacznij pisać notatki...',
  stakeholders = [],
  openLinksOnClick = false,
  minHeight = 380,
  toolbar = 'fixed',
  onEditorReady
}: EditorProps) => {
  const effectivePlaceholder = placeholder.includes('Ä')
    ? 'Zacznij pisa\u0107 notatki...'
    : placeholder;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      Highlight,
      Link.configure({
        openOnClick: openLinksOnClick,
      }),
      Placeholder.configure({
        placeholder: effectivePlaceholder,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention'
        },
        suggestion: getSuggestionParams(stakeholders),
        renderText({ node }) {
          return `${node.attrs.label ?? node.attrs.id}`;
        },
        renderHTML({ options, node }) {
          return [
            'span',
            options.HTMLAttributes || { class: 'mention' },
            `${node.attrs.label ?? node.attrs.id}`,
          ];
        },
      }),
    ],
    content,
    editable: true,
    editorProps: { attributes: { style: `min-height: ${minHeight}px` } },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEditorState({ editor, selector: ({ transactionNumber }) => transactionNumber });

  const bubbleMenuOptions = useMemo(() => ({
    strategy: 'fixed', placement: 'top', offset: 8,
    flip: { padding: 8 }, shift: { padding: 8 },
    scrollTarget: editor?.view.dom.closest<HTMLElement>('.overflow-y-auto, .overflow-auto') || window,
  } as const), [editor]);

  useEffect(() => {
    onEditorReady?.(editor ?? null);

    return () => {
      onEditorReady?.(null);
    };
  }, [editor, onEditorReady]);

  if (!editor) {
    return null;
  }

  const menu = (
      <div role="toolbar" aria-label="Formatowanie tekstu" className={`flex flex-wrap items-center gap-1 p-2 ${toolbar === 'selection' ? 'max-w-[min(640px,calc(100vw-24px))] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-900' : 'border-b border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50'}`}>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Pogrubienie"
        >
          <Bold size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Kursywa"
        >
          <Italic size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Podkreślenie"
        >
          <UnderlineIcon size={18} />
        </MenuButton>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive('paragraph')}
          title="Zwykły tekst"
        >
          <Pilcrow size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Nagłówek 1"
        >
          <Heading1 size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Nagłówek 2"
        >
          <Heading2 size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Nagłówek 3"
        >
          <Heading3 size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          isActive={editor.isActive('heading', { level: 4 })}
          title="Nagłówek 4"
        >
          <Heading4 size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
          isActive={editor.isActive('heading', { level: 5 })}
          title="Nagłówek 5"
        >
          <Heading5 size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
          isActive={editor.isActive('heading', { level: 6 })}
          title="Nagłówek 6"
        >
          <Heading6 size={18} />
        </MenuButton>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Lista punktowana"
        >
          <List size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Lista numerowana"
        >
          <ListOrdered size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Cytat"
        >
          <Quote size={18} />
        </MenuButton>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Cofnij"
        >
          <Undo size={18} />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Ponów"
        >
          <Redo size={18} />
        </MenuButton>
        {toolbar === 'selection' && <>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          {[
            { color: '#fca5a5', title: 'Wyróżnij na czerwono' },
            { color: '#fde047', title: 'Wyróżnij na żółto' },
            { color: '#86efac', title: 'Wyróżnij na zielono' },
          ].map(({ color, title }) => (
            <MenuButton key={color} title={title}
              isActive={editor.isActive('highlight', { color })}
              onClick={() => editor.chain().focus().toggleMark('highlight', { color }).run()}>
              <Highlighter size={18} style={{ backgroundColor: color, color: '#111827', borderRadius: 3 }} />
            </MenuButton>
          ))}
          <MenuButton title="Usuń wyróżnienie" disabled={!editor.isActive('highlight')}
            onClick={() => editor.chain().focus().unsetMark('highlight').run()}><Eraser size={18} /></MenuButton>
        </>}
      </div>
  );

  return (
    <div className="flex flex-col w-full border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
      {toolbar === 'selection' ? <BubbleMenu editor={editor} appendTo={document.body} updateDelay={100}
        style={{ zIndex: 60 }} options={bubbleMenuOptions}>
        {menu}
      </BubbleMenu> : menu}
      <div
        className="p-4 cursor-text"
        style={{ minHeight: `${Math.max(minHeight + 20, 120)}px` }}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('.ProseMirror')) return;
          editor.chain().focus().run();
        }}
      >
        <EditorContent editor={editor} className="prose dark:prose-invert max-w-none focus:outline-none" />
      </div>

      <style>{`
        .ProseMirror h1 { font-size: 2.25em; font-weight: 700; margin-top: 0; margin-bottom: 0.8em; line-height: 1.1; }
        .ProseMirror h2 { font-size: 1.5em; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.8em; line-height: 1.3; }
        .ProseMirror h3 { font-size: 1.25em; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.6em; line-height: 1.4; }
        .ProseMirror h4 { font-size: 1.125em; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.5; }
        .ProseMirror h5 { font-size: 1em; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.5; }
        .ProseMirror h6 { font-size: 0.875em; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.5; text-transform: uppercase; }
        .ProseMirror blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; color: #6b7280; font-style: italic; margin-top: 1.5em; margin-bottom: 1.5em; }
        .ProseMirror ul { list-style-type: disc; padding-left: 1.5em; margin-top: 1em; margin-bottom: 1em; }
        .ProseMirror ol { list-style-type: decimal; padding-left: 1.5em; margin-top: 1em; margin-bottom: 1em; }
        .ProseMirror li { margin-top: 0.9em; margin-bottom: 0.9em; }
        .ProseMirror li p { margin-top: 0.35em; margin-bottom: 0.35em; }
        .ProseMirror p { margin-top: 0.75em; margin-bottom: 0.75em; line-height: 1.6; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror {
          outline: none;
          color: #111827;
          caret-color: #4f46e5;
        }
        .dark .ProseMirror {
          color: #f9fafb;
          caret-color: #818cf8;
        }
      `}</style>
    </div>
  );
};
