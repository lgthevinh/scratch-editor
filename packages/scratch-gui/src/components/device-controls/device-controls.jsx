import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import greenFlagIcon from '../green-flag/icon--green-flag.svg';
import stopAllIcon from '../stop-all/icon--stop-all.svg';

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
    }
});

const DeviceControls = ({
    hasSelectedBoard,
    projectRunning,
    onRun,
    onStop,
    onUpload
}) => {
    const intl = useIntl();
    const isStopButton = !hasSelectedBoard && projectRunning;
    const label = isStopButton ? messages.stop : (hasSelectedBoard ? messages.upload : messages.run);
    const icon = isStopButton ? stopAllIcon : greenFlagIcon;
    const onClick = isStopButton ? onStop : (hasSelectedBoard ? onUpload : onRun);

    return (
        <div className={styles.controlsHeader}>
            <button
                className={classNames(styles.primaryButton, {
                    [styles.uploadButton]: hasSelectedBoard,
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
        </div>
    );
};

DeviceControls.propTypes = {
    hasSelectedBoard: PropTypes.bool,
    projectRunning: PropTypes.bool.isRequired,
    onRun: PropTypes.func.isRequired,
    onStop: PropTypes.func.isRequired,
    onUpload: PropTypes.func.isRequired
};

DeviceControls.defaultProps = {
    hasSelectedBoard: false
};

export default DeviceControls;
