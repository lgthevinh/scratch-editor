import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';

export const MenuRefContext = React.createContext(null);

export class MenuRefProvider extends React.Component {
    constructor (props) {
        super(props);

        this.state = {
            refStack: []
        };

        bindAll(this, [
            'push',
            'pop',
            'cut',
            'clear',
            'isTopMenu',
            'isOpenMenu',
            'print'
        ]);
    }

    push (ref, depth) {
        if (depth <= this.state.refStack.length) {
            this.cut(this.state.refStack[depth - 1]);
        }

        this.setState(prev => ({
            refStack: [...prev.refStack, ref]
        }));
    }

    pop () {
        this.setState(prev => ({
            stack: prev.refStack.slice(0, prev.refStack.length - 1)
        }));
    }

    cut (ref) {
        this.setState(prev => {
            const refs = prev.refStack;
            const index = refs.indexOf(ref);

            if (index === -1) return {refStack: refs};

            return {
                refStack: refs.slice(0, index)
            };
        });
    }

    clear () {
        this.setState({refStack: []});
    }

    isTopMenu (ref) {
        const {refStack} = this.state;
        return refStack.length > 0 && refStack[refStack.length - 1] === ref;
    }

    isOpenMenu (ref) {
        return this.state.refStack.includes(ref);
    }

    print () {
        console.log(this.state.refStack);
    }

    render () {
        const value = {
            refStack: this.state.refStack,
            push: this.push,
            pop: this.pop,
            cut: this.cut,
            clear: this.clear,
            isTopMenu: this.isTopMenu,
            isOpenMenu: this.isOpenMenu,
            print: this.print
        };

        return (
            <MenuRefContext.Provider value={value}>
                {this.props.children}
            </MenuRefContext.Provider>
        );
    }
}

MenuRefProvider.propTypes = {
    children: PropTypes.node
};
