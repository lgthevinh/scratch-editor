import React, {useRef, useCallback, useEffect} from 'react';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import ReactModal from 'react-modal';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import Box from '../box/box.jsx';

import arrowLeftIcon from './icon--arrow-left.svg';
import arrowRightIcon from './icon--arrow-right.svg';
import arrowDownIcon from './icon--arrow-down.svg';
import arrowUpIcon from './icon--arrow-up.svg';

import styles from './confirmation-prompt.css';
import useCalculatePopupPosition from '../../hooks/calculatePopupPosition.js';

const messages = defineMessages({
    defaultConfirmLabel: {
        defaultMessage: 'yes',
        description: 'Label for confirm button in confirmation prompt',
        id: 'gui.confirmationPrompt.confirm'
    },
    defaultCancelLabel: {
        defaultMessage: 'no',
        description: 'Label for cancel button in confirmation prompt',
        id: 'gui.confirmationPrompt.cancel'
    }
});

const modalWidth = 200;
const spaceForArrow = 16;
const arrowOffsetFromEnd = 7;
const arrowLongSide = 29;
const arrowShortSide = 13;

const ConfirmationPrompt = ({
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    isOpen,
    relativeElementRef,
    primaryPosition,
    secondaryPosition
}) => {
    const intl = useIntl();

    const modalRef = useRef(null);
    const [modalPositionValues, setModalPositionValues] = React.useState({});

    const updatePosition = useCallback(() => {
        if (relativeElementRef.current && modalRef.current) {
            const pos = useCalculatePopupPosition({
                relativeElementRef,
                popupRef: modalRef,
                primaryPosition,
                secondaryPosition,
                popupWidth: modalWidth,
                arrowLeftIcon,
                arrowRightIcon,
                arrowUpIcon,
                arrowDownIcon,
                spaceForArrow,
                arrowOffsetFromEnd,
                arrowShortSide,
                arrowLongSide
            });
            setModalPositionValues(pos);
        }
    }, [relativeElementRef, primaryPosition, secondaryPosition]);

    useEffect(() => {
        if (!isOpen) return;

        const debouncedUpdate = debounce(updatePosition, 50, {leading: true});

        debouncedUpdate();

        window.addEventListener('resize', debouncedUpdate);
        return () => window.removeEventListener('resize', debouncedUpdate);
    }, [isOpen, relativeElementRef, primaryPosition, secondaryPosition]);

    const onModalMount = useCallback(el => {
        if (!el || !isOpen) return;
        modalRef.current = el;

        updatePosition();
    }, [isOpen, relativeElementRef, primaryPosition, secondaryPosition]);

    return (
        isOpen && (
            <ReactModal
                isOpen
                onRequestClose={onCancel}
                contentLabel={intl.formatMessage(title)}
                style={{
                    content: {
                        top: modalPositionValues.top,
                        left: modalPositionValues.left,
                        width: modalWidth,
                        border: 'none',
                        height: 'fit-content',
                        backgroundColor: 'transparent',
                        padding: 0,
                        margin: 0,
                        position: 'absolute',
                        overflowX: 'hidden',
                        zIndex: 1000
                    },
                    overlay: {
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 510,
                        backgroundColor: 'transparent'
                    }
                }}
            >
                {modalPositionValues.arrowIcon && (
                    <img
                        src={modalPositionValues.arrowIcon}
                        style={{
                            position: 'fixed',
                            top: modalPositionValues.arrowTop,
                            left: modalPositionValues.arrowLeft,
                            width: (primaryPosition === 'left' || primaryPosition === 'right') ?
                                arrowShortSide : arrowLongSide,
                            height: (primaryPosition === 'left' || primaryPosition === 'right') ?
                                arrowLongSide : arrowShortSide,
                            zIndex: 1001
                        }}
                    />
                )}
                <Box
                    className={styles.modalContainer}
                    componentRef={onModalMount}
                >
                    <Box className={styles.label}>
                        {message}
                    </Box>

                    <Box className={styles.buttonRow}>
                        <button
                            onClick={onCancel}
                            className={styles.cancelButton}
                        >
                            {cancelLabel ?? <FormattedMessage {...messages.defaultCancelLabel} />}
                        </button>

                        <button
                            onClick={onConfirm}
                            className={styles.confirmButton}
                        >
                            {confirmLabel ?? <FormattedMessage {...messages.defaultConfirmLabel} />}
                        </button>
                    </Box>
                </Box>
            </ReactModal>
        )
    );
};

ConfirmationPrompt.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
    message: PropTypes.node.isRequired,
    confirmLabel: PropTypes.node,
    cancelLabel: PropTypes.node,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    relativeElementRef: PropTypes.shape({current: PropTypes.instanceOf(Element)}),
    primaryPosition: PropTypes.oneOf([
        'left',
        'right',
        'up',
        'down'
    ]).isRequired,
    secondaryPosition: PropTypes.oneOf([
        'left',
        'right',
        'up',
        'down'
    ])
};

export default ConfirmationPrompt;
