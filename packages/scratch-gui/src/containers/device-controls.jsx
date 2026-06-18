import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from '@scratch/scratch-vm';

import DeviceControlsComponent from '../components/device-controls/device-controls.jsx';

class DeviceControls extends React.Component {
    constructor (props) {
        super(props);
        this.handleRun = this.handleRun.bind(this);
        this.handleStop = this.handleStop.bind(this);
        this.handleUpload = this.handleUpload.bind(this);
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

    render () {
        const {
            hasSelectedBoard,
            projectRunning
        } = this.props;

        return (
            <DeviceControlsComponent
                hasSelectedBoard={hasSelectedBoard}
                projectRunning={projectRunning}
                onRun={this.handleRun}
                onStop={this.handleStop}
                onUpload={this.handleUpload}
            />
        );
    }
}

DeviceControls.propTypes = {
    hasSelectedBoard: PropTypes.bool.isRequired,
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    hasSelectedBoard: state.scratchGui.board.selectedBoardId !== null,
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    vm: state.scratchGui.vm
});

export default connect(mapStateToProps)(DeviceControls);
