import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from '@scratch/scratch-vm';

import RunControlsComponent from '../components/menu-bar/run-controls.jsx';

class RunControls extends React.Component {
    constructor (props) {
        super(props);
        this.handleRun = this.handleRun.bind(this);
        this.handleStop = this.handleStop.bind(this);
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

    render () {
        const {buttonClassName, iconClassName, labelClassName, projectRunning} = this.props;
        return (
            <RunControlsComponent
                active={projectRunning}
                buttonClassName={buttonClassName}
                iconClassName={iconClassName}
                labelClassName={labelClassName}
                onRun={this.handleRun}
                onStop={this.handleStop}
            />
        );
    }
}

RunControls.propTypes = {
    buttonClassName: PropTypes.string,
    iconClassName: PropTypes.string,
    labelClassName: PropTypes.string,
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    vm: state.scratchGui.vm
});

export default connect(mapStateToProps)(RunControls);
