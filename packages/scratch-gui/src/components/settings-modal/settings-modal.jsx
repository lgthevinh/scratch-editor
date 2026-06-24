import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, FormattedMessage} from 'react-intl';

import intlShape from '../../lib/intlShape.js';
import {LINK_MODE, CLOUD_MODE} from '../../lib/settings/link-mode';
import Box from '../box/box.jsx';
import Modal from '../modal/modal.jsx';

import styles from './settings-modal.css';

const messages = defineMessages({
    title: {
        id: 'gui.settingsModal.title',
        defaultMessage: 'Settings',
        description: 'Settings modal title and accessibility label'
    },
    linkTab: {
        id: 'gui.settingsModal.linkTab',
        defaultMessage: 'Link',
        description: 'Sidebar label for the device-link settings section'
    },
    linkHeading: {
        id: 'gui.settingsModal.linkHeading',
        defaultMessage: 'Connection mode',
        description: 'Heading for the device-link mode selector'
    },
    linkDescription: {
        id: 'gui.settingsModal.linkDescription',
        defaultMessage: 'Choose how the editor builds firmware and connects to your board.',
        description: 'Sub-heading explaining the device-link mode selector'
    },
    linkClient: {
        id: 'gui.settingsModal.linkClient',
        defaultMessage: 'Link client',
        description: 'Label for the native-helper device-link option'
    },
    linkClientDescription: {
        id: 'gui.settingsModal.linkClientDescription',
        defaultMessage: 'Build and flash through the local helper app on your computer.',
        description: 'Description of the native-helper device-link option'
    },
    cloudClient: {
        id: 'gui.settingsModal.cloudClient',
        defaultMessage: 'Cloud client',
        description: 'Label for the web/cloud device-link option'
    },
    cloudClientDescription: {
        id: 'gui.settingsModal.cloudClientDescription',
        defaultMessage: 'Build in the cloud and flash from the browser over Web Serial.',
        description: 'Description of the web/cloud device-link option'
    }
});

const SettingsModal = ({intl, isRtl, linkMode, onRequestClose, onSetLinkMode}) => {
    const handleSelect = mode => () => onSetLinkMode(mode);
    const options = [
        {mode: LINK_MODE, label: messages.linkClient, description: messages.linkClientDescription},
        {mode: CLOUD_MODE, label: messages.cloudClient, description: messages.cloudClientDescription}
    ];
    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            isRtl={isRtl}
            onRequestClose={onRequestClose}
        >
            <Box className={styles.body}>
                <div className={styles.sidebar}>
                    <button className={classNames(styles.tab, styles.tabActive)}>
                        <FormattedMessage {...messages.linkTab} />
                    </button>
                </div>
                <div className={styles.content}>
                    <div className={styles.contentHeading}>
                        <FormattedMessage {...messages.linkHeading} />
                    </div>
                    <div className={styles.contentDescription}>
                        <FormattedMessage {...messages.linkDescription} />
                    </div>
                    <div className={styles.options}>
                        {options.map(option => (
                            <label
                                key={option.mode}
                                className={classNames(styles.option, {
                                    [styles.optionSelected]: linkMode === option.mode
                                })}
                            >
                                <input
                                    className={styles.optionRadio}
                                    name="linkMode"
                                    type="radio"
                                    value={option.mode}
                                    checked={linkMode === option.mode}
                                    onChange={handleSelect(option.mode)}
                                />
                                <span className={styles.optionText}>
                                    <span className={styles.optionLabel}>
                                        <FormattedMessage {...option.label} />
                                    </span>
                                    <span className={styles.optionDescription}>
                                        <FormattedMessage {...option.description} />
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </Box>
        </Modal>
    );
};

SettingsModal.propTypes = {
    intl: intlShape.isRequired,
    isRtl: PropTypes.bool,
    linkMode: PropTypes.string.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onSetLinkMode: PropTypes.func.isRequired
};

export default injectIntl(SettingsModal);
