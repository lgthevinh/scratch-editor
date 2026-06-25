const SET_GENERATED_CODE = 'scratch-gui/code/SET_GENERATED_CODE';

const initialState = {
    // The Arduino C++ source generated from the current workspace, shown in the
    // device panel's code view. Empty in host mode (no board selected).
    generatedCode: ''
};

const reducer = function (state = initialState, action) {
    switch (action.type) {
    case SET_GENERATED_CODE:
        return {...state, generatedCode: action.code};
    default:
        return state;
    }
};

const setGeneratedCode = code => ({
    type: SET_GENERATED_CODE,
    code
});

export {
    reducer as default,
    initialState as codeInitialState,
    setGeneratedCode
};
