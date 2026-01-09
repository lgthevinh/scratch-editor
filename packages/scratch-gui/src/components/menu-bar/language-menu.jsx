import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useRef} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {connect} from 'react-redux';
import locales from 'scratch-l10n';

import check from './check.svg';
import {MenuItem, Submenu} from '../menu/menu.jsx';
import languageIcon from '../language-selector/language-icon.svg';
import {selectLocale} from '../../reducers/locales.js';
import useMenuNavigation from '../../hooks/use-menu-navigation.jsx';

import styles from './settings-menu.css';
import intlShape from '../../lib/intlShape.js';

import dropdownCaret from './dropdown-caret.svg';
import propTypes from '../../lib/prop-types.js';

const languageMenu = defineMessage({
    id: 'gui.aria.languageMenu',
    defaultMessage: 'Language menu',
    description: 'ARIA label for language menu'
});

const LanguageMenu = props => {
    const {
        intl,
        currentLocale,
        menuRef,
        isRtl,
        onChangeLanguage
    } = props;

    const itemRefs = React.useMemo(
        () => Object.keys(locales).map(() => React.createRef()),
        []
    );
    let selectedRef = useRef(null);

    const {
        isExpanded,
        handleKeyPress,
        handleKeyPressOpenMenu,
        handleOnOpen
    } = useMenuNavigation({
        menuRef,
        itemRefs,
        depth: 2,
        defaultIndexOnOpen: (Object.keys(locales).indexOf(currentLocale))
    });

    useEffect(() => {
        const selectedIndex = Object.keys(locales).indexOf(currentLocale);
        if (isExpanded() && selectedIndex >= 0 && itemRefs[selectedIndex]?.current) {
            itemRefs[selectedIndex].current.scrollIntoView({block: 'center'});
        }
    }, [currentLocale, isExpanded, itemRefs]);

    const setRef = useCallback(component => {
        selectedRef = component;
    }, []);

    const handleMouseOver = useCallback(() => {
        // If we are using hover rather than clicks for submenus, scroll the selected option into view
        if (isExpanded() && selectedRef) {
            selectedRef.scrollIntoView({block: 'center'});
        }
    }, [isExpanded]);

    return (
        <MenuItem expanded={isExpanded()}>
            <div
                className={styles.option}
                onClick={handleOnOpen}
                onMouseOver={handleMouseOver}
                ref={menuRef}
                aria-label={intl.formatMessage(languageMenu)}
                aria-expanded={isExpanded()}
                role="button"
                tabIndex={-1}
                onKeyDown={handleKeyPress}
            >
                <img
                    className={styles.icon}
                    src={languageIcon}
                />
                <span className={styles.submenuLabel}>
                    <FormattedMessage
                        defaultMessage="Language"
                        description="Language sub-menu"
                        id="gui.menuBar.language"
                    />
                </span>
                <img
                    className={styles.expandCaret}
                    src={dropdownCaret}
                />
            </div>
            <Submenu
                className={styles.languageSubmenu}
                place={isRtl ? 'left' : 'right'}
            >
                {
                    Object.keys(locales)
                        .map((locale, index) => {
                            const isSelected = currentLocale === locale;

                            return (<MenuItem
                                key={locale}
                                className={styles.languageMenuItem}
                                // eslint-disable-next-line react/jsx-no-bind
                                onClick={() => onChangeLanguage(locale)}
                                itemRef={itemRefs[index]}
                                onParentKeyPress={handleKeyPressOpenMenu}
                                isSelected={isSelected}
                            >
                                <img
                                    className={classNames(styles.check, {
                                        [styles.selected]: isSelected
                                    })}
                                    src={check}
                                    {...(isSelected && {ref: setRef})}
                                />
                                {locales[locale].name}
                            </MenuItem>);
                        })
                }
            </Submenu>
        </MenuItem>
    );
};

LanguageMenu.propTypes = {
    menuRef: propTypes.ref.isRequired,
    intl: intlShape.isRequired,
    currentLocale: PropTypes.string,
    isRtl: PropTypes.bool,
    onChangeLanguage: PropTypes.func
};

const mapStateToProps = state => ({
    currentLocale: state.locales.locale,
    isRtl: state.locales.isRtl,
    messagesByLocale: state.locales.messagesByLocale
});

const mapDispatchToProps = dispatch => ({
    onChangeLanguage: locale => {
        dispatch(selectLocale(locale));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LanguageMenu);
