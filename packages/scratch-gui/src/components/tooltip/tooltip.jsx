import React, {useRef, useEffect, useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import styles from './tooltip.css';
import useCalculatePopupPosition, {PopupAlign, PopupSide} from '../../hooks/calculatePopupPosition';

import arrowLeftIcon from './icon--arrow-left.svg';
import arrowRightIcon from './icon--arrow-right.svg';
import arrowDownIcon from './icon--arrow-down.svg';
import arrowUpIcon from './icon--arrow-up.svg';
import Box from '../box/box';

const defaultConfig = {
    width: 336,
    spaceForArrow: 12,
    arrowOffsetFromBottom: 2,
    counterOffset: 2,
    arrowLongSide: 28,
    arrowShortSide: 8
};

const SIDE_TO_ARROW_ICON = {
    [PopupSide.UP]: arrowDownIcon,
    [PopupSide.DOWN]: arrowUpIcon,
    [PopupSide.LEFT]: arrowRightIcon,
    [PopupSide.RIGHT]: arrowLeftIcon
};

const Tooltip = ({
    isOpen,
    onRequestClose,
    onRequestOpen,
    isManualOnly = true,
    targetRef,
    side,
    align,
    title,
    body,
    config
}) => {
    const tooltipRef = useRef(null);
    const [pos, setPos] = useState({top: 0, left: 0, arrowTop: 0, arrowLeft: 0});

    const arrowIcon = SIDE_TO_ARROW_ICON[side];
    const {
        width,
        spaceForArrow,
        counterOffset,
        arrowOffsetFromBottom,
        arrowLongSide,
        arrowShortSide
    } = {...defaultConfig, ...config};
    const [arrowHeight, arrowWidth] = (side === PopupSide.LEFT || side === PopupSide.RIGHT) ?
        [arrowLongSide, arrowShortSide] : [arrowShortSide, arrowLongSide];

    const updatePosition = useCallback(() => {
        if (!targetRef?.current || !tooltipRef.current) return;
        const newPos = useCalculatePopupPosition({
            relativeElementRef: targetRef,
            popupRef: tooltipRef,
            side,
            align,
            popupWidth: width,
            arrowLeftIcon,
            arrowRightIcon,
            arrowUpIcon,
            arrowDownIcon,
            spaceForArrow,
            counterOffset,
            arrowOffsetFromBottom,
            arrowShortSide,
            arrowLongSide
        });
        setPos(newPos);
    }, [
        targetRef,
        side,
        align,
        width,
        spaceForArrow,
        counterOffset,
        arrowOffsetFromBottom,
        arrowLongSide,
        arrowShortSide
    ]);

    // Resize/scroll listeners
    useEffect(() => {
        if (!isOpen) return;

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, updatePosition]);

    // Click outside to close
    useEffect(() => {
        if (!isOpen || !onRequestClose) return;

        const handleClickOutside = event => {
            const isOutsideTooltip = tooltipRef.current &&
                !tooltipRef.current.contains(event.target);
            
            if (isOutsideTooltip) {
                onRequestClose();
            }
        };

        // The Blockly workspace suppresses compat events like `mouseup`.
        // Listen for `pointerup` instead.
        document.addEventListener('pointerup', handleClickOutside);
        return () => {
            document.removeEventListener('pointerup', handleClickOutside);
        };
    }, [isOpen, onRequestClose, targetRef]);

    // Simulate hover and focus (normal) tooltip behavior
    useEffect(() => {
        if (isManualOnly) return;
        
        const target = targetRef?.current;
        if (!target) return;

        const handleMouseEnter = () => {
            if (onRequestOpen) onRequestOpen();
        };

        const handleMouseLeave = () => {
            if (onRequestClose) onRequestClose();
        };

        const handleFocus = () => {
            if (onRequestOpen) onRequestOpen();
        };

        const handleBlur = () => {
            if (onRequestClose) onRequestClose();
        };

        target.addEventListener('mouseenter', handleMouseEnter);
        target.addEventListener('mouseleave', handleMouseLeave);
        target.addEventListener('focus', handleFocus);
        target.addEventListener('blur', handleBlur);

        return () => {
            target.removeEventListener('mouseenter', handleMouseEnter);
            target.removeEventListener('mouseleave', handleMouseLeave);
            target.removeEventListener('focus', handleFocus);
            target.removeEventListener('blur', handleBlur);
        };
    }, [isManualOnly, onRequestOpen, onRequestClose, targetRef, targetRef?.current]);

    // Update position when isOpen changes
    useEffect(() => {
        if (isOpen && tooltipRef.current && targetRef?.current) {
            updatePosition();
        }
    }, [isOpen, targetRef, updatePosition]);

    const onTooltipMount = useCallback(el => {
        if (!el || !isOpen) return;
        tooltipRef.current = el;

        updatePosition();
    }, [isOpen, updatePosition]);

    if (!isOpen) return null;

    return (
        <>
            <Box
                componentRef={onTooltipMount}
                className={styles.tooltip}
                style={{
                    top: pos.top,
                    left: pos.left,
                    width,
                    zIndex: 1000,
                    position: 'fixed'
                }}
                tabIndex={0}
                role="tooltip"
            >
                <Box className={styles.tooltipTitle}>
                    {title}
                </Box>
                <Box className={styles.tooltipBody}>
                    {body}
                </Box>
            </Box>
            {arrowIcon && (
                <img
                    src={arrowIcon}
                    className={styles.tooltipArrow}
                    style={{
                        top: pos.arrowTop,
                        left: pos.arrowLeft,
                        width: arrowWidth,
                        height: arrowHeight,
                        zIndex: 510,
                        position: 'fixed'
                    }}
                    alt=""
                    aria-hidden="true"
                />
            )}
        </>
    );
};

Tooltip.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onRequestClose: PropTypes.func,
    onRequestOpen: PropTypes.func,
    isManualOnly: PropTypes.bool,
    targetRef: PropTypes.shape({current: PropTypes.instanceOf(Element)}).isRequired,
    side: PropTypes.oneOf(Object.values(PopupSide)).isRequired,
    align: PropTypes.oneOf(Object.values(PopupAlign)),
    title: PropTypes.node,
    body: PropTypes.node.isRequired,
    config: PropTypes.shape({
        width: PropTypes.number,
        spaceForArrow: PropTypes.number,
        arrowOffsetFromBottom: PropTypes.number,
        counterOffset: PropTypes.number,
        arrowShortSide: PropTypes.number,
        arrowLongSide: PropTypes.number
    })
};

export default Tooltip;
