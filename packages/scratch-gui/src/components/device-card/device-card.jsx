import PropTypes from 'prop-types';
import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import styles from './device-card.css';

const requiresLabels = {
    serial: (
        <FormattedMessage
            defaultMessage="Serial"
            description="Connection requirement label for serial/USB devices"
            id="gui.deviceCard.requires.serial"
        />
    ),
    ble: (
        <FormattedMessage
            defaultMessage="Bluetooth"
            description="Connection requirement label for Bluetooth devices"
            id="gui.deviceCard.requires.ble"
        />
    ),
    usb: (
        <FormattedMessage
            defaultMessage="USB"
            description="Connection requirement label for USB devices"
            id="gui.deviceCard.requires.usb"
        />
    )
};

const DeviceCard = ({
    description,
    help,
    iconURL,
    itemKey,
    learnMore,
    manufacturer,
    name,
    onSelect,
    requires
}) => {
    const handleSelect = useCallback(() => onSelect(itemKey), [onSelect, itemKey]);

    return (
        <div className={styles.card}>
            <button
                className={styles.selectButton}
                type="button"
                onClick={handleSelect}
            >
                <div className={styles.imageContainer}>
                    {iconURL && (
                        <img
                            alt=""
                            className={styles.image}
                            draggable={false}
                            src={iconURL}
                        />
                    )}
                </div>
                <div className={styles.text}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.description}>{description}</span>
                </div>
                {(requires || manufacturer) && (
                    <div className={styles.metadata}>
                        <div className={styles.metadataColumn}>
                            {requires && (
                                <React.Fragment>
                                    <span className={styles.metadataLabel}>
                                        <FormattedMessage
                                            defaultMessage="Requires"
                                            description="Label for a device's connection requirement"
                                            id="gui.deviceCard.requires"
                                        />
                                    </span>
                                    <span className={styles.metadataDetail}>
                                        {requiresLabels[requires] || requires}
                                    </span>
                                </React.Fragment>
                            )}
                        </div>
                        <div className={styles.metadataColumn}>
                            {manufacturer && (
                                <React.Fragment>
                                    <span className={styles.metadataLabel}>
                                        <FormattedMessage
                                            defaultMessage="Manufacturer"
                                            description="Label for a device's manufacturer"
                                            id="gui.deviceCard.manufacturer"
                                        />
                                    </span>
                                    <span className={styles.metadataDetail}>{manufacturer}</span>
                                </React.Fragment>
                            )}
                        </div>
                    </div>
                )}
            </button>
            {(learnMore || help) && (
                <div className={styles.links}>
                    {learnMore && (
                        <a
                            className={styles.link}
                            href={learnMore}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <FormattedMessage
                                defaultMessage="Learn more"
                                description="Link to a device's documentation"
                                id="gui.deviceCard.learnMore"
                            />
                        </a>
                    )}
                    {help && (
                        <a
                            className={styles.link}
                            href={help}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <FormattedMessage
                                defaultMessage="Help"
                                description="Link to a device's help/support page"
                                id="gui.deviceCard.help"
                            />
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

DeviceCard.propTypes = {
    description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    help: PropTypes.string,
    iconURL: PropTypes.string,
    itemKey: PropTypes.string,
    learnMore: PropTypes.string,
    manufacturer: PropTypes.string,
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    onSelect: PropTypes.func.isRequired,
    requires: PropTypes.string
};

export default DeviceCard;
