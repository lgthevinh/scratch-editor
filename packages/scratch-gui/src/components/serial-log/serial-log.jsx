import React, {useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import styles from './serial-log.css';

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 500;
const DEFAULT_HEIGHT = 192;

const SerialLog = ({logs, onSend}) => {
    const [collapsed, setCollapsed] = useState(false);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const [inputValue, setInputValue] = useState('');

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
        if (inputValue.trim() && onSend) {
            onSend(inputValue);
            setInputValue('');
        }
    }, [inputValue, onSend]);

    const handleKeyDown = useCallback(e => {
        if (e.key === 'Enter') handleSend();
    }, [handleSend]);

    return (
        <div
            className={styles.serialLog}
            style={collapsed ? undefined : {height: `${height}px`}}
        >
            <div
                className={styles.resizeHandle}
                onMouseDown={collapsed ? undefined : handleResizeMouseDown}
            />
            <div className={styles.inner}>
                <div className={styles.header}>
                    <span>{'Monitor'}</span>
                    <button
                        className={styles.chevron}
                        onClick={() => setCollapsed(c => !c)}
                        aria-label={collapsed ? 'Expand monitor' : 'Collapse monitor'}
                    >
                        {collapsed ? '▸' : '▾'}
                    </button>
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
                        <div className={styles.inputRow}>
                            <input
                                className={styles.input}
                                type="text"
                                value={inputValue}
                                placeholder="Send message..."
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                className={styles.sendButton}
                                onClick={handleSend}
                            >
                                {'Send'}
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
    onSend: PropTypes.func
};

export default SerialLog;
