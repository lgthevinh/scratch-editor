import {useCallback} from 'react';
import {KEY} from '../lib/navigation-keys';

/**
 * Hook to trap focus within a container element.
 * @param {{current: HTMLElement}} containerRef - Parent container ref
 * @param {string} dataAttribute - Data attribute used to mark focusable elements (default: 'data-focusable')
 * @returns {{trapFocus: () => void, releaseFocus: () => void}} - Functions to activate and deactivate the focus trap
 */
const useFocusTrap = (containerRef, dataAttribute = 'data-focusable') => {
    const getFocusableElements = useCallback(() => {
        const container = containerRef.current;
        if (!container) return [];

        return Array.from(
            container.querySelectorAll(`[${dataAttribute}]`)
        ).filter(el => !el.hasAttribute('disabled'));
    }, [containerRef, dataAttribute]);

    const handleKeyDown = useCallback(event => {
        if (event.key !== KEY.TAB) return;

        const focusable = getFocusableElements();
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (!containerRef.current.contains(active)) {
            event.preventDefault();
            first.focus();
            return;
        }

        if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        }
    }, [getFocusableElements, containerRef]);

    const trapFocus = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        document.addEventListener('keydown', handleKeyDown);

        const focusable = getFocusableElements();
        if (focusable.length) {
            focusable[0].focus();
        }
    }, [handleKeyDown, getFocusableElements]);

    const releaseFocus = useCallback(() => {
        document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        trapFocus,
        releaseFocus
    };
};

export default useFocusTrap;
