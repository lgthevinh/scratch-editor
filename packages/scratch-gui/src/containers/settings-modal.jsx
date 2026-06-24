import PropTypes from 'prop-types';
import React, {useCallback} from 'react';
import {connect} from 'react-redux';
import VM from '@scratch/scratch-vm';

import SettingsModalComponent from '../components/settings-modal/settings-modal.jsx';
import {persistLinkMode} from '../lib/settings/link-mode/persistence';
import {setLinkMode} from '../reducers/settings';

const SettingsModal = ({linkMode, onRequestClose, onSetLinkMode, vm, ...props}) => {
    // Keep redux, the persisted cookie, and the VM's active client in sync from one place.
    const handleSetLinkMode = useCallback(mode => {
        onSetLinkMode(mode);
        persistLinkMode(mode);
        vm.setLinkMode(mode);
    }, [onSetLinkMode, vm]);

    return (
        <SettingsModalComponent
            {...props}
            linkMode={linkMode}
            onRequestClose={onRequestClose}
            onSetLinkMode={handleSetLinkMode}
        />
    );
};

SettingsModal.propTypes = {
    linkMode: PropTypes.string.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onSetLinkMode: PropTypes.func.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    isRtl: state.locales.isRtl,
    linkMode: state.scratchGui.settings.linkMode,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onSetLinkMode: mode => dispatch(setLinkMode(mode))
});

export default connect(mapStateToProps, mapDispatchToProps)(SettingsModal);
