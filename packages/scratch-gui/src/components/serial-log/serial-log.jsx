import React, {useState, useCallback, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import styles from './serial-log.css';

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 500;
const DEFAULT_HEIGHT = 280;

const messages = defineMessages({
    clearMonitor: {
        id: 'gui.serialLog.clearMonitor',
        defaultMessage: 'Clear monitor',
        description: 'Accessible label for the button that clears all messages from the serial monitor'
    },
    monitor: {
        id: 'gui.serialLog.monitor',
        defaultMessage: 'Monitor',
        description: 'Title for the serial monitor panel'
    },
    send: {
        id: 'gui.serialLog.send',
        defaultMessage: 'Send',
        description: 'Button label for sending a message from the serial monitor'
    },
    sendPlaceholder: {
        id: 'gui.serialLog.sendPlaceholder',
        defaultMessage: 'Send message...',
        description: 'Placeholder text for the serial monitor message input'
    },
    promptedInputPlaceholder: {
        id: 'gui.serialLog.promptedInputPlaceholder',
        defaultMessage: 'Type your answer...',
        description: 'Placeholder text for the monitor input when the program is waiting for a response'
    }
});

const SerialLog = ({logs = [], fill = false, onClear, onSend, prompt}) => {
    const intl = useIntl();
    const hasPrompt = prompt !== null && typeof prompt !== 'undefined';
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef(null);

    // Clear and focus the input when a prompt arrives.
    useEffect(() => {
        if (hasPrompt) {
            setInputValue('');
            if (inputRef.current) inputRef.current.focus();
        }
    }, [hasPrompt, prompt]);

    const handleResizeMouseDown = useCallback(e => {
        const startY = e.clientY;
        const startHeight = height;
        const onMouseMove = moveEvent => {
            const delta = startY - moveEvent.clientY;
            setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + delta)));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    }, [height]);

    const handleSend = useCallback(() => {
        // Empty input is valid when responding to a prompt
        const hasContent = hasPrompt || inputValue.trim().length > 0;
        if (hasContent && onSend) {
            onSend(inputValue);
            setInputValue('');
        }
    }, [hasPrompt, inputValue, onSend]);

    const handleInputChange = useCallback(e => {
        setInputValue(e.target.value);
    }, []);

    const handleKeyDown = useCallback(e => {
        if (e.key === 'Enter') handleSend();
    }, [handleSend]);

    return (
        <div
            className={classNames(styles.serialLog, {[styles.fill]: fill})}
            style={fill ? null : {height: `${height}px`}}
        >
            <div
                className={styles.resizeHandle}
                onMouseDown={fill ? null : handleResizeMouseDown}
            />
            <div className={styles.inner}>
                <div className={styles.header}>
                    <span><FormattedMessage {...messages.monitor} /></span>
                    <div className={styles.headerActions}>
                        <button
                            className={styles.clearButton}
                            disabled={!onClear || logs.length === 0}
                            onClick={onClear}
                            aria-label={intl.formatMessage(messages.clearMonitor)}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                                <path d="M9 6V4h6v2" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className={styles.content}>
                    {logs && logs.map((entry, i) => (
                        <div
                            key={i}
                            className={styles.entry}
                        >
                            {entry.message}
                        </div>
                    ))}
                </div>
                {hasPrompt && (
                    <div className={styles.promptBanner}>{prompt}</div>
                )}
                <div className={styles.inputRow}>
                    <input
                        ref={inputRef}
                        className={styles.input}
                        type="text"
                        value={inputValue}
                        placeholder={intl.formatMessage(
                            hasPrompt ? messages.promptedInputPlaceholder : messages.sendPlaceholder
                        )}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        className={styles.sendButton}
                        onClick={handleSend}
                    >
                        <FormattedMessage {...messages.send} />
                    </button>
                </div>
            </div>
        </div>
    );
};

SerialLog.propTypes = {
    logs: PropTypes.arrayOf(PropTypes.shape({
        message: PropTypes.string
    })),
    fill: PropTypes.bool,
    onClear: PropTypes.func,
    onSend: PropTypes.func,
    prompt: PropTypes.string
};

export default SerialLog;
