import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from '@scratch/scratch-vm';

import DeviceControlsComponent from '../components/device-controls/device-controls.jsx';
import {setConnectedBoard} from '../reducers/board';

class DeviceControls extends React.Component {
    constructor (props) {
        super(props);
        this.handleRun = this.handleRun.bind(this);
        this.handleStop = this.handleStop.bind(this);
        this.handleUpload = this.handleUpload.bind(this);
        this.handleConnect = this.handleConnect.bind(this);
        this.handleScan = this.handleScan.bind(this);
        this.handleConnectBoard = this.handleConnectBoard.bind(this);
        this.handleDisconnect = this.handleDisconnect.bind(this);
        this.handleCloseDialog = this.handleCloseDialog.bind(this);
        this.handleDeviceDisconnected = this.handleDeviceDisconnected.bind(this);
        this.state = {
            dialogOpen: false,
            scanning: false,
            // null until a scan runs; an array (possibly empty) once it has.
            boards: null
        };
    }

    componentDidMount () {
        // The link drops on user disconnect and on a helper crash (socket close); the VM signals both
        // with one event, so this is the single source of truth for clearing the connected board.
        this.props.vm.on('DEVICE_DISCONNECTED', this.handleDeviceDisconnected);
    }

    componentWillUnmount () {
        this._unmounted = true;
        this.props.vm.removeListener('DEVICE_DISCONNECTED', this.handleDeviceDisconnected);
    }

    handleRun () {
        if (!this.props.isStarted) {
            this.props.vm.start();
        }
        this.props.vm.greenFlag();
    }

    handleStop () {
        this.props.vm.stopAll();
    }

    handleUpload () {
        // Firmware upload is not implemented yet; run the project until that pipeline exists.
        this.handleRun();
    }

    // Open the board dialog and immediately scan.
    handleConnect () {
        this.setState({dialogOpen: true, boards: null});
        this.handleScan();
    }

    handleScan () {
        this.setState({scanning: true});
        this.props.vm.listBoards(this.props.selectedDeviceId)
            .then(boards => {
                if (this._unmounted) return;
                this.setState({scanning: false, boards});
            })
            .catch(error => {
                if (this._unmounted) return;
                // The reused scanning step has no error view; an unreachable helper surfaces as an
                // empty list ("No devices found"). Log the cause for diagnosis.
                console.warn(`listBoards failed: ${error.message}`); // eslint-disable-line no-console
                this.setState({scanning: false, boards: []});
            });
    }

    handleConnectBoard (boardId) {
        const board = (this.state.boards || []).find(candidate => candidate.id === boardId);
        if (!board) return;
        this.props.vm.connectBoard(board)
            .then(() => {
                if (this._unmounted) return;
                this.props.setConnected(board);
                this.setState({dialogOpen: false});
            })
            .catch(error => {
                if (this._unmounted) return;
                // Keep the dialog open so the user can retry against another board.
                console.warn(`connect failed: ${error.message}`); // eslint-disable-line no-console
            });
    }

    handleDisconnect () {
        // State clears via the DEVICE_DISCONNECTED listener, which also covers a helper crash.
        this.props.vm.disconnectBoard();
    }

    handleDeviceDisconnected () {
        if (this._unmounted) return;
        this.props.setConnected(null);
    }

    handleCloseDialog () {
        this.setState({dialogOpen: false});
    }

    render () {
        const {
            connectedBoard,
            hasSelectedDevice,
            projectRunning,
            selectedDeviceId
        } = this.props;
        const selectedDevice = selectedDeviceId ?
            this.props.vm.getDeviceList().find(device => device.deviceId === selectedDeviceId) :
            null;

        return (
            <DeviceControlsComponent
                connectedBoard={connectedBoard}
                hasSelectedDevice={hasSelectedDevice}
                projectRunning={projectRunning}
                dialogOpen={this.state.dialogOpen}
                scanning={this.state.scanning}
                boards={this.state.boards}
                deviceIconURL={selectedDevice && selectedDevice.iconURL}
                onRun={this.handleRun}
                onStop={this.handleStop}
                onUpload={this.handleUpload}
                onConnect={this.handleConnect}
                onScan={this.handleScan}
                onConnectBoard={this.handleConnectBoard}
                onDisconnect={this.handleDisconnect}
                onCloseDialog={this.handleCloseDialog}
            />
        );
    }
}

DeviceControls.propTypes = {
    connectedBoard: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string
    }),
    hasSelectedDevice: PropTypes.bool.isRequired,
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    selectedDeviceId: PropTypes.string,
    setConnected: PropTypes.func.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    connectedBoard: state.scratchGui.board.connectedBoard,
    hasSelectedDevice: state.scratchGui.board.selectedDeviceId !== null,
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    selectedDeviceId: state.scratchGui.board.selectedDeviceId,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    setConnected: board => dispatch(setConnectedBoard(board))
});

export default connect(mapStateToProps, mapDispatchToProps)(DeviceControls);
