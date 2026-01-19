import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {connect} from 'react-redux';
import useMenuNavigation from '../../hooks/use-menu-navigation.jsx';

import check from './check.svg';
import {MenuItem, Submenu} from '../menu/menu.jsx';

import styles from './settings-menu.css';

import dropdownCaret from './dropdown-caret.svg';

const intlMessageShape = PropTypes.shape({
    defaultMessage: PropTypes.string,
    description: PropTypes.string,
    id: PropTypes.string
});

const PreferenceItem = props => {
    const item = props.item;

    return (
        <MenuItem
            onClick={props.onClick}
            onParentKeyPress={props.onParentKeyPress}
            isSelected={props.isSelected}
            {...props}
        >
            <div className={styles.option}>
                <img
                    className={classNames(styles.check, {[styles.selected]: props.isSelected})}
                    src={check}
                />
                {item.icon && <img
                    className={styles.icon}
                    src={item.icon}
                />}
                <FormattedMessage {...item.label} />
            </div>
        </MenuItem>);
};

PreferenceItem.propTypes = {
    isSelected: PropTypes.bool,
    onClick: PropTypes.func,
    item: PropTypes.shape({
        icon: PropTypes.string,
        label: intlMessageShape.isRequired
    }),
    onParentKeyPress: PropTypes.func
};

const PreferenceMenu = ({
    itemsMap,
    onChange,
    defaultMenuIconSrc,
    submenuLabel,
    selectedItemKey,
    isRtl
}) => {
    const itemKeys = Object.keys(itemsMap);
    const selectedItem = itemsMap[selectedItemKey];

    const {
        isExpanded,
        handleKeyPress,
        handleKeyPressOpenMenu,
        handleOnOpen,
        menuRef
    } = useMenuNavigation({
        depth: 2
    });

    return (
        <MenuItem
            expanded={isExpanded()}
            data-menu-item-wrapper="true"
        >
            <button
                className={styles.option}
                onClick={handleOnOpen}
                ref={menuRef}
                aria-expanded={isExpanded()}
                tabIndex={-1}
                onKeyDown={handleKeyPress}
                data-menu-item="true"
            >
                <img
                    src={selectedItem.icon || defaultMenuIconSrc}
                    style={{width: 24}}
                />
                <span className={styles.submenuLabel}>
                    <FormattedMessage {...submenuLabel} />
                </span>
                <img
                    className={styles.expandCaret}
                    src={dropdownCaret}
                />
            </button>
            <Submenu place={isRtl ? 'left' : 'right'}>
                {itemKeys.map(itemKey => (
                    <PreferenceItem
                        onParentKeyPress={handleKeyPressOpenMenu}
                        data-menu-item="true"
                        key={itemKey}
                        isSelected={itemKey === selectedItemKey}
                        // eslint-disable-next-line react/jsx-no-bind
                        onClick={() => onChange(itemKey)}
                        item={itemsMap[itemKey]}
                    />)
                )}
            </Submenu>
        </MenuItem>
    );
};

PreferenceMenu.propTypes = {
    itemsMap: PropTypes.objectOf(PropTypes.shape({
        icon: PropTypes.string,
        label: intlMessageShape.isRequired
    })).isRequired,
    onChange: PropTypes.func,
    defaultMenuIconSrc: PropTypes.string,
    submenuLabel: intlMessageShape.isRequired,
    selectedItemKey: PropTypes.string,
    isRtl: PropTypes.bool
};

const mapStateToProps = state => ({
    isRtl: state.locales.isRtl
});

export default connect(
    mapStateToProps
)(PreferenceMenu);
