'use client';

import { useCallback, useEffect } from 'react';
import LinkExtension from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';

export default function RichTextEditor({
  label = 'Editor',
  value = '',
  onChange,
  minHeight = 220,
  maxHeight = 800,
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
      }),
    ],
    content: value || '',
    onUpdate({ editor: currentEditor }) {
      if (typeof onChange === 'function') {
        onChange(currentEditor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = value || '';
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  const applyFormat = useCallback(
    (command, commandValue = null) => {
      if (!editor) return;
      switch (command) {
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'insertUnorderedList':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'insertOrderedList':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'createLink':
          editor.chain().focus().extendMarkRange('link').setLink({ href: commandValue }).run();
          break;
        case 'removeFormat':
          editor.chain().focus().unsetAllMarks().clearNodes().run();
          break;
        default:
          break;
      }
    },
    [editor]
  );

  return (
    <>
      <label className="form-label">{label}</label>
      <div className="border rounded">
        <div className="p-2 border-bottom d-flex flex-wrap" style={{ gap: '6px' }}>
          <button type="button" className="btn btn-light btn-sm" disabled={!editor} onClick={() => applyFormat('bold')}>
            Bold
          </button>
          <button type="button" className="btn btn-light btn-sm" disabled={!editor} onClick={() => applyFormat('italic')}>
            Italic
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={!editor}
            onClick={() => applyFormat('insertUnorderedList')}
          >
            Bullet List
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={!editor}
            onClick={() => applyFormat('insertOrderedList')}
          >
            Numbered List
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={!editor}
            onClick={() => {
              const url = window.prompt('Enter link URL');
              if (url) applyFormat('createLink', url);
            }}
          >
            Link
          </button>
          <button type="button" className="btn btn-light btn-sm" disabled={!editor} onClick={() => applyFormat('removeFormat')}>
            Clear Format
          </button>
        </div>
        <div
          className="p-3"
          style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px`, overflowY: 'auto', outline: 'none' }}
        >
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <textarea
              className="form-control"
              value={value}
              onChange={(e) => {
                if (typeof onChange === 'function') onChange(e.target.value);
              }}
              style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
            />
          )}
        </div>
      </div>
    </>
  );
}
