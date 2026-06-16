import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import React from 'react';
import VM from '@scratch/scratch-vm';
import {
    thingbotLoaded,
    thingbotConnectSuccess,
    thingbotDisconnect
} from '../reducers/thingbot-telemetrix';
import {openConnectionModal} from '../reducers/modals';
import {setConnectionModalExtensionId} from '../reducers/connection-modal';

const THINGBOT_EXTENSION_ID = 'thingbotTelemetrix';

// Mirror Runtime static event names to avoid importing the engine into GUI
const PERIPHERAL_CONNECTED = 'PERIPHERAL_CONNECTED';
const PERIPHERAL_DISCONNECTED = 'PERIPHERAL_DISCONNECTED';
const PERIPHERAL_REQUEST_ERROR = 'PERIPHERAL_REQUEST_ERROR';

const MenuBarHOC = function (WrappedComponent) {
    class MenuBarContainer extends React.PureComponent {
        constructor (props) {
            super(props);

            bindAll(this, [
                'confirmReadyToReplaceProject',
                'shouldSaveBeforeTransition',
                'handleExtensionAdded',
                'handleBLEConnected',
                'handleBLEDisconnected',
                'handleBLEError'
            ]);
        }

        componentDidMount () {
            this.props.vm.addListener('EXTENSION_ADDED', this.handleExtensionAdded);
            this.props.vm.addListener(PERIPHERAL_CONNECTED, this.handleBLEConnected);
            this.props.vm.addListener(PERIPHERAL_DISCONNECTED, this.handleBLEDisconnected);
            this.props.vm.addListener(PERIPHERAL_REQUEST_ERROR, this.handleBLEError);

            // Handle restored project (extension already loaded)
            if (this.props.vm.extensionManager.isExtensionLoaded(THINGBOT_EXTENSION_ID)) {
                this.props.onThingbotLoaded();
            }
        }

        componentWillUnmount () {
            this.props.vm.removeListener('EXTENSION_ADDED', this.handleExtensionAdded);
            this.props.vm.removeListener(PERIPHERAL_CONNECTED, this.handleBLEConnected);
            this.props.vm.removeListener(PERIPHERAL_DISCONNECTED, this.handleBLEDisconnected);
            this.props.vm.removeListener(PERIPHERAL_REQUEST_ERROR, this.handleBLEError);
        }

        handleExtensionAdded (categoryInfo) {
            if (categoryInfo.id === THINGBOT_EXTENSION_ID) {
                this.props.onThingbotLoaded();
            }
        }

        handleBLEConnected () {
            this.props.onThingbotConnectSuccess();
        }

        handleBLEDisconnected () {
            this.props.onThingbotDisconnect();
        }

        handleBLEError () {
            this.props.onThingbotDisconnect();
        }

        confirmReadyToReplaceProject (message) {
            let readyToReplaceProject = true;
            if (this.props.projectChanged && !this.props.canCreateNew) {
                readyToReplaceProject = this.props.confirmWithMessage(message);
            }
            return readyToReplaceProject;
        }

        shouldSaveBeforeTransition () {
            return (this.props.canSave && this.props.projectChanged);
        }

        render () {
            const {
                projectChanged: _projectChanged,
                onThingbotLoaded: _onThingbotLoaded,
                onThingbotConnectSuccess: _onThingbotConnectSuccess,
                ...props
            } = this.props;
            return (<WrappedComponent
                confirmReadyToReplaceProject={this.confirmReadyToReplaceProject}
                shouldSaveBeforeTransition={this.shouldSaveBeforeTransition}
                {...props}
            />);
        }
    }

    MenuBarContainer.propTypes = {
        canCreateNew: PropTypes.bool,
        canSave: PropTypes.bool,
        confirmWithMessage: PropTypes.func,
        projectChanged: PropTypes.bool,
        vm: PropTypes.instanceOf(VM).isRequired,
        onThingbotLoaded: PropTypes.func.isRequired,
        onThingbotConnectSuccess: PropTypes.func.isRequired,
        onThingbotConnect: PropTypes.func.isRequired,
        onThingbotDisconnect: PropTypes.func.isRequired
    };

    MenuBarContainer.defaultProps = {
        confirmWithMessage: message => (confirm(message)) // eslint-disable-line no-alert
    };

    const mapStateToProps = state => ({
        projectChanged: state.scratchGui.projectChanged,
        vm: state.scratchGui.vm,
        thingbotLoaded: state.scratchGui.thingbotTelemetrix.loaded,
        thingbotConnected: state.scratchGui.thingbotTelemetrix.connected,
        thingbotConnecting: state.scratchGui.thingbotTelemetrix.connecting
    });

    const mapDispatchToProps = dispatch => ({
        onThingbotLoaded: () => dispatch(thingbotLoaded()),
        onThingbotConnectSuccess: () => dispatch(thingbotConnectSuccess()),
        onThingbotDisconnect: () => dispatch(thingbotDisconnect()),
        openThingbotConnectionModal: () => {
            dispatch(setConnectionModalExtensionId(THINGBOT_EXTENSION_ID));
            dispatch(openConnectionModal());
        }
    });

    // Wire connect/disconnect to vm using stateProps.vm
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {},
        stateProps,
        dispatchProps,
        ownProps,
        {
            onThingbotConnect: () => {
                dispatchProps.openThingbotConnectionModal();
            },
            onThingbotDisconnect: () => {
                stateProps.vm.runtime.disconnectPeripheral(THINGBOT_EXTENSION_ID);
                dispatchProps.onThingbotDisconnect();
            }
        }
    );

    return connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(MenuBarContainer);
};

export default MenuBarHOC;
