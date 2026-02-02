import {useCallback, useState, useRef} from 'react';
import {KEY} from '../lib/navigation-keys';

const MENU_ITEM_SELECTOR = '[data-action-menu-item="true"]';

export default function useActionMenuNavigation () {
    const containerRef = useRef(null);
    const buttonRef = useRef(null);
    const [isExpanded, setIsExpanded] = useState(false);

    // BFS to find first children with attribute
    const findSubitems = useCallback(() => {
        if (!containerRef?.current) return [];
        const subitems = [];
        const root = containerRef.current;
        const children = [...root.children];

        while (children.length > 0) {
            // if child is a menu item itself
            const element = children.shift();
            if (element.matches(MENU_ITEM_SELECTOR) && element !== buttonRef.current) {
                subitems.push(element);
            } else {
                children.push(...element.children);
            }
        }

        console.log(subitems);
        return subitems;
    }, [containerRef, buttonRef]);

    const focusItem = useCallback(item => {
        if (item) {
            item.focus();
        }
    }, []);

    const handleOnFocus = useCallback(() => {
        console.log("Should expand");
        setIsExpanded(true);
        const items = findSubitems();
        if (!items.length) return;

        focusItem(items[0]);
    }, [findSubitems, focusItem]);

    const handleMove = useCallback(direction => {
        const items = findSubitems();
        if (!items.length) return;

        const currentIndex = items.indexOf(document.activeElement);
        const nextIndex = (currentIndex + direction + items.length) % items.length;
        focusItem(items[nextIndex]);
    }, [findSubitems, focusItem]);

    const handleKeyDown = useCallback(e => {
        switch (e.key) {
        case KEY.ARROW_DOWN:
            e.preventDefault();
            e.stopPropagation();
            handleMove(1);
            break;
        case KEY.ARROW_UP:
            e.preventDefault();
            e.stopPropagation();
            handleMove(-1);
            break;
        case KEY.TAB:
            console.log("Should collapse");
            if (isExpanded) setIsExpanded(false);
            buttonRef?.current?.blur();

            return;
        }
    }, [handleMove, setIsExpanded, buttonRef]);

    return {
        containerRef,
        buttonRef,
        isExpanded,
        setIsExpanded,
        handleKeyDown,
        handleOnFocus
    };
}
