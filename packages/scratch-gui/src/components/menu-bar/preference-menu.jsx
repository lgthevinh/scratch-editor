import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {connect} from 'react-redux';

import check from './check.svg';
import {MenuItem, Submenu} from '../menu/menu.jsx';
import {BaseMenu} from './base-menu.jsx';

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
            menuRef={props.menuRef}
            isSelected={props.isSelected}
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
    onParentKeyPress: PropTypes.func,
    menuRef: PropTypes.shape({current: PropTypes.instanceOf(Element)})
};

class PreferenceMenu extends BaseMenu {
    constructor (props) {
        super(props);

        this.itemRefs = Object.keys(this.props.itemsMap).map(() => React.createRef());
    }

    render () {
        const {
            itemsMap,
            onChange,
            defaultMenuIconSrc,
            submenuLabel,
            selectedItemKey,
            isRtl,
            menuRef
        } = this.props;

        const itemKeys = Object.keys(itemsMap);
        const selectedItem = itemsMap[selectedItemKey];

        return (
            <MenuItem expanded={this.isExpanded()}>
                <div
                    className={styles.option}
                    onClick={this.handleOnOpen}
                    ref={menuRef}
                    aria-expanded={this.isExpanded()}
                    role="button"
                    tabIndex={-1}
                    onKeyDown={this.handleKeyPress}
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
                </div>
                <Submenu place={isRtl ? 'left' : 'right'}>
                    {itemKeys.map((itemKey, index) => (
                        <PreferenceItem
                            onParentKeyPress={this.handleKeyPressOpenMenu}
                            key={itemKey}
                            isSelected={itemKey === selectedItemKey}
                            // eslint-disable-next-line react/jsx-no-bind
                            onClick={() => onChange(itemKey)}
                            item={itemsMap[itemKey]}
                            menuRef={this.itemRefs[index]}
                        />)
                    )}
                </Submenu>
            </MenuItem>
        );
    }
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
    isRtl: PropTypes.bool,
    menuRef: PropTypes.shape({current: PropTypes.instanceOf(Element)})
};

const mapStateToProps = state => ({
    isRtl: state.locales.isRtl
});

export default connect(
    mapStateToProps
)(PreferenceMenu);
