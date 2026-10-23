'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function getFocusableFromErrorNode(errorNode) {
  if (!errorNode) return null;
  const group = errorNode.closest('.form-group, .mb-2, .mb-3, .mb-4, .form-check, .card-body, .modal-body') || errorNode.parentElement;
  if (!group) return null;
  return group.querySelector('input, select, textarea, [contenteditable="true"], .form-check-input');
}

function findFirstErrorElement() {
  const invalidField = document.querySelector('.is-invalid');
  if (invalidField) return invalidField;

  const dangerTextNodes = Array.from(document.querySelectorAll('.text-danger'));
  for (const node of dangerTextNodes) {
    const focusable = getFocusableFromErrorNode(node);
    if (focusable) return focusable;
  }

  const alertDanger = document.querySelector('.alert.alert-danger');
  if (alertDanger) {
    const container = alertDanger.closest('form, .card-body, .modal-body') || document;
    return container.querySelector('input, select, textarea, [contenteditable="true"], .form-check-input');
  }

  return null;
}

function scrollAndFocus(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  if (typeof element.focus === 'function') {
    element.focus({ preventScroll: true });
  }
}

export default function GlobalFirstErrorScroll() {
  const pathname = usePathname();
  const rafRef = useRef(null);
  const lastRef = useRef({ path: '', key: '', at: 0 });

  useEffect(() => {
    const scheduleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const target = findFirstErrorElement();
        if (!target) return;

        const key = `${target.id || ''}|${target.getAttribute('name') || ''}|${target.className || ''}`;
        const now = Date.now();
        if (lastRef.current.path === pathname && lastRef.current.key === key && now - lastRef.current.at < 800) {
          return;
        }

        lastRef.current = { path: pathname || '', key, at: now };
        scrollAndFocus(target);
      });
    };

    const observer = new MutationObserver(() => {
      scheduleScroll();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    const onNativeInvalid = (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLElement)) return;
      lastRef.current = {
        path: pathname || '',
        key: `${target.id || ''}|${target.getAttribute('name') || ''}|invalid`,
        at: Date.now(),
      };
      scrollAndFocus(target);
    };

    document.addEventListener('invalid', onNativeInvalid, true);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      document.removeEventListener('invalid', onNativeInvalid, true);
    };
  }, [pathname]);

  return null;
}

