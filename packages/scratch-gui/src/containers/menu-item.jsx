import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';

import {MenuItem as MenuItemComponent} from '../components/menu/menu.jsx';
import propTypes from '../lib/prop-types.js';

class MenuItem extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'navigateToHref'
        ]);
    }
    navigateToHref () {
        if (this.props.href) window.location.href = this.props.href;
    }
    render () {
        const {
            children,
            className,
            onClick,
            itemRef,
            onParentKeyPress
        } = this.props;
        const clickAction = onClick ? onClick : this.navigateToHref;
        return (
            <MenuItemComponent
                className={className}
                onClick={clickAction}
                itemRef={itemRef}
                onParentKeyPress={onParentKeyPress}
            >
                {children}
            </MenuItemComponent>
        );
    }
}

MenuItem.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    // can take an onClick prop, or take an href and build an onClick handler
    href: PropTypes.string,
    onClick: PropTypes.func,
    itemRef: propTypes.ref,
    onParentKeyPress: PropTypes.func
};

export default MenuItem;
