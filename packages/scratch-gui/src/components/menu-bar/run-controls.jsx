import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import greenFlagIcon from '../green-flag/icon--green-flag.svg';
import stopAllIcon from '../stop-all/icon--stop-all.svg';

const messages = defineMessages({
    run: {
        id: 'gui.runControls.run',
        defaultMessage: 'Run',
        description: 'Button to start running the project'
    },
    stop: {
        id: 'gui.runControls.stop',
        defaultMessage: 'Stop',
        description: 'Button to stop the running project'
    }
});

const RunControls = function ({active, buttonClassName, iconClassName, labelClassName, onRun, onStop}) {
    const intl = useIntl();
    return (
        <>
            <button
                className={classNames(buttonClassName, {active})}
                onClick={onRun}
                aria-label={intl.formatMessage(messages.run)}
            >
                <img
                    className={iconClassName}
                    draggable={false}
                    width="20"
                    height="20"
                    src={greenFlagIcon}
                />
                <span className={labelClassName}>
                    {intl.formatMessage(messages.run)}
                </span>
            </button>
            <button
                className={classNames(buttonClassName, {active})}
                onClick={active ? onStop : undefined}
                aria-label={intl.formatMessage(messages.stop)}
            >
                <img
                    className={iconClassName}
                    draggable={false}
                    width="20"
                    height="20"
                    src={stopAllIcon}
                />
                <span className={labelClassName}>
                    {intl.formatMessage(messages.stop)}
                </span>
            </button>
        </>
    );
};

RunControls.propTypes = {
    active: PropTypes.bool,
    buttonClassName: PropTypes.string,
    iconClassName: PropTypes.string,
    labelClassName: PropTypes.string,
    onRun: PropTypes.func.isRequired,
    onStop: PropTypes.func.isRequired
};

RunControls.defaultProps = {
    active: false
};

export default RunControls;
