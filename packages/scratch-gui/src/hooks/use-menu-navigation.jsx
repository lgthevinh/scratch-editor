import {useCallback, useContext, useState, useRef} from 'react';
import {MenuRefContext} from '../contexts/menu-ref-context';
import {KEY} from '../lib/navigation-keys';

const MENU_ITEM_SELECTOR = '[data-menu-item="true"]';
const MENU_ITEM_WRAPPER_SELECTOR = '[data-menu-item-wrapper="true"]';

/**
 * Custom hook for keyboard navigation and focus management in menu components.
 *
 * This hook provides:
 * - Opening and closing menus
 * - Handling Escape, Enter, Arrow and Tab keys
 * - Coordinating nested open menus via MenuRefContext
 * - Automatically focusing the first or default menu item when opening
 * - BFS to find first-level menu items, including wrapped items
 *
 * Notes:
 * - Menu items can be direct children or wrapped in a container marked with
 *   `data-menu-item-wrapper="true"`. The BFS will traverse until it finds menu items
 *   or wrapped menu items, but will not go deeper than needed.
 * - The hook automatically skips the starting element itself when looking for siblings.
 *
 * STEPS TO USE IT:
 * 1. In the top-level menu trigger (button/div/...) pass:
 *    - onClick={handleOnOpen}
 *    - ref={menuRef}
 *    - onKeyDown={handleKeyPress}
 *    - tabIndex={0} if it's the core menu accessible via Tab
 *    - aria-expanded={isExpanded()}
 * 2. Mark each submenu item or leaf menu item with:
 *    - data-menu-item="true"
 * 3. If an expandable submenu is wrapped, mark the wrapper with:
 *    - data-menu-item-wrapper="true"
 *    - see SettingsMenu -> LanguageMenu | PreferenceMenu logic for reference
 * @param {object} params
 *   Parameters object
 * @param {number} params.depth
 *   Nesting depth of the menu (1 = top-level menu).
 * @param {number} [params.defaultIndexOnOpen]
 *   Default menu item index to focus when opening the menu.
 * @returns {object} An object containing the menu state and keyboard handlers:
 *   - menuRef: reference to element to be used in component
 *   - focusedIndex: number — Index of the currently focused menu item.
 *   - isExpanded: function() — Returns true if the menu is expanded.
 *   - handleKeyPress: function(KeyboardEvent) — Handles key presses on the menu.
 *   - handleKeyPressOpenMenu: function(KeyboardEvent) — Handles key presses when the menu is open.
 *   - handleOnOpen: function() — Function to open the menu.
 *   - handleOnClose: function() — Function to close the menu.
 */
export default function useMenuNavigation ({
    depth,
    defaultIndexOnOpen = 0
}) {
    const menuRef = useRef(null);
    const menuContext = useContext(MenuRefContext);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // BFS to find first children with attribute
    const findDirectSubitems = () => {
        if (!menuRef?.current) return [];
        const directSubitems = [];
        // Start from the wrapper if element is inside one
        const root = menuRef.current?.parentElement?.matches(MENU_ITEM_WRAPPER_SELECTOR) ?
            menuRef.current.parentElement : menuRef.current;
        const children = [...root.children];

        while (children.length > 0) {
            // if child is a menu item itself
            const element = children.shift();
            if (element.matches(MENU_ITEM_SELECTOR)) {
                // Skip original starting element if we went back to the wrapper
                if (element !== menuRef.current) {
                    directSubitems.push(element);
                }
                continue;
            }
            
            if (element.matches(MENU_ITEM_WRAPPER_SELECTOR)) {
                const wrappedItems = Array.from(element.children).filter(child =>
                    child.matches(MENU_ITEM_SELECTOR)
                );
                directSubitems.push(...wrappedItems);
            } else {
                children.push(...element.children);
            }
        }

        return directSubitems;
    };

    const isExpanded = useCallback(
        () => menuContext.isOpenMenu(menuRef),
        [menuContext, menuRef]
    );

    const refocusIndex = useCallback(index => {
        const items = findDirectSubitems(menuRef);
        if (items?.[index]) {
            items[index].focus();
            setFocusedIndex(index);
        }
    }, [menuRef]);

    const handleOnOpen = useCallback(() => {
        if (menuContext.isOpenMenu(menuRef)) return;

        menuContext.openInnerMenu(menuRef, depth);

        // Wait for the UI to be rendered before interacting with the DOM
        requestAnimationFrame(() => {
            refocusIndex(defaultIndexOnOpen);
        });
    }, [menuContext, menuRef, depth, defaultIndexOnOpen]);

    const handleOnClose = useCallback(() => {
        setFocusedIndex(-1);
        menuContext.closeMenuByRef(menuRef);
        menuRef?.current?.focus();
    }, [menuContext, menuRef]);

    const handleMove = useCallback(direction => {
        const items = findDirectSubitems(menuRef);
        if (!items?.length) return;

        const nextIndex = (focusedIndex + direction + items.length) % items.length;
        refocusIndex(nextIndex);
    }, [focusedIndex, menuRef, refocusIndex]);

    const handleKeyPressOpenMenu = useCallback(e => {
        const items = findDirectSubitems(menuRef);

        // Logic for vertical menus, will need to change when implementing for vertical
        switch (e.key) {
        case KEY.ARROW_DOWN:
            e.preventDefault();
            handleMove(1);
            break;
        case KEY.ARROW_UP:
            e.preventDefault();
            handleMove(-1);
            break;
        case KEY.ESCAPE:
        case KEY.ARROW_LEFT:
            e.preventDefault();
            handleOnClose();
            break;
        case KEY.ENTER:
            e.preventDefault();
            e.stopPropagation();
            items[focusedIndex]?.click();
            break;
        }

    }, [handleMove, handleOnClose, focusedIndex]);

    const handleKeyPress = useCallback(e => {
        if (isExpanded() && depth === 1 && e.key === KEY.TAB) {
            handleOnClose();
            menuContext.closeAllMenus();
            return;
        }

        if (menuContext.isInnermostMenu(menuRef)) {
            handleKeyPressOpenMenu(e);
        } else if (!isExpanded() && (e.key === KEY.SPACE ||
            (e.key === KEY.ARROW_RIGHT && depth !== 1))) {
            e.preventDefault();
            handleOnOpen();
        }
    }, [
        depth,
        menuContext,
        menuRef,
        isExpanded,
        handleKeyPressOpenMenu,
        handleOnOpen,
        handleOnClose
    ]);

    return {
        menuRef,
        focusedIndex,
        isExpanded,
        handleKeyPress,
        handleKeyPressOpenMenu,
        handleOnOpen,
        handleOnClose
    };
}
