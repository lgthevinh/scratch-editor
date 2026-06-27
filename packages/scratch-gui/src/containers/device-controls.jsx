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
        this.handleCancelUpload = this.handleCancelUpload.bind(this);
        this.handleCloseUpload = this.handleCloseUpload.bind(this);
        this.state = {
            dialogOpen: false,
            scanning: false,
            // null until a scan runs; an array (possibly empty) once it has.
            boards: null,
            // null when the upload modal is closed; otherwise one of
            // 'compiling' | 'uploading' | 'done' | 'cancelled' | 'error'.
            uploadStatus: null,
            uploadProgress: null,
            uploadLogs: [],
            uploadError: null
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
        // Uploading flashes the connected board; without one, send the user through the same scan
        // dialog the Connect button opens, then they press Upload again.
        if (!this.props.connectedBoard) {
            this.handleConnect();
            return;
        }
        const {selectedDeviceId, generatedCode} = this.props;
        if (!generatedCode.trim()) {
            console.warn('upload: no generated code to build'); // eslint-disable-line no-console
            return;
        }

        this.setState({
            uploadStatus: 'compiling',
            uploadProgress: null,
            uploadLogs: [],
            uploadError: null
        });
        const appendLog = chunk => {
            if (this._unmounted) return;
            this.setState(state => ({uploadLogs: [...state.uploadLogs, chunk]}));
        };

        this.props.vm.compile(selectedDeviceId, generatedCode, {
            onLog: appendLog,
            onProgress: progress => {
                if (this._unmounted) return;
                this.setState({uploadProgress: progress});
            }
        })
            .then(artifact => {
                if (this._unmounted) return;
                this.setState({uploadStatus: 'uploading', uploadProgress: null});
                return this.props.vm.upload(selectedDeviceId, artifact, {onLog: appendLog});
            })
            .then(() => {
                if (this._unmounted) return;
                this.setState({uploadStatus: 'done'});
            })
            .catch(error => {
                if (this._unmounted) return;
                // A user cancel rejects the in-flight compile/upload with the helper's 'cancelled' code;
                // show it as cancelled rather than a failure.
                if (error && error.code === 'cancelled') {
                    this.setState({uploadStatus: 'cancelled'});
                    return;
                }
                this.setState({uploadStatus: 'error', uploadError: error.message});
            });
    }

    handleCancelUpload () {
        // Aborts the in-flight compile or upload; the rejected promise lands in handleUpload's catch
        // and flips the modal to 'cancelled'. Leaves the modal open showing that outcome.
        this.props.vm.cancelUpload();
    }

    handleCloseUpload () {
        this.setState({uploadStatus: null});
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

        const uploading = this.state.uploadStatus === 'compiling' ||
            this.state.uploadStatus === 'uploading';

        return (
            <DeviceControlsComponent
                connectedBoard={connectedBoard}
                hasSelectedDevice={hasSelectedDevice}
                projectRunning={projectRunning}
                dialogOpen={this.state.dialogOpen}
                scanning={this.state.scanning}
                boards={this.state.boards}
                deviceIconURL={selectedDevice && selectedDevice.iconURL}
                uploading={uploading}
                uploadStatus={this.state.uploadStatus}
                uploadProgress={this.state.uploadProgress}
                uploadLogs={this.state.uploadLogs}
                uploadError={this.state.uploadError}
                onRun={this.handleRun}
                onStop={this.handleStop}
                onUpload={this.handleUpload}
                onCancelUpload={this.handleCancelUpload}
                onCloseUpload={this.handleCloseUpload}
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
    generatedCode: PropTypes.string.isRequired,
    hasSelectedDevice: PropTypes.bool.isRequired,
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    selectedDeviceId: PropTypes.string,
    setConnected: PropTypes.func.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    connectedBoard: state.scratchGui.board.connectedBoard,
    generatedCode: state.scratchGui.code.generatedCode,
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
