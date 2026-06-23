import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {defineMessages, useIntl} from 'react-intl';

import Modal from '../../containers/modal.jsx';
import ScanningStep from '../connection-modal/scanning-step.jsx';

import styles from '../connection-modal/connection-modal.css';

const messages = defineMessages({
    title: {
        id: 'gui.boardListDialog.title',
        defaultMessage: 'Connect a board',
        description: 'Title of the dialog that lists boards available to connect'
    }
});

// Reuses the connection modal's scanning step (radar / device tiles / refresh) so the board picker
// matches the peripheral connection UI. Boards are mapped onto the peripheral shape the step expects;
// they have no signal strength, so `rssi` is a constant.
const BoardListDialog = ({boards, scanning, deviceIconURL, onConnectBoard, onScan, onCloseDialog}) => {
    const intl = useIntl();
    const peripheralList = (boards || []).map(board => ({
        peripheralId: board.id,
        name: board.name,
        rssi: 0
    }));
    // ScanningStep shows its tile list only while `scanning` is true (the BLE flow scans continuously);
    // it falls back to "No devices found" otherwise. Our scan is one-shot, so keep that view alive
    // whenever a scan is in flight or we have boards to show — only an empty, finished scan is "none".
    const showingBoards = scanning || peripheralList.length > 0;
    return (
        <Modal
            className={classNames(styles.modalContent, styles.boardListModalContent)}
            contentLabel={intl.formatMessage(messages.title)}
            headerClassName={styles.header}
            id="boardListDialog"
            onRequestClose={onCloseDialog}
        >
            <ScanningStep
                activityAreaClassName={styles.boardListActivityArea}
                bottomAreaClassName={styles.boardListBottomArea}
                connectionSmallIconURL={deviceIconURL}
                peripheralTileClassName={styles.boardListPeripheralTile}
                peripheralList={peripheralList}
                scanning={showingBoards}
                showSignalStrength={false}
                showStepDots={false}
                onConnecting={onConnectBoard}
                onRefresh={onScan}
            />
        </Modal>
    );
};

BoardListDialog.propTypes = {
    boards: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string
    })),
    deviceIconURL: PropTypes.string,
    onCloseDialog: PropTypes.func.isRequired,
    onConnectBoard: PropTypes.func.isRequired,
    onScan: PropTypes.func.isRequired,
    scanning: PropTypes.bool
};

export default BoardListDialog;
