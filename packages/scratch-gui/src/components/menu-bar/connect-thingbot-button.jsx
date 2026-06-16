import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import Button from '../button/button.jsx';
import styles from './connect-thingbot-button.css';

const ConnectThingbotButton = ({className, connected, connecting, onConnect, onDisconnect}) => (
    <Button
        className={classNames(
            className,
            styles.connectButton,
            {
                [styles.connecting]: connecting,
                [styles.connected]: connected
            }
        )}
        onClick={connected ? onDisconnect : onConnect}
        disabled={connecting}
    >
        <span className={styles.indicator} />
        {connected ? 'ThingBot Connected' : connecting ? 'Connecting…' : 'Connect ThingBot'}
    </Button>
);

ConnectThingbotButton.propTypes = {
    className: PropTypes.string,
    connected: PropTypes.bool,
    connecting: PropTypes.bool,
    onConnect: PropTypes.func,
    onDisconnect: PropTypes.func
};

ConnectThingbotButton.defaultProps = {
    connected: false,
    connecting: false,
    onConnect: () => {},
    onDisconnect: () => {}
};

export default ConnectThingbotButton;
