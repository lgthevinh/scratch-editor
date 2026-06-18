import React, {useState, useCallback, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import styles from './serial-log.css';

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 500;
const DEFAULT_HEIGHT = 192;

const messages = defineMessages({
    clearMonitor: {
        id: 'gui.serialLog.clearMonitor',
        defaultMessage: 'Clear monitor',
        description: 'Accessible label for the button that clears all messages from the serial monitor'
    },
    clear: {
        id: 'gui.serialLog.clear',
        defaultMessage: 'Clear',
        description: 'Button label for clearing all messages from the serial monitor'
    },
    collapseMonitor: {
        id: 'gui.serialLog.collapseMonitor',
        defaultMessage: 'Collapse monitor',
        description: 'Accessible label for the button that collapses the serial monitor'
    },
    expandMonitor: {
        id: 'gui.serialLog.expandMonitor',
        defaultMessage: 'Expand monitor',
        description: 'Accessible label for the button that expands the serial monitor'
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

const SerialLog = ({logs = [], onClear, onSend, prompt}) => {
    const intl = useIntl();
    const [collapsed, setCollapsed] = useState(false);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef(null);

    // Auto-expand and focus input when a prompt arrives
    useEffect(() => {
        if (prompt != null) {
            setCollapsed(false);
            setInputValue('');
            if (inputRef.current) inputRef.current.focus();
        }
    }, [prompt]);

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
        const hasContent = prompt != null ? true : inputValue.trim().length > 0;
        if (hasContent && onSend) {
            onSend(inputValue);
            setInputValue('');
        }
    }, [inputValue, onSend, prompt]);

    const handleInputChange = useCallback(e => {
        setInputValue(e.target.value);
    }, []);

    const handleKeyDown = useCallback(e => {
        if (e.key === 'Enter') handleSend();
    }, [handleSend]);

    const handleToggleCollapsed = useCallback(() => {
        setCollapsed(currentCollapsed => !currentCollapsed);
    }, []);

    return (
        <div
            className={styles.serialLog}
            style={collapsed ? null : {height: `${height}px`}}
        >
            <div
                className={styles.resizeHandle}
                onMouseDown={collapsed ? null : handleResizeMouseDown}
            />
            <div className={styles.inner}>
                <div className={styles.header}>
                    <span><FormattedMessage {...messages.monitor} /></span>
                    <div className={styles.headerActions}>
                        {!collapsed && (
                            <button
                                className={styles.clearButton}
                                disabled={!onClear || logs.length === 0}
                                onClick={onClear}
                                aria-label={intl.formatMessage(messages.clearMonitor)}
                            >
                                <FormattedMessage {...messages.clear} />
                            </button>
                        )}
                        <button
                            className={styles.chevron}
                            onClick={handleToggleCollapsed}
                            aria-label={intl.formatMessage(collapsed ?
                                messages.expandMonitor :
                                messages.collapseMonitor)}
                        >
                            {collapsed ? '▸' : '▾'}
                        </button>
                    </div>
                </div>
                {!collapsed && (
                    <>
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
                        {prompt != null && (
                            <div className={styles.promptBanner}>{prompt}</div>
                        )}
                        <div className={styles.inputRow}>
                            <input
                                ref={inputRef}
                                className={styles.input}
                                type="text"
                                value={inputValue}
                                placeholder={intl.formatMessage(
                                    prompt != null ? messages.promptedInputPlaceholder : messages.sendPlaceholder
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
                    </>
                )}
            </div>
        </div>
    );
};

SerialLog.propTypes = {
    logs: PropTypes.arrayOf(PropTypes.shape({
        message: PropTypes.string
    })),
    onClear: PropTypes.func,
    onSend: PropTypes.func,
    prompt: PropTypes.string
};

export default SerialLog;
