var Immutable = require('./libs/Immutable');
var _ = require('./libs/underscore');


var objs = {
    a: {
        b: {
            c: 1
        },
        e: {
            f: 2
        }
    },
    d: {
        g: 3
    }
};

var map = Immutable.fromJS(objs);

for(k in map.toObject()) console.log(k);
