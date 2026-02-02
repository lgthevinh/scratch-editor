import React, {useState, useRef, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import ReactTooltip from 'react-tooltip';
import styles from './action-menu.css';
import useActionMenuNavigation from '../../hooks/use-action-menu-navigation';

const CLOSE_DELAY = 300; // ms

const ActionMenu = ({
    className,
    img: mainImg,
    title: mainTitle,
    moreButtons,
    tooltipPlace,
    onClick
}) => {
    const [forceHide, setForceHide] = useState(false);

    const closeTimeoutRef = useRef(null);
    const mainTooltipId = useRef(`tooltip-${Math.random()}`).current;

    const {
        containerRef,
        buttonRef,
        isExpanded,
        setIsExpanded,
        handleOnFocus,
        handleKeyDown
    } = useActionMenuNavigation();

    const handleClosePopover = useCallback(() => {
        closeTimeoutRef.current = setTimeout(() => {
            console.log("collapse popover");
            setIsExpanded(false);
            closeTimeoutRef.current = null;
        }, CLOSE_DELAY);
    }, []);

    const handleToggleOpenState = useCallback(() => {
        // Mouse enter back in after timeout was started prevents it from closing.
        
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        } else if (!isExpanded) {
            setIsExpanded(true);
            setForceHide(false);
        }
    }, [isExpanded]);

    const clickDelayer = useCallback(
        // Return a wrapped action that manages the menu closing.
        // @todo we may be able to use react-transition for this in the future
        // for now all this work is to ensure the menu closes BEFORE the
        // (possibly slow) action is started.
        fn => (event => {
            ReactTooltip.hide();
            if (fn) fn(event);
            // Blur the button so it does not keep focus after being clicked
            // This prevents keyboard events from triggering the button
            buttonRef.current?.blur();
            setForceHide(true);
            console.log("collapse click delayer");
            setIsExpanded(false);
            setTimeout(() => setForceHide(false), 0);
        }),
        []
    );

    const handleTouchStart = useCallback(e => {
    // Prevent this touch from becoming a click if menu is closed
        if (!isExpanded) {
            e.preventDefault();
            handleToggleOpenState();
        }
    }, [isExpanded, handleToggleOpenState]);

    // Handle clicks/touches outside to close menu
    useEffect(() => {
        const handleTouchOutside = e => {
            console.log("is touch out");
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                console.log("collapse handle touch outside");
                setIsExpanded(false);
                ReactTooltip.hide();
            }
        };

        const handleFocusIn = e => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                console.log("collapse handle focus in");
                setIsExpanded(false);
            }
        };

        document.addEventListener('touchstart', handleTouchOutside);
        document.addEventListener('focusin', handleFocusIn);

        return () => {
            document.removeEventListener('touchstart', handleTouchOutside);
            document.removeEventListener('focusin', handleFocusIn);
        };
    }, [containerRef, setIsExpanded]);

    useEffect(() => {
        const buttonEl = buttonRef.current;

        if (!buttonEl) return;

        buttonEl.addEventListener('touchstart', handleTouchStart);

        return () => {
            buttonEl.removeEventListener('touchstart', handleTouchStart);
        };
    }, [handleTouchStart]);

    return (
        <div
            className={classNames(styles.menuContainer, className, {
                [styles.expanded]: isExpanded,
                [styles.forceHidden]: forceHide
            })}
            onMouseEnter={handleToggleOpenState}
            onMouseLeave={handleClosePopover}
            ref={containerRef}
        >
            <button
                aria-label={mainTitle}
                className={classNames(styles.button, styles.mainButton)}
                data-for={mainTooltipId}
                data-tip={mainTitle}
                onFocus={handleOnFocus}
                onClick={clickDelayer(onClick)}
                ref={buttonRef}
            >
                <img
                    className={styles.mainIcon}
                    draggable={false}
                    src={mainImg}
                />
            </button>
            <ReactTooltip
                className={styles.tooltip}
                effect="solid"
                id={mainTooltipId}
                place={tooltipPlace || 'left'}
                arrowColor="var(--tooltip-arrow-color)"
            />
            <div className={styles.moreButtonsOuter}>
                <ul className={styles.moreButtons}>
                    {(moreButtons || []).map(
                        (
                            {
                                img,
                                title,
                                onClick: handleClick,
                                fileAccept,
                                fileChange,
                                fileInput,
                                fileMultiple
                            },
                            keyId
                        ) => {
                            const isComingSoon = !handleClick;
                            const hasFileInput = fileInput;
                            const tooltipId = `${mainTooltipId}-${title}`;
                            return (
                                <li
                                    key={`${tooltipId}-${keyId}`}
                                    tabIndex={-1}
                                >
                                    <button
                                        aria-label={title}
                                        className={classNames(styles.button, styles.moreButton, {
                                            [styles.comingSoon]: isComingSoon
                                        })}
                                        data-for={tooltipId}
                                        data-tip={title}
                                        onClick={hasFileInput ? handleClick : clickDelayer(handleClick)}
                                        tabIndex={-1}
                                        onKeyDown={handleKeyDown}
                                        data-action-menu-item
                                    >
                                        <img
                                            className={styles.moreIcon}
                                            draggable={false}
                                            src={img}
                                        />
                                        {hasFileInput ? (
                                            <input
                                                accept={fileAccept}
                                                className={styles.fileInput}
                                                multiple={fileMultiple}
                                                ref={fileInput}
                                                type="file"
                                                onChange={fileChange}
                                            />) : null}
                                    </button>
                                    <ReactTooltip
                                        className={classNames(styles.tooltip, {
                                            [styles.comingSoonTooltip]: isComingSoon
                                        })}
                                        effect="solid"
                                        id={tooltipId}
                                        place={tooltipPlace || 'left'}
                                        arrowColor="var(--tooltip-arrow-color)"
                                    />
                                </li>
                            );
                        }
                    )}
                </ul>
            </div>
        </div>
    );
};

ActionMenu.propTypes = {
    className: PropTypes.string,
    img: PropTypes.string,
    moreButtons: PropTypes.arrayOf(
        PropTypes.shape({
            img: PropTypes.string,
            title: PropTypes.node.isRequired,
            onClick: PropTypes.func, // Optional, "coming soon" if no callback provided
            fileAccept: PropTypes.string, // Optional, only for file upload
            fileChange: PropTypes.func, // Optional, only for file upload
            fileInput: PropTypes.func, // Optional, only for file upload
            fileMultiple: PropTypes.bool // Optional, only for file upload
        })
    ),
    onClick: PropTypes.func.isRequired,
    title: PropTypes.node.isRequired,
    tooltipPlace: PropTypes.string
};

export default ActionMenu;
