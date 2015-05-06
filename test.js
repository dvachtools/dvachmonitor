var Immutable = require('./libs/Immutable');
var _ = require('./libs/underscore');

var MainActor = {
    stateAddTab: function(state, windowId, tabId) {
        state = this.stateRemoveTab(state, windowId, tabId);
        state.tabs = state.tabs.concat([{windowId: windowId, tabId: tabId}]);
        return state
    },

    stateRemoveTab: function(state, windowId, tabId) {
        state.tabs = _.without(state.tabs, _.findWhere(state.tabs, {windowId: windowId, tabId: tabId}));
        return state;
    }
};

var state = {tabs: []};

console.log([1].concat([2]));

state = MainActor.stateAddTab(state, 1, 1);
state = MainActor.stateAddTab(state, 3, 4);
state = MainActor.stateRemoveTab(state, 0, 0);
console.log(state);