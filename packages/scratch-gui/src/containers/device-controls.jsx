import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from '@scratch/scratch-vm';

import DeviceControlsComponent from '../components/device-controls/device-controls.jsx';
import {deviceIcons} from '../lib/libraries/boards/index.jsx';

class DeviceControls extends React.Component {
    constructor (props) {
        super(props);
        this.handleRun = this.handleRun.bind(this);
        this.handleStop = this.handleStop.bind(this);
        this.handleUpload = this.handleUpload.bind(this);
        this.handleConnect = this.handleConnect.bind(this);
        this.handleScan = this.handleScan.bind(this);
        this.handleConnectBoard = this.handleConnectBoard.bind(this);
        this.handleCloseDialog = this.handleCloseDialog.bind(this);
        this.state = {
            dialogOpen: false,
            scanning: false,
            // null until a scan runs; an array (possibly empty) once it has.
            boards: null
        };
    }

    componentWillUnmount () {
        this._unmounted = true;
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

    handleConnectBoard () {
        // Selecting a board closes the dialog. Opening the transport (and the upload pipeline) is the
        // next milestone — the helper still answers `connect` with `unimplemented`.
        this.setState({dialogOpen: false});
    }

    handleCloseDialog () {
        this.setState({dialogOpen: false});
    }

    render () {
        const {
            hasSelectedDevice,
            projectRunning,
            selectedDeviceId
        } = this.props;

        return (
            <DeviceControlsComponent
                hasSelectedDevice={hasSelectedDevice}
                projectRunning={projectRunning}
                dialogOpen={this.state.dialogOpen}
                scanning={this.state.scanning}
                boards={this.state.boards}
                deviceIconURL={deviceIcons[selectedDeviceId]}
                onRun={this.handleRun}
                onStop={this.handleStop}
                onUpload={this.handleUpload}
                onConnect={this.handleConnect}
                onScan={this.handleScan}
                onConnectBoard={this.handleConnectBoard}
                onCloseDialog={this.handleCloseDialog}
            />
        );
    }
}

DeviceControls.propTypes = {
    hasSelectedDevice: PropTypes.bool.isRequired,
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    selectedDeviceId: PropTypes.string,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    hasSelectedDevice: state.scratchGui.board.selectedDeviceId !== null,
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    selectedDeviceId: state.scratchGui.board.selectedDeviceId,
    vm: state.scratchGui.vm
});

export default connect(mapStateToProps)(DeviceControls);
