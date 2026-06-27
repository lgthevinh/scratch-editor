import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import classNames from 'classnames';
import {defineMessages, useIntl} from 'react-intl';

import Modal from '../../containers/modal.jsx';

import styles from './upload-modal.css';

const messages = defineMessages({
    title: {
        id: 'gui.uploadModal.title',
        defaultMessage: 'Upload',
        description: 'Title of the modal that shows compile and upload progress'
    },
    compiling: {
        id: 'gui.uploadModal.compiling',
        defaultMessage: 'Compiling your project…',
        description: 'Status shown while the firmware is being compiled'
    },
    uploading: {
        id: 'gui.uploadModal.uploading',
        defaultMessage: 'Writing to your board…',
        description: 'Status shown while the compiled firmware is being flashed to the board'
    },
    done: {
        id: 'gui.uploadModal.done',
        defaultMessage: 'Your board is ready to go.',
        description: 'Status shown when the firmware has been flashed successfully'
    },
    cancelled: {
        id: 'gui.uploadModal.cancelled',
        defaultMessage: 'Upload stopped.',
        description: 'Status shown when the user cancelled the compile or upload'
    },
    error: {
        id: 'gui.uploadModal.error',
        defaultMessage: 'Upload didn’t finish.',
        description: 'Status shown when the compile or upload failed'
    },
    showDetails: {
        id: 'gui.uploadModal.showDetails',
        defaultMessage: 'Details',
        description: 'Toggle that reveals the raw build and upload log'
    },
    cancel: {
        id: 'gui.uploadModal.cancel',
        defaultMessage: 'Stop',
        description: 'Button that aborts the in-progress compile or upload'
    },
    close: {
        id: 'gui.uploadModal.close',
        defaultMessage: 'Close',
        description: 'Button that closes the upload modal once it has finished'
    }
});

const STATUS_MESSAGES = {
    compiling: messages.compiling,
    uploading: messages.uploading,
    done: messages.done,
    cancelled: messages.cancelled,
    error: messages.error
};

// `compiling` and `uploading` are the in-flight states the Stop button applies to.
const isRunning = status => status === 'compiling' || status === 'uploading';

// arduino-cli's upload tools (avrdude/esptool) paint progress with ANSI cursor moves and
// carriage-return overwrites. Strip the escapes and flatten the overwrites so the log reads as
// plain text instead of the raw `[1A [2K` terminal noise.
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g; // eslint-disable-line no-control-regex
const cleanLog = raw => raw
    .replace(ANSI, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

// The flash tools have no structured progress; read the last `NN%` they printed to drive the bar.
const PERCENT = /(\d{1,3}(?:\.\d+)?)\s*%/g;
const lastPercent = text => {
    let match;
    let last = null;
    while ((match = PERCENT.exec(text)) !== null) last = parseFloat(match[1]);
    return last;
};

const CheckIcon = () => (
    <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
    >
        <path
            d="M5 12.5l4.5 4.5L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const UploadModal = ({status, progress, logs = [], error = null, onCancel, onClose}) => {
    const intl = useIntl();
    const logRef = useRef(null);
    const [showDetails, setShowDetails] = useState(true);

    const cleaned = useMemo(() => cleanLog(logs.join('')), [logs]);
    const handleToggleDetails = useCallback(() => setShowDetails(open => !open), []);

    // Calm the panel on success; surface the cause on failure; show activity while running.
    useEffect(() => {
        if (status === 'done' || status === 'cancelled') setShowDetails(false);
        if (status === 'error') setShowDetails(true);
    }, [status]);

    // Keep the newest output in view as chunks stream in.
    useEffect(() => {
        if (showDetails && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [cleaned, showDetails]);

    const running = isRunning(status);

    let percent = null;
    if (status === 'compiling' && progress) percent = progress.percent;
    else if (status === 'uploading') percent = lastPercent(cleaned);
    const clampedPercent = percent === null ? null : Math.max(0, Math.min(100, Math.round(percent)));

    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            id="uploadModal"
            // Closing mid-run stops first so the helper isn't left building for a dismissed modal.
            onRequestClose={running ? onCancel : onClose}
        >
            <div className={styles.body}>
                <div
                    className={styles.statusRow}
                    aria-live="polite"
                >
                    <div
                        className={classNames(styles.statusIcon, {
                            [styles.statusIconRunning]: running,
                            [styles.statusIconDone]: status === 'done',
                            [styles.statusIconError]: status === 'error',
                            [styles.statusIconCancelled]: status === 'cancelled'
                        })}
                    >
                        {running && <span className={styles.spinner} />}
                        {status === 'done' && <CheckIcon />}
                        {status === 'error' && <span className={styles.glyph}>{'!'}</span>}
                        {status === 'cancelled' && <span className={styles.glyph}>{'–'}</span>}
                    </div>
                    <div className={styles.statusText}>
                        {STATUS_MESSAGES[status] && intl.formatMessage(STATUS_MESSAGES[status])}
                    </div>
                </div>

                {running && (
                    <div
                        className={styles.progressTrack}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        // Determinate phases report a value; an indeterminate bar omits it.
                        {...(clampedPercent === null ? {} : {'aria-valuenow': clampedPercent})}
                    >
                        {clampedPercent === null ? (
                            <div className={styles.progressIndeterminate} />
                        ) : (
                            <div
                                className={styles.progressBar}
                                style={{width: `${clampedPercent}%`}}
                            >
                                <span className={styles.progressValue}>{`${clampedPercent}%`}</span>
                            </div>
                        )}
                    </div>
                )}

                {status === 'error' && error && (
                    <div className={styles.errorDetail}>{error}</div>
                )}

                {cleaned && (
                    <div className={styles.details}>
                        <button
                            className={styles.detailsToggle}
                            aria-expanded={showDetails}
                            onClick={handleToggleDetails}
                        >
                            <span className={classNames(styles.chevron, {[styles.chevronOpen]: showDetails})}>
                                {'▸'}
                            </span>
                            {intl.formatMessage(messages.showDetails)}
                        </button>
                        {showDetails && (
                            <pre
                                className={styles.log}
                                ref={logRef}
                            >
                                {cleaned}
                            </pre>
                        )}
                    </div>
                )}

                <div className={styles.footer}>
                    <button
                        className={classNames(styles.actionButton, {
                            [styles.actionButtonDanger]: running
                        })}
                        onClick={running ? onCancel : onClose}
                    >
                        {intl.formatMessage(running ? messages.cancel : messages.close)}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

UploadModal.propTypes = {
    error: PropTypes.string,
    logs: PropTypes.arrayOf(PropTypes.string),
    onCancel: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    progress: PropTypes.shape({
        phase: PropTypes.string,
        percent: PropTypes.number
    }),
    status: PropTypes.oneOf(['compiling', 'uploading', 'done', 'cancelled', 'error'])
};

export default UploadModal;
