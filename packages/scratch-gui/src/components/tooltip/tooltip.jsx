import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import styles from './tooltip.css';
import {PopupAlign, PopupSide} from '../../lib/calculatePopupPosition';

import arrowDownIcon from './icon--arrow-down.svg';
import arrowUpIcon from './icon--arrow-up.svg';
import arrowLeftIcon from './icon--arrow-left.svg';
import arrowRightIcon from './icon--arrow-right.svg';

import Box from '../box/box';
import PopupWithArrow from '../popup-with-arrow/popup-with-arrow.jsx';

const defaultConfig = {
    width: 336,
    spaceForArrow: 12,
    arrowOffsetFromBottom: 2,
    counterOffset: 2,
    arrowWidth: 28,
    arrowHeight: 8
};

const arrowConfig = {
    arrowDownIcon,
    arrowUpIcon,
    arrowLeftIcon,
    arrowRightIcon
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
    layoutConfig
}) => {
    const {
        width,
        spaceForArrow,
        counterOffset,
        arrowOffsetFromBottom,
        arrowHeight,
        arrowWidth
    } = {...defaultConfig, ...layoutConfig};

    // Simulate hover and focus (normal) tooltip behavior
    useEffect(() => {
        if (isManualOnly) return;

        const target = targetRef?.current;
        if (!target) return;

        const handleMouseEnter = () => onRequestOpen?.();
        const handleMouseLeave = () => onRequestClose?.();
        const handleFocus = () => onRequestOpen?.();
        const handleBlur = () => onRequestClose?.();

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
    }, [isManualOnly, onRequestOpen, onRequestClose, targetRef?.current]);

    return (
        <PopupWithArrow
            isOpen={isOpen}
            onRequestClose={onRequestClose}
            relativeElementRef={targetRef}
            side={side}
            align={align}
            layoutConfig={{
                popupWidth: width,
                spaceForArrow,
                counterOffset,
                arrowOffsetFromBottom,
                arrowHeight,
                arrowWidth
            }}
            arrowConfig={arrowConfig}
        >
            {({popupRef, pos}) => (
                <Box
                    componentRef={popupRef}
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
            )}
        </PopupWithArrow>
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
    layoutConfig: PropTypes.shape({
        width: PropTypes.number,
        spaceForArrow: PropTypes.number,
        arrowOffsetFromBottom: PropTypes.number,
        counterOffset: PropTypes.number,
        arrowHeight: PropTypes.number,
        arrowWidth: PropTypes.number
    })
};

export default Tooltip;
