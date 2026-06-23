import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import greenFlagIcon from '../green-flag/icon--green-flag.svg';
import stopAllIcon from '../stop-all/icon--stop-all.svg';
import BoardListDialog from './board-list-dialog.jsx';

import styles from './device-controls.css';

const messages = defineMessages({
    run: {
        id: 'gui.deviceControls.run',
        defaultMessage: 'Run',
        description: 'Button to start running the project'
    },
    stop: {
        id: 'gui.deviceControls.stop',
        defaultMessage: 'Stop',
        description: 'Button to stop the running project'
    },
    upload: {
        id: 'gui.deviceControls.upload',
        defaultMessage: 'Upload',
        description: 'Button to upload the project to the selected board'
    },
    connect: {
        id: 'gui.deviceControls.connect',
        defaultMessage: 'Connect',
        description: 'Button to open the dialog that scans for connected boards'
    }
});

const DeviceControls = ({
    hasSelectedDevice = false,
    projectRunning,
    dialogOpen = false,
    scanning = false,
    boards = null,
    deviceIconURL,
    onRun,
    onStop,
    onUpload,
    onConnect,
    onScan,
    onConnectBoard,
    onCloseDialog
}) => {
    const intl = useIntl();
    const isStopButton = !hasSelectedDevice && projectRunning;
    const label = isStopButton ? messages.stop : (hasSelectedDevice ? messages.upload : messages.run);
    const icon = isStopButton ? stopAllIcon : greenFlagIcon;
    const onClick = isStopButton ? onStop : (hasSelectedDevice ? onUpload : onRun);

    return (
        <div className={styles.controlsHeader}>
            {hasSelectedDevice && (
                <button
                    className={styles.connectButton}
                    onClick={onConnect}
                    aria-label={intl.formatMessage(messages.connect)}
                >
                    {intl.formatMessage(messages.connect)}
                </button>
            )}
            <button
                className={classNames(styles.primaryButton, {
                    [styles.uploadButton]: hasSelectedDevice,
                    [styles.stopButton]: isStopButton
                })}
                onClick={onClick}
                aria-label={intl.formatMessage(label)}
            >
                <img
                    className={styles.primaryIcon}
                    draggable={false}
                    width="20"
                    height="20"
                    src={icon}
                />
                <span>{intl.formatMessage(label)}</span>
            </button>
            {dialogOpen && (
                <BoardListDialog
                    scanning={scanning}
                    boards={boards}
                    deviceIconURL={deviceIconURL}
                    onScan={onScan}
                    onConnectBoard={onConnectBoard}
                    onCloseDialog={onCloseDialog}
                />
            )}
        </div>
    );
};

DeviceControls.propTypes = {
    boards: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string
    })),
    deviceIconURL: PropTypes.string,
    dialogOpen: PropTypes.bool,
    hasSelectedDevice: PropTypes.bool,
    onCloseDialog: PropTypes.func.isRequired,
    onConnect: PropTypes.func.isRequired,
    onConnectBoard: PropTypes.func.isRequired,
    onRun: PropTypes.func.isRequired,
    onScan: PropTypes.func.isRequired,
    onStop: PropTypes.func.isRequired,
    onUpload: PropTypes.func.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    scanning: PropTypes.bool
};

export default DeviceControls;
