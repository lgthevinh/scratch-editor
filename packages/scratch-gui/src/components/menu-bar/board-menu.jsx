import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessage, useIntl} from 'react-intl';
import {connect} from 'react-redux';
import VM from '@scratch/scratch-vm';

import {openBoardLibrary} from '../../reducers/modals';

import menuBarStyles from './menu-bar.css';
import styles from './board-menu.css';

const boardMenuMessage = defineMessage({
    id: 'gui.menuBar.board',
    defaultMessage: 'Board: {boardName}',
    description: 'Board selection menu item in the menu bar'
});

const selectBoardMessage = defineMessage({
    id: 'gui.menuBar.selectBoard',
    defaultMessage: 'Select board',
    description: 'Board menu button label when no board has been selected'
});

const BoardMenu = ({
    selectedDeviceId,
    vm,
    onOpenBoardLibrary
}) => {
    const intl = useIntl();
    const selectedDevice = selectedDeviceId ?
        vm.getDeviceList().find(device => device.deviceId === selectedDeviceId) :
        null;
    const label = selectedDevice ?
        intl.formatMessage(boardMenuMessage, {boardName: selectedDevice.name}) :
        intl.formatMessage(selectBoardMessage);

    return (
        <button
            className={classNames(menuBarStyles.menuBarItem, menuBarStyles.hoverable)}
            aria-label={label}
            onClick={onOpenBoardLibrary}
        >
            <span className={styles.label}>{label}</span>
        </button>
    );
};

BoardMenu.propTypes = {
    onOpenBoardLibrary: PropTypes.func.isRequired,
    selectedDeviceId: PropTypes.string,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    selectedDeviceId: state.scratchGui.board.selectedDeviceId,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onOpenBoardLibrary: () => dispatch(openBoardLibrary())
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(BoardMenu);
