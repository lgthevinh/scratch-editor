import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {connect} from 'react-redux';
import VM from '@scratch/scratch-vm';

import {showAlertWithTimeout, showStandardAlert} from '../../reducers/alerts';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import ToggleButtons from '../toggle-buttons/toggle-buttons.jsx';
import Controls from '../../containers/controls.jsx';
import {getStageDimensions} from '../../lib/screen-utils';
import {STAGE_SIZE_MODES} from '../../lib/layout-constants';

import fullScreenIcon from './icon--fullscreen.svg';
import largeStageIcon from './icon--large-stage.svg';
import smallStageIcon from './icon--small-stage.svg';
import unFullScreenIcon from './icon--unfullscreen.svg';

import scratchLogo from '../menu-bar/scratch-logo.svg';
import styles from './stage-header.css';
import {storeProjectThumbnail} from '../../lib/store-project-thumbnail.js';
import dataURItoBlob from '../../lib/data-uri-to-blob.js';
import throttle from 'lodash.throttle';
import thumbnailIcon from './icon--thumbnail.svg';
import {
    getIsShowingWithId,
    getIsUpdating
} from '../../reducers/project-state.js';
import ConfirmationPrompt from '../confirmation-prompt/confirmation-prompt.jsx';
import Tooltip from '../tooltip/tooltip.jsx';
import classNames from 'classnames';

const messages = defineMessages({
    largeStageSizeMessage: {
        defaultMessage: 'Switch to large stage',
        description: 'Button to change stage size to large',
        id: 'gui.stageHeader.stageSizeLarge'
    },
    smallStageSizeMessage: {
        defaultMessage: 'Switch to small stage',
        description: 'Button to change stage size to small',
        id: 'gui.stageHeader.stageSizeSmall'
    },
    fullStageSizeMessage: {
        defaultMessage: 'Enter full screen mode',
        description: 'Button to change stage size to full screen',
        id: 'gui.stageHeader.stageSizeFull'
    },
    unFullStageSizeMessage: {
        defaultMessage: 'Exit full screen mode',
        description: 'Button to get out of full screen mode',
        id: 'gui.stageHeader.stageSizeUnFull'
    },
    setThumbnail: {
        defaultMessage: 'Set Thumbnail',
        description: 'Manually save project thumbnail',
        id: 'gui.stageHeader.saveThumbnail'
    },
    setThumbnailMessage: {
        defaultMessage: 'Are you sure you want to set your thumbnail?',
        description: 'Confirmation message for manually saving project thumbnail',
        id: 'gui.stageHeader.saveThumbnailMessage'
    },
    thumbnailTooltipTitle: {
        defaultMessage: 'Hey there! 👋',
        description: 'Title for the thumbnail tooltip',
        id: 'gui.stageHeader.thumbnailTooltipTitle'
    },
    thumbnailTooltipBody: {
        defaultMessage: 'The “{boldText}” has a new spot. The way it works is by ' +
            'taking a snapshot of your canvas and setting it as your project thumbnail.',
        description: 'Body text for the thumbnail tooltip',
        id: 'gui.stageHeader.thumbnailTooltipBody'
    },
    fullscreenControl: {
        defaultMessage: 'Full Screen Control',
        description: 'Button to enter/exit full screen mode',
        id: 'gui.stageHeader.fullscreenControl'
    }
});

