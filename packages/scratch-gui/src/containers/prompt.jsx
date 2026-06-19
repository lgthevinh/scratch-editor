import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import PromptComponent from '../components/prompt/prompt.jsx';

class Prompt extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleOk',
            'handleTypeOptionSelection',
            'handleCancel',
            'handleChange',
            'handleKeyPress'
        ]);
        this.state = {
            inputValue: '',
            selectedType: 'int'
        };
    }
    handleKeyPress (event) {
        if (event.key === 'Enter') this.handleOk();
    }
    handleFocus (event) {
        event.target.select();
    }
    handleOk () {
        this.props.onOk(this.state.inputValue, {
            // There is a single implicit device target, so every variable is global.
            scope: 'global',
            dataType: this.props.showTypeOption ? this.state.selectedType : ''
        });
    }
    handleCancel () {
        this.props.onCancel();
    }
    handleChange (e) {
        this.setState({inputValue: e.target.value});
    }
    handleTypeOptionSelection (e) {
        this.setState({selectedType: e.target.value});
    }
    render () {
        return (
            <PromptComponent
                defaultValue={this.props.defaultValue}
                label={this.props.label}
                selectedType={this.state.selectedType}
                showTypeOption={this.props.showTypeOption}
                title={this.props.title}
                onCancel={this.handleCancel}
                onChange={this.handleChange}
                onFocus={this.handleFocus}
                onKeyPress={this.handleKeyPress}
                onOk={this.handleOk}
                onTypeOptionSelection={this.handleTypeOptionSelection}
            />
        );
    }
}

Prompt.propTypes = {
    defaultValue: PropTypes.string,
    label: PropTypes.string.isRequired,
    onCancel: PropTypes.func.isRequired,
    onOk: PropTypes.func.isRequired,
    showTypeOption: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired
};

export default Prompt;
