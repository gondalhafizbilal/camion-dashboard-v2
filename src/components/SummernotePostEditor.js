'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function SummernotePostEditor({ label = 'Content', value = '', onChange, placeholder = 'Write post content here...' }) {
  const editorRef = useRef(null);
  const jqueryRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef('');
  const isSyncingRef = useRef(false);
  const [ready, setReady] = useState(false);

  const normalizedValue = useMemo(() => String(value || ''), [value]);

  useEffect(() => {
    valueRef.current = normalizedValue;
  }, [normalizedValue]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    const initEditor = async () => {
      const jqueryModule = await import('jquery');
      const $ = jqueryModule.default;

      window.$ = $;
      window.jQuery = $;

      await import('summernote/dist/summernote-lite.js');

      if (cancelled || !editorRef.current) return;

      const $editor = $(editorRef.current);
      jqueryRef.current = $editor;

      $editor.summernote({
        height: 360,
        minHeight: 220,
        maxHeight: 800,
        dialogsInBody: true,
        disableDragAndDrop: false,
        tabsize: 2,
        placeholder,
        styleTags: [
          'p',
          { title: 'Blockquote', tag: 'blockquote', className: 'blockquote', value: 'blockquote' },
          'pre',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
        ],
        fontNames: [
          'Arial',
          'Arial Black',
          'Comic Sans MS',
          'Courier New',
          'Helvetica',
          'Impact',
          'Tahoma',
          'Times New Roman',
          'Verdana',
        ],
        fontNamesIgnoreCheck: ['Arial', 'Courier New', 'Times New Roman', 'Verdana', 'Tahoma', 'Helvetica'],
        fontSizes: ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48'],
        lineHeights: ['0.8', '1.0', '1.2', '1.4', '1.5', '1.8', '2.0', '3.0'],
        toolbar: [
          ['style', ['style']],
          ['font', ['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript', 'clear']],
          ['fontname', ['fontname']],
          ['fontsize', ['fontsize']],
          ['color', ['forecolor', 'backcolor', 'color']],
          ['para', ['ul', 'ol', 'paragraph', 'height']],
          ['insert', ['link', 'picture', 'video', 'table', 'hr']],
          ['misc', ['undo', 'redo']],
          ['view', ['fullscreen', 'codeview', 'help']],
        ],
        popover: {
          image: [
            ['imagesize', ['imageSize100', 'imageSize50', 'imageSize25']],
            ['float', ['floatLeft', 'floatRight', 'floatNone']],
            ['remove', ['removeMedia']],
          ],
          link: [
            ['link', ['linkDialogShow', 'unlink']],
          ],
          table: [
            ['add', ['addRowDown', 'addRowUp', 'addColLeft', 'addColRight']],
            ['delete', ['deleteRow', 'deleteCol', 'deleteTable']],
          ],
          air: [
            ['color', ['color']],
            ['font', ['bold', 'underline', 'clear']],
            ['para', ['ul', 'paragraph']],
            ['table', ['table']],
            ['insert', ['link', 'picture']],
          ],
        },
        callbacks: {
          onChange: (contents) => {
            if (isSyncingRef.current) return;
            onChangeRef.current?.(contents);
          },
        },
      });

      isSyncingRef.current = true;
      $editor.summernote('code', valueRef.current);
      isSyncingRef.current = false;
      setReady(true);
    };

    initEditor();

    return () => {
      cancelled = true;
      if (jqueryRef.current) {
        jqueryRef.current.summernote('destroy');
        jqueryRef.current = null;
      }
    };
  }, [placeholder]);

  useEffect(() => {
    if (!ready || !jqueryRef.current) return;

    const currentValue = jqueryRef.current.summernote('code') || '';
    if (currentValue === normalizedValue) return;

    isSyncingRef.current = true;
    jqueryRef.current.summernote('code', normalizedValue);
    isSyncingRef.current = false;
  }, [normalizedValue, ready]);

  return (
    <div>
      <label className="form-label">{label} *</label>
      <div className="summernote-post-editor">
        <textarea ref={editorRef} />
      </div>
    </div>
  );
}