const StageHeaderComponent = function (props) {
    const {
        isFullScreen,
        isPlayerOnly,
        manuallySaveThumbnails,
        onKeyPress,
        onSetStageLarge,
        onSetStageSmall,
        onSetStageFull,
        onSetStageUnFull,
        onUpdateProjectThumbnail,
        projectId,
        showBranding,
        stageSizeMode,
        vm,
        isInEditor,
        isProjectLoaded,
        userOwnsProject,
        showThumbnailSetting,
        showThumbnailSuccess,
        showThumbnailError
    } = props;
    const intl = useIntl();

    let header = null;

    const thumbnailTooltipId = 'thumbnail-tooltip';
    const thumbnailButtonRef = useRef(null);

    const [isThumbnailPromptOpen, setIsThumbnailPromptOpen] = useState(false);
    const [isThumbnailTooltipOpen, setIsThumbnailTooltipOpen] = useState(false);
    const [isUpdatingThumbnail, setIsUpdatingThumbnail] = useState(false);

    // To remove - new feature awareness tooltip
    useEffect(() => {
        if (manuallySaveThumbnails && isInEditor && isProjectLoaded &&
            userOwnsProject && thumbnailButtonRef.current) {
            setIsThumbnailTooltipOpen(true);
        }
    }, [manuallySaveThumbnails, isInEditor, isProjectLoaded, userOwnsProject]);

    const onUpdateThumbnail = useCallback(
        throttle(
            () => {
                if (!onUpdateProjectThumbnail) return;

                setIsUpdatingThumbnail(true);
                showThumbnailSetting();

                storeProjectThumbnail(vm, dataURI => {
                    try {
                        onUpdateProjectThumbnail(projectId, dataURItoBlob(dataURI)).then();
                        showThumbnailSuccess();
                    } catch (e) {
                        showThumbnailError();
                    } finally {
                        setIsUpdatingThumbnail(false);
                    }
                });
            },
            3000
        ),
        [onUpdateProjectThumbnail, projectId, showThumbnailSetting, showThumbnailSuccess, showThumbnailError, vm]
    );

    const onThumbnailPromptOpen = useCallback(() => {
        setIsThumbnailPromptOpen(true);
    }, []);

    const onThumbnailPromptClose = useCallback(() => {
        setIsThumbnailPromptOpen(false);
    }, []);

    const onUpdateThumbnailAndClose = useCallback(() => {
        onUpdateThumbnail();
        onThumbnailPromptClose();
    }, [onUpdateThumbnail]);

    const onOpenTooltip = useCallback(() => {
        setIsThumbnailTooltipOpen(true);
    }, []);

    const onCloseTooltip = useCallback(() => {
        setIsThumbnailTooltipOpen(false);
    }, []);

    if (isFullScreen) {
        const stageDimensions = getStageDimensions(null, true);
        const stageButton = showBranding ? (
            <div className={styles.embedScratchLogo}>
                <a
                    href="https://scratch.mit.edu"
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    <img
                        alt="Scratch"
                        src={scratchLogo}
                    />
                </a>
            </div>
        ) : (
            <div className={styles.unselectWrapper}>
                <Button
                    className={styles.stageButton}
                    onClick={onSetStageUnFull}
                    onKeyPress={onKeyPress}
                >
                    <img
                        alt={intl.formatMessage(messages.unFullStageSizeMessage)}
                        className={styles.stageButtonIcon}
                        draggable={false}
                        src={unFullScreenIcon}
                        title={intl.formatMessage(messages.fullscreenControl)}
                    />
                </Button>
            </div>
        );
        header = (
            <Box className={styles.stageHeaderWrapperOverlay}>
                <Box
                    className={styles.stageMenuWrapper}
                    style={{width: stageDimensions.width}}
                >
                    <Controls vm={vm} />
                    {stageButton}
                </Box>
            </Box>
        );
    } else {
        const stageControls =
            isPlayerOnly ? (
                []
            ) : (
                <div className={styles.stageSizeToggleGroup}>
                    <ToggleButtons
                        buttons={[
                            {
                                handleClick: onSetStageSmall,
                                icon: smallStageIcon,
                                iconClassName: styles.stageButtonIcon,
                                isSelected: stageSizeMode === STAGE_SIZE_MODES.small,
                                title: intl.formatMessage(messages.smallStageSizeMessage)
                            },
                            {
                                handleClick: onSetStageLarge,
                                icon: largeStageIcon,
                                iconClassName: styles.stageButtonIcon,
                                isSelected: stageSizeMode === STAGE_SIZE_MODES.large,
                                title: intl.formatMessage(messages.largeStageSizeMessage)
                            }
                        ]}
                    />
                </div>
            );
        header = (
            <Box className={styles.stageHeaderWrapper}>
                <Box className={styles.stageMenuWrapper}>
                    <Controls vm={vm} />
                    <div className={styles.stageSizeRow}>
                        {/* To remove - new feature awareness tooltip */}
                        <Tooltip
                            isOpen={isThumbnailTooltipOpen}
                            onRequestOpen={onOpenTooltip}
                            onRequestClose={onCloseTooltip}
                            targetRef={thumbnailButtonRef}
                            primaryPosition="left"
                            secondaryPosition="down"
                            width={336}
                            title={intl.formatMessage(messages.thumbnailTooltipTitle)}
                            body={
                                <FormattedMessage
                                    {...messages.thumbnailTooltipBody}
                                    values={{
                                        boldText: <b>{intl.formatMessage(messages.setThumbnail)}</b>
                                    }}
                                />
                            }
                        />
                        {manuallySaveThumbnails && isInEditor && isProjectLoaded && userOwnsProject && (
                            <Button
                                aria-label={intl.formatMessage(messages.setThumbnail)}
                                title={intl.formatMessage(messages.setThumbnail)}
                                className={classNames(
                                    styles.stageButton,
                                    {[styles.stageButtonHighlighted]: isThumbnailTooltipOpen}
                                )}
                                onClick={onThumbnailPromptOpen}
                                disabled={isUpdatingThumbnail}
                                componentRef={thumbnailButtonRef}
                                data-tip={intl.formatMessage(messages.setThumbnail)}
                                data-for={thumbnailTooltipId}
                            >
                                <img
                                    src={thumbnailIcon}
                                    alt={intl.formatMessage(messages.setThumbnail)}
                                    className={styles.stageButtonIcon}
                                />
                            </Button>
                        )}
                        <ConfirmationPrompt
                            isOpen={isThumbnailPromptOpen}
                            title={messages.setThumbnail}
                            message={<FormattedMessage {...messages.setThumbnailMessage} />}
                            onConfirm={onUpdateThumbnailAndClose}
                            onCancel={onThumbnailPromptClose}
                            relativeElementRef={thumbnailButtonRef}
                            primaryPosition="down"
                            secondaryPosition="left"
                        />
                        {stageControls}
                        <div className={styles.rightSection}>
                            <Button
                                className={styles.stageButton}
                                onClick={onSetStageFull}
                            >
                                <img
                                    alt={intl.formatMessage(messages.fullStageSizeMessage)}
                                    className={styles.stageButtonIcon}
                                    draggable={false}
                                    src={fullScreenIcon}
                                    title={intl.formatMessage(messages.fullscreenControl)}
                                />
                            </Button>
                        </div>
                    </div>
                </Box>
            </Box>
        );
    }

    return header;
};

