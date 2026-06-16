import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import React from 'react';
import VM from '@scratch/scratch-vm';
import {
    thingbotLoaded,
    thingbotConnectStart,
    thingbotConnectSuccess,
    thingbotDisconnect
} from '../reducers/thingbot-telemetrix';

const THINGBOT_EXTENSION_ID = 'thingbotTelemetrix';

const MenuBarHOC = function (WrappedComponent) {
    class MenuBarContainer extends React.PureComponent {
        constructor (props) {
            super(props);

            bindAll(this, [
                'confirmReadyToReplaceProject',
                'shouldSaveBeforeTransition',
                'handleExtensionAdded'
            ]);
        }
        componentDidMount () {
            this.props.vm.addListener('EXTENSION_ADDED', this.handleExtensionAdded);
            // Handle case where extension was already loaded (e.g. restored project)
            if (this.props.vm.extensionManager.isExtensionLoaded(THINGBOT_EXTENSION_ID)) {
                this.props.onThingbotLoaded();
            }
        }
        componentWillUnmount () {
            this.props.vm.removeListener('EXTENSION_ADDED', this.handleExtensionAdded);
        }
        handleExtensionAdded (categoryInfo) {
            if (categoryInfo.id === THINGBOT_EXTENSION_ID) {
                this.props.onThingbotLoaded();
            }
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
                projectChanged,
                onThingbotLoaded, // eslint-disable-line no-unused-vars
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
        onThingbotLoaded: PropTypes.func.isRequired
    };
    MenuBarContainer.defaultProps = {
        // default to using standard js confirm
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
        onThingbotConnect: () => {
            // stub: replace with BLE connection logic when transport is ready
            dispatch(thingbotConnectStart());
            setTimeout(() => dispatch(thingbotConnectSuccess()), 1500);
        },
        onThingbotDisconnect: () => dispatch(thingbotDisconnect())
    });
    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );
    return connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(MenuBarContainer);
};

export default MenuBarHOC;
