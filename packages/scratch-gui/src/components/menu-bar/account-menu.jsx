import styles from './account-menu.css';
import stylesMenuBar from './menu-bar.css';
import classNames from 'classnames';
import React from 'react';
import useMenuNavigation from '../../hooks/use-menu-navigation';
import {useIntl, FormattedMessage, defineMessage} from 'react-intl';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';

import {AccountMenuOptionsPropTypes} from '../../lib/account-menu-options';

import MenuBarMenu from './menu-bar-menu.jsx';
import {MenuSection} from '../menu/menu.jsx';
import MenuItemContainer from '../../containers/menu-item.jsx';
import UserAvatar from './user-avatar.jsx';
import dropdownCaret from './dropdown-caret.svg';

const accountMenu = defineMessage({
    id: 'gui.aria.accountMenu',
    defaultMessage: 'Account menu',
    description: 'accessibility label for account menu'
});

const AccountMenu = ({
    menuOpts,
    username,
    isRtl,
    onLogOut,
    avatarBadge
}) => {
    const {
        avatarUrl,
        myStuffUrl,
        profileUrl,
        myClassesUrl,
        myClassUrl,
        accountSettingsUrl,
        canLogout
    } = menuOpts;

    const intl = useIntl();

    const {
        isExpanded,
        handleOnOpen,
        handleOnClose,
        handleKeyDown,
        handleKeyDownOpenMenu,
        menuRef
    } = useMenuNavigation({
        depth: 1
    });

    return (
        <React.Fragment>
            <button
                className={classNames(
                    styles.userInfo,
                    stylesMenuBar.menuBarItem,
                    stylesMenuBar.hoverable,
                    {[stylesMenuBar.active]: isExpanded()}
                )}
                onClick={handleOnOpen}
                onKeyDown={handleKeyDown}
                aria-label={intl.formatMessage(accountMenu)}
                aria-expanded={isExpanded()}
                ref={menuRef}
            >
                {avatarUrl ? (
                    <UserAvatar
                        className={styles.avatar}
                        wrapperClassName={styles.avatarWrapper}
                        imageUrl={avatarUrl}
                        showAvatarBadge={!!avatarBadge}
                    />
                ) : null}
                <span className={styles.profileName}>
                    {username}
                </span>
                <div className={styles.dropdownCaretPosition}>
                    <img
                        className={stylesMenuBar.dropdownCaretIcon}
                        src={dropdownCaret}
                    />
                </div>
            </button>
            <MenuBarMenu
                className={classNames(stylesMenuBar.menuBarMenu)}
                open={isExpanded()}
                // note: the Rtl styles are switched here, because this menu is justified
                // opposite all the others
                place={isRtl ? 'right' : 'left'}
                onRequestClose={handleOnClose}
            >
                {profileUrl ? (
                    <MenuItemContainer
                        href={profileUrl}
                        data-menu-item="true"
                        onParentKeyPress={handleKeyDownOpenMenu}
                    >
                        <FormattedMessage
                            defaultMessage="Profile"
                            description="Text to link to my user profile, in the account navigation menu"
                            id="gui.accountMenu.profile"
                        />
                    </MenuItemContainer>
                ) : null}
    
                {myStuffUrl ? (
                    <MenuItemContainer
                        href={myStuffUrl}
                        data-menu-item="true"
                        onParentKeyPress={handleKeyDownOpenMenu}
                    >
                        <FormattedMessage
                            defaultMessage="My Stuff"
                            description="Text to link to list of my projects, in the account navigation menu"
                            id="gui.accountMenu.myStuff"
                        />
                    </MenuItemContainer>
                ) : null}
    
                {myClassesUrl ? (
                    <MenuItemContainer
                        href={myClassesUrl}
                        data-menu-item="true"
                        onParentKeyPress={handleKeyDownOpenMenu}
                    >
                        <FormattedMessage
                            defaultMessage="My Classes"
                            description="Text to link to my classes (if I am a teacher), in the account navigation menu"
                            id="gui.accountMenu.myClasses"
                        />
                    </MenuItemContainer>
                ) : null}
    
                {myClassUrl ? (
                    <MenuItemContainer
                        href={myClassUrl}
                        data-menu-item="true"
                        onParentKeyPress={handleKeyDownOpenMenu}
                    >
                        <FormattedMessage
                            defaultMessage="My Class"
                            description="Text to link to my class (if I am a student), in the account navigation menu"
                            id="gui.accountMenu.myClass"
                        />
                    </MenuItemContainer>
                ) : null}
    
                {accountSettingsUrl ? (
                    <MenuItemContainer
                        href={accountSettingsUrl}
                        data-menu-item="true"
                        onParentKeyPress={handleKeyDownOpenMenu}
                    >
                        <FormattedMessage
                            defaultMessage="Account settings"
                            description="Text to link to my account settings, in the account navigation menu"
                            id="gui.accountMenu.accountSettings"
                        />
                    </MenuItemContainer>
                ) : null}
    
                {canLogout ? (
                    <MenuSection>
                        <MenuItemContainer
                            onClick={onLogOut}
                            data-menu-item="true"
                            onParentKeyPress={handleKeyDownOpenMenu}
                        >
                            <FormattedMessage
                                defaultMessage="Sign out"
                                description="Text to link to sign out, in the account navigation menu"
                                id="gui.accountMenu.signOut"
                            />
                        </MenuItemContainer>
                    </MenuSection>
                ) : null}
            </MenuBarMenu>
        </React.Fragment>
    );
};

AccountMenu.propTypes = {
    menuOpts: AccountMenuOptionsPropTypes,
    isRtl: PropTypes.bool,
    username: PropTypes.string,
    onLogOut: PropTypes.func,
    avatarBadge: PropTypes.number
};

const mapStateToProps = state => ({
    isRtl: state.locales.isRtl
});

export default connect(
    mapStateToProps
)(AccountMenu);