const mapStateToProps = state => {
    const projectState = state.scratchGui.projectState;
    const loadingState = projectState.loadingState;

    return {
        projectId: projectState.projectId,
        // This is the button's mode, as opposed to the actual current state
        stageSizeMode: state.scratchGui.stageSize.stageSize,
        isProjectLoaded: getIsShowingWithId(loadingState) || getIsUpdating(loadingState)
    };
};

const mapDispatchToProps = dispatch => ({
    showThumbnailSetting: () => dispatch(showStandardAlert('settingThumbnail')),
    showThumbnailSuccess: () => showAlertWithTimeout(dispatch, 'thumbnailSuccess'),
    showThumbnailError: () => showAlertWithTimeout(dispatch, 'thumbnailError')
});

StageHeaderComponent.propTypes = {
    isFullScreen: PropTypes.bool.isRequired,
    isPlayerOnly: PropTypes.bool.isRequired,
    manuallySaveThumbnails: PropTypes.bool,
    onKeyPress: PropTypes.func.isRequired,
    onSetStageFull: PropTypes.func.isRequired,
    onSetStageLarge: PropTypes.func.isRequired,
    onSetStageSmall: PropTypes.func.isRequired,
    onSetStageUnFull: PropTypes.func.isRequired,
    onUpdateProjectThumbnail: PropTypes.func,
    projectId: PropTypes.number.isRequired,
    showBranding: PropTypes.bool.isRequired,
    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
    vm: PropTypes.instanceOf(VM).isRequired,
    isInEditor: PropTypes.bool,
    isProjectLoaded: PropTypes.bool,
    userOwnsProject: PropTypes.bool.isRequired,
    showThumbnailSetting: PropTypes.func,
    showThumbnailSuccess: PropTypes.func,
    showThumbnailError: PropTypes.func
};

StageHeaderComponent.defaultProps = {
    stageSizeMode: STAGE_SIZE_MODES.large,
    isInEditor: false
};

export default connect(mapStateToProps, mapDispatchToProps)(StageHeaderComponent);
